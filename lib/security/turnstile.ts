type TurnstileVerifyResponse = {
  success?: boolean;
  'error-codes'?: string[];
};

type TurnstileVerifyResult = {
  ok: boolean;
  message?: string;
};

export function getRequestIp(headers: Record<string, string | string[] | undefined>): string | undefined {
  const cfIp = headers['cf-connecting-ip'];
  if (typeof cfIp === 'string' && cfIp.trim()) {
    return cfIp.trim();
  }

  const forwarded = headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) {
      return first;
    }
  }

  return undefined;
}

export async function verifyTurnstileToken(
  token: string,
  remoteIp?: string,
): Promise<TurnstileVerifyResult> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret || !secret.trim()) {
    return { ok: false, message: 'Turnstile is not configured on the server.' };
  }

  if (!token || !token.trim()) {
    return { ok: false, message: 'Missing Turnstile token.' };
  }

  const body = new URLSearchParams();
  body.set('secret', secret);
  body.set('response', token);
  if (remoteIp) {
    body.set('remoteip', remoteIp);
  }

  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    const result = (await response.json().catch(() => ({}))) as TurnstileVerifyResponse;
    if (result?.success === true) {
      return { ok: true };
    }

    const details = Array.isArray(result?.['error-codes']) ? result['error-codes'].join(', ') : 'unknown-error';
    return { ok: false, message: `Turnstile verification failed (${details}).` };
  } catch {
    return { ok: false, message: 'Turnstile verification request failed.' };
  }
}
