'use client';
import { useState, useEffect } from 'react';

export function useIsNarrow(maxWidth: number): boolean {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${maxWidth - 1}px)`);
    setNarrow(mq.matches);
    const fn = (e: MediaQueryListEvent) => setNarrow(e.matches);
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, [maxWidth]);
  return narrow;
}
