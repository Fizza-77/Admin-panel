/** Client-side detection for unreachable hosts / dropped connections. */
export function isNetworkFetchError(error: unknown): boolean {
  if (error instanceof TypeError) {
    const message = error.message.toLowerCase();
    return (
      message.includes('failed to fetch') ||
      message.includes('networkerror') ||
      message.includes('load failed') ||
      message.includes('network request failed')
    );
  }

  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  const cause = (error as Error & { cause?: { code?: string; message?: string } }).cause;
  const causeMessage = cause?.message?.toLowerCase() ?? '';

  return (
    error.name === 'AbortError' ||
    message.includes('fetch failed') ||
    message.includes('network') ||
    message.includes('connect timeout') ||
    message.includes('timed out') ||
    causeMessage.includes('network') ||
    cause?.code === 'UND_ERR_CONNECT_TIMEOUT' ||
    cause?.code === 'ECONNREFUSED' ||
    cause?.code === 'ENOTFOUND' ||
    cause?.code === 'ETIMEDOUT'
  );
}

export function isBrowserOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

export function shouldTrackApiFetch(input: RequestInfo | URL): boolean {
  const url =
    typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.href
        : input.url;

  if (!url.includes('/api/')) {
    return false;
  }

  if (url.includes('/api/client-errors')) {
    return false;
  }

  if (/\/api\/(tasks\/upload|upload|profile\/avatar)(?:\?|$)/.test(url)) {
    return false;
  }

  return true;
}
