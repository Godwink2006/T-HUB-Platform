const SUPABASE_URL = "https://xlwrdsrjdgzfqpbigphv.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhsd3Jkc3JqZGd6ZnFwYmlncGh2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU2ODkyMjIsImV4cCI6MjEwMTI2NTIyMn0.53HUz-sMEdBLpH4OehUA0_50r0wgEmo-pYgDnTMzYbY";

// Cache successful Supabase table reads briefly so repeat renders and button
// clicks can reuse results. Writes and auth changes invalidate the cache.
const SUPABASE_READ_TTL = 20_000;
const SUPABASE_READ_CACHE_LIMIT = 120;
const supabaseReadCache = new Map();
const supabaseReadInflight = new Map();
const defaultSupabaseFetch = window.fetch.bind(window);
let supabaseCacheGeneration = 0;

function supabaseReadCacheKey(request) {
    const varyHeaders = [
        "authorization",
        "apikey",
        "accept-profile",
        "content-profile",
        "range",
        "prefer",
    ];
    const varyingValues = varyHeaders
        .map((name) => `${name}:${request.headers.get(name) || ""}`)
        .join("\n");
    return `${request.url}\n${varyingValues}`;
}

function trimSupabaseReadCache() {
    const now = Date.now();
    for (const [key, entry] of supabaseReadCache) {
        if (entry.expiresAt <= now) supabaseReadCache.delete(key);
    }
    while (supabaseReadCache.size > SUPABASE_READ_CACHE_LIMIT) {
        supabaseReadCache.delete(supabaseReadCache.keys().next().value);
    }
}

async function cachedSupabaseFetch(input, init) {
    const request = new Request(input, init);
    const url = new URL(request.url);
    const isSupabaseTableRead =
        url.origin === new URL(SUPABASE_URL).origin &&
        url.pathname.startsWith("/rest/v1/") &&
        request.method === "GET";

    if (!isSupabaseTableRead) {
        const response = await defaultSupabaseFetch(request);
        if (
            url.origin === new URL(SUPABASE_URL).origin &&
            url.pathname.startsWith("/rest/v1/") &&
            request.method !== "GET" &&
            response.ok
        ) {
            supabaseCacheGeneration += 1;
            supabaseReadCache.clear();
            supabaseReadInflight.clear();
        }
        return response;
    }

    trimSupabaseReadCache();
    const key = supabaseReadCacheKey(request);
    const cached = supabaseReadCache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
        return cached.response.clone();
    }

    let pending = supabaseReadInflight.get(key);
    if (!pending) {
        const generation = supabaseCacheGeneration;
        pending = defaultSupabaseFetch(request)
            .then((response) => {
                if (response.ok && generation === supabaseCacheGeneration) {
                    supabaseReadCache.set(key, {
                        response: response.clone(),
                        expiresAt: Date.now() + SUPABASE_READ_TTL,
                    });
                    trimSupabaseReadCache();
                }
                return response;
            })
            .finally(() => {
                if (supabaseReadInflight.get(key) === pending) {
                    supabaseReadInflight.delete(key);
                }
            });
        supabaseReadInflight.set(key, pending);
    }

    return (await pending).clone();
}

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    { global: { fetch: cachedSupabaseFetch } },
);

window.supabaseClient = supabaseClient;

supabaseClient.auth.onAuthStateChange(() => {
    supabaseCacheGeneration += 1;
    supabaseReadCache.clear();
    supabaseReadInflight.clear();
});
