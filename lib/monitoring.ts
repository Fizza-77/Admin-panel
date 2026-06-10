type ErrorContext = Record<string, unknown>;

type SerializableError = {
  name: string;
  message: string;
  stack?: string;
};

function toSerializableError(error: unknown): SerializableError {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  if (error && typeof error === 'object' && 'message' in error) {
    const msg = (error as { message?: unknown }).message;
    const code = (error as { code?: unknown }).code;
    const message =
      typeof msg === 'string'
        ? code
          ? `${msg} (code ${String(code)})`
          : msg
        : 'Unknown error';
    return { name: 'PostgrestError', message };
  }

  return {
    name: 'UnknownError',
    message: typeof error === 'string' ? error : 'Unknown error',
  };
}

function sendClientLog(error: SerializableError, context: ErrorContext) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    const sentry = (window as any).Sentry;
    if (sentry?.captureException) {
      sentry.captureException(new Error(error.message), { extra: context });
    }
  } catch (sentryError) {
    console.error('Sentry capture failed', sentryError);
  }

  try {
    void fetch('/api/client-errors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error, context }),
      keepalive: true,
    });
  } catch (logError) {
    console.error('Client log request failed', logError);
  }
}

export function reportError(error: unknown, context: ErrorContext = {}) {
  const payload = toSerializableError(error);
  console.error('Application error report', {
    error: payload,
    context,
  });
  sendClientLog(payload, context);
}
