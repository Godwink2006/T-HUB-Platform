const SUPABASE_URL = "https://xlwrdsrjdgzfqpbigphv.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhsd3Jkc3JqZGd6ZnFwYmlncGh2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU2ODkyMjIsImV4cCI6MjEwMTI2NTIyMn0.53HUz-sMEdBLpH4OehUA0_50r0wgEmo-pYgDnTMzYbY";

const isLocalDevelopmentHost = ["localhost", "127.0.0.1", "::1"].includes(
    window.location.hostname,
);
const appDiagnosticsEnabled =
    isLocalDevelopmentHost &&
    new URLSearchParams(window.location.search).get("debug") === "1";
if (!appDiagnosticsEnabled) {
    ["log", "debug", "info", "warn", "error", "trace", "table", "dir"].forEach(
        (method) => {
            console[method] = () => {};
        },
    );
}


const SUPABASE_READ_TTL = 20_000;
const SUPABASE_READ_CACHE_LIMIT = 120;
const SUPABASE_PERSISTENT_READ_CACHE_LIMIT = 500;
const SUPABASE_READ_DB_NAME = "thub-supabase-read-cache";
const SUPABASE_READ_STORE_NAME = "reads";
const supabaseReadCache = new Map();
const supabaseReadInflight = new Map();
const defaultSupabaseFetch = window.fetch.bind(window);
let supabaseCacheGeneration = 0;
let supabaseReadDbPromise;

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

function openSupabaseReadDb() {
    if (!window.indexedDB) return Promise.resolve(null);
    if (supabaseReadDbPromise) return supabaseReadDbPromise;

    supabaseReadDbPromise = new Promise((resolve) => {
        let request;
        try {
            request = window.indexedDB.open(SUPABASE_READ_DB_NAME, 1);
        } catch {
            resolve(null);
            return;
        }

        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(SUPABASE_READ_STORE_NAME)) {
                db.createObjectStore(SUPABASE_READ_STORE_NAME, { keyPath: "key" });
            }
        };
        request.onsuccess = () => {
            const db = request.result;
            db.onversionchange = () => db.close();
            resolve(db);
        };
        request.onerror = () => resolve(null);
        request.onblocked = () => resolve(null);
    });

    return supabaseReadDbPromise;
}

function persistentSupabaseReadCacheKey(request) {
    const authorization = request.headers.get("authorization");
    let userId = "anonymous";

    if (authorization) {
        const token = authorization.replace(/^Bearer\s+/i, "");
        const payload = token.split(".")[1];
        if (!payload) return null;

        try {
            const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
            const claims = JSON.parse(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "=")));
            if (typeof claims.sub !== "string" || !claims.sub) return null;
            userId = claims.sub;
        } catch {
            return null;
        }
    }

    const varyHeaders = ["apikey", "accept-profile", "content-profile", "range", "prefer"];
    const varyingValues = varyHeaders
        .map((name) => `${name}:${request.headers.get(name) || ""}`)
        .join("\n");
    return `${userId}\n${request.url}\n${varyingValues}`;
}

async function readPersistentSupabaseResponse(key) {
    const db = await openSupabaseReadDb();
    if (!db) return null;

    return new Promise((resolve) => {
        try {
            const transaction = db.transaction(SUPABASE_READ_STORE_NAME, "readonly");
            const request = transaction.objectStore(SUPABASE_READ_STORE_NAME).get(key);
            request.onsuccess = () => {
                const entry = request.result;
                if (!entry) {
                    resolve(null);
                    return;
                }
                try {
                    const body = [204, 205, 304].includes(entry.status)
                        ? null
                        : entry.body;
                    resolve(new Response(body, {
                        status: entry.status,
                        statusText: entry.statusText,
                        headers: entry.headers,
                    }));
                } catch {
                    resolve(null);
                }
            };
            request.onerror = () => resolve(null);
        } catch {
            resolve(null);
        }
    });
}

async function storePersistentSupabaseResponse(key, response, generation) {
    if (generation !== supabaseCacheGeneration) return;
    if (response.headers.get("cache-control")?.toLowerCase().includes("no-store")) return;

    const db = await openSupabaseReadDb();
    if (!db || generation !== supabaseCacheGeneration) return;

    try {
        const body = await response.text();
        if (generation !== supabaseCacheGeneration) return;
        const transaction = db.transaction(SUPABASE_READ_STORE_NAME, "readwrite");
        const store = transaction.objectStore(SUPABASE_READ_STORE_NAME);
        store.put({
            key,
            body,
            status: response.status,
            statusText: response.statusText,
            headers: Array.from(response.headers.entries()).filter(([name]) =>
                !["content-encoding", "content-length", "transfer-encoding", "set-cookie"].includes(name.toLowerCase()),
            ),
            savedAt: Date.now(),
        });
        const allRequest = store.getAll();
        allRequest.onsuccess = () => {
            const entries = allRequest.result || [];
            const remaining = entries
                .filter((entry) => entry.key !== key)
                .sort((left, right) => left.savedAt - right.savedAt);
            while (remaining.length >= SUPABASE_PERSISTENT_READ_CACHE_LIMIT) {
                store.delete(remaining.shift().key);
            }
        };
    } catch {
        // IndexedDB is an optional speed-up; the live Supabase response still works.
    }
}

async function clearPersistentSupabaseResponses() {
    const db = await openSupabaseReadDb();
    if (!db) return;
    try {
        db.transaction(SUPABASE_READ_STORE_NAME, "readwrite")
            .objectStore(SUPABASE_READ_STORE_NAME)
            .clear();
    } catch {
        // The in-memory cache is already cleared if IndexedDB is unavailable.
    }
}

function refreshPersistentSupabaseResponse(request, memoryKey, persistentKey, generation) {
    if (supabaseReadInflight.has(memoryKey)) return;

    let pending;
    pending = defaultSupabaseFetch(request.clone())
        .then((response) => {
            if (response.ok && generation === supabaseCacheGeneration) {
                supabaseReadCache.set(memoryKey, {
                    response: response.clone(),
                    expiresAt: Date.now() + SUPABASE_READ_TTL,
                });
                trimSupabaseReadCache();
                void storePersistentSupabaseResponse(
                    persistentKey,
                    response.clone(),
                    generation,
                );
            }
            return response;
        })
        .catch(() => null)
        .finally(() => {
            if (supabaseReadInflight.get(memoryKey) === pending) {
                supabaseReadInflight.delete(memoryKey);
            }
        });
    supabaseReadInflight.set(memoryKey, pending);
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
            await clearPersistentSupabaseResponses();
        }
        return response;
    }

    trimSupabaseReadCache();
    const key = supabaseReadCacheKey(request);
    const generation = supabaseCacheGeneration;
    const cached = supabaseReadCache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
        return cached.response.clone();
    }

    const persistentKey = persistentSupabaseReadCacheKey(request);
    if (persistentKey) {
        const persistedResponse = await readPersistentSupabaseResponse(persistentKey);
        if (generation === supabaseCacheGeneration && persistedResponse) {
            refreshPersistentSupabaseResponse(
                request,
                key,
                persistentKey,
                generation,
            );
            return persistedResponse;
        }
    }

    let pending = supabaseReadInflight.get(key);
    if (!pending) {
        pending = defaultSupabaseFetch(request)
            .then((response) => {
                if (response.ok && generation === supabaseCacheGeneration) {
                    supabaseReadCache.set(key, {
                        response: response.clone(),
                        expiresAt: Date.now() + SUPABASE_READ_TTL,
                    });
                    trimSupabaseReadCache();
                    if (persistentKey) {
                        void storePersistentSupabaseResponse(
                            persistentKey,
                            response.clone(),
                            generation,
                        );
                    }
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

supabaseClient.auth.onAuthStateChange((event) => {
    supabaseCacheGeneration += 1;
    supabaseReadCache.clear();
    supabaseReadInflight.clear();
    if (["SIGNED_IN", "SIGNED_OUT", "USER_UPDATED"].includes(event)) {
        void clearPersistentSupabaseResponses();
    }
});
