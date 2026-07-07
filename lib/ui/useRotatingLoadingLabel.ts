'use client';

import { useEffect, useMemo, useState } from 'react';

export function useRotatingLoadingLabel(
  active: boolean,
  messages: string[],
  intervalMs = 2800,
): string {
  const key = useMemo(() => messages.join('\0'), [messages]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [key]);

  useEffect(() => {
    if (!active || messages.length <= 1) {
      return;
    }

    const id = window.setInterval(() => {
      setIndex((current) => (current + 1) % messages.length);
    }, intervalMs);

    return () => window.clearInterval(id);
  }, [active, messages.length, intervalMs, key]);

  if (!messages.length) {
    return 'Loading…';
  }

  return messages[Math.min(index, messages.length - 1)] ?? messages[0];
}
