import { isBrowserOffline, isNetworkFetchError, shouldTrackApiFetch } from '@/lib/client/networkErrors';

export type ConnectionState = 'online' | 'lost';

type Listener = (state: ConnectionState) => void;

const FAILURE_THRESHOLD = 1;
const FAILURE_WINDOW_MS = 8000;
const SLOW_FETCH_MS = 45000;

let state: ConnectionState = 'online';
let listeners = new Set<Listener>();
let recentFailures: number[] = [];
let fetchPatched = false;
let originalFetch: typeof fetch | null = null;

function emit(next: ConnectionState) {
  if (state === next) {
    return;
  }
  state = next;
  listeners.forEach((listener) => listener(state));
}

function markLost() {
  emit('lost');
}

function markOnline() {
  recentFailures = [];
  emit('online');
}

function recordFailure() {
  const now = Date.now();
  recentFailures = recentFailures.filter((t) => now - t < FAILURE_WINDOW_MS);
  recentFailures.push(now);

  if (isBrowserOffline() || recentFailures.length >= FAILURE_THRESHOLD) {
    markLost();
  }
}

function recordSuccess() {
  if (state === 'lost' && !isBrowserOffline()) {
    markOnline();
    return;
  }

  if (state === 'online') {
    recentFailures = [];
  }
}

function withSlowFetchTimeout<T>(promise: Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new TypeError('Request timed out'));
    }, SLOW_FETCH_MS);

    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timer);
        reject(error);
      },
    );
  });
}

async function probeConnection(): Promise<boolean> {
  if (!originalFetch) {
    return false;
  }

  try {
    const response = await originalFetch('/api/auth/session', {
      credentials: 'include',
      cache: 'no-store',
    });

    if (response.ok || response.status === 401) {
      markOnline();
      return true;
    }
  } catch (error) {
    if (isNetworkFetchError(error) || isBrowserOffline()) {
      markLost();
      return false;
    }
  }

  return false;
}

function patchFetch() {
  if (fetchPatched || typeof window === 'undefined') {
    return;
  }

  originalFetch = window.fetch.bind(window);
  fetchPatched = true;

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const track = shouldTrackApiFetch(input);

    try {
      const request = originalFetch!(input, init);
      const response = await (track ? withSlowFetchTimeout(request) : request);
      if (track) {
        recordSuccess();
      }
      return response;
    } catch (error) {
      if (track && isNetworkFetchError(error)) {
        recordFailure();
      }
      throw error;
    }
  };
}

function onOffline() {
  markLost();
}

function onOnline() {
  void probeConnection();
}

export function getConnectionState(): ConnectionState {
  return state;
}

export function subscribeConnectionState(listener: Listener): () => void {
  listeners.add(listener);
  listener(state);
  return () => {
    listeners.delete(listener);
  };
}

export function startConnectionMonitor(): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  patchFetch();

  if (isBrowserOffline()) {
    markLost();
  }

  window.addEventListener('offline', onOffline);
  window.addEventListener('online', onOnline);

  return () => {
    window.removeEventListener('offline', onOffline);
    window.removeEventListener('online', onOnline);

    if (fetchPatched && originalFetch) {
      window.fetch = originalFetch;
      fetchPatched = false;
      originalFetch = null;
    }

    listeners = new Set();
    recentFailures = [];
    state = 'online';
  };
}

export async function retryConnection(): Promise<boolean> {
  if (isBrowserOffline()) {
    markLost();
    return false;
  }

  return probeConnection();
}
