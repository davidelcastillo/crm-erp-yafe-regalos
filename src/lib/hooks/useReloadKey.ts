"use client";

import { useCallback, useState } from "react";

/**
 * Returns a `[key, bump]` pair. `key` is a number that increments on every
 * `bump()` call, so client components can re-run their load effects after a
 * mutation (router.refresh() does not re-trigger useEffect loads).
 */
export function useReloadKey(): [number, () => void] {
  const [key, setKey] = useState(0);

  const bump = useCallback(() => {
    setKey((current) => current + 1);
  }, []);

  return [key, bump];
}
