/**
 * QueryCache — in-memory TTL cache for Supabase queries.
 *
 * Usage:
 *   const data = await QueryCache.wrap(
 *     'students:all',
 *     () => supabaseClient.from('students').select('*'),
 *     60000 // TTL in ms (default 30 s)
 *   );
 *
 * Or manual:
 *   QueryCache.set('key', data, 30000);
 *   const hit = QueryCache.get('key');  // null on miss / expired
 *   QueryCache.invalidate('students'); // delete all keys starting with 'students'
 */
window.QueryCache = (function () {
  /** @type {Map<string, {data: *, expiresAt: number}>} */
  const _store = new Map();

  /** Default TTL: 30 seconds */
  const DEFAULT_TTL = 30_000;

  /** In-flight promise map — prevents duplicate concurrent fetches */
  const _inflight = new Map();

  function get(key) {
    const entry = _store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      _store.delete(key);
      return null;
    }
    return entry.data;
  }

  function set(key, data, ttlMs = DEFAULT_TTL) {
    _store.set(key, { data, expiresAt: Date.now() + ttlMs });
  }

  function invalidate(keyPrefix) {
    for (const key of _store.keys()) {
      if (key.startsWith(keyPrefix)) {
        _store.delete(key);
      }
    }
  }

  function clear() {
    _store.clear();
    _inflight.clear();
  }

  /**
   * Wraps an async fetch function with caching.
   * If a request for the same key is already in-flight, returns the same promise
   * (deduplication). On success, caches the result.
   *
   * @param {string} key           - Cache key
   * @param {() => Promise<*>} fn  - Async factory that returns data
   * @param {number} [ttlMs]       - TTL in milliseconds
   * @returns {Promise<*>}
   */
  async function wrap(key, fn, ttlMs = DEFAULT_TTL) {
    // Cache hit
    const cached = get(key);
    if (cached !== null) return cached;

    // Dedup in-flight
    if (_inflight.has(key)) return _inflight.get(key);

    const promise = (async () => {
      try {
        const result = await fn();
        set(key, result, ttlMs);
        return result;
      } finally {
        _inflight.delete(key);
      }
    })();

    _inflight.set(key, promise);
    return promise;
  }

  /**
   * Convenience: run a Supabase query builder and cache result data.
   * Throws on Supabase error.
   *
   * @param {string} key
   * @param {() => import('@supabase/supabase-js').PostgrestBuilder} queryFn
   * @param {number} [ttlMs]
   * @returns {Promise<Array|Object>}
   */
  async function supaQuery(key, queryFn, ttlMs = DEFAULT_TTL) {
    return wrap(
      key,
      async () => {
        const { data, error } = await queryFn();
        if (error) throw error;
        return data;
      },
      ttlMs,
    );
  }

  return { get, set, invalidate, clear, wrap, supaQuery };
})();
