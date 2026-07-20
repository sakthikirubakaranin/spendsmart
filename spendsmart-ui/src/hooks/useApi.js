import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Generic hook for calling an async API function.
 *
 * Usage:
 *   const { data, loading, error, run } = useApi(expensesApi.list);
 *   useEffect(() => run({ page: 1 }), []);
 *
 * `run` is stable across renders — safe to put in dependency arrays.
 */
export function useApi(apiFn, { immediate = false, args = [] } = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(immediate);
  const [error, setError] = useState(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const run = useCallback(
    async (...callArgs) => {
      setLoading(true);
      setError(null);
      try {
        const result = await apiFn(...callArgs);
        if (mountedRef.current) setData(result);
        return result;
      } catch (err) {
        const msg =
          err?.response?.data?.detail || err?.message || 'Something went wrong';
        if (mountedRef.current) setError(msg);
        throw err;
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [apiFn]
  );

  useEffect(() => {
    if (immediate) run(...args);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { data, loading, error, run, setData };
}
