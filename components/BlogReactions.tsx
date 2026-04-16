import { useEffect, useRef, useState } from 'react';
import { reportError } from '@/lib/monitoring';
import {
  EMPTY_REACTION_COUNTS,
  REACTION_META,
  toReactionCounts,
  type ReactionCounts,
  type ReactionType,
} from '@/lib/blogs/reactions';

interface BlogReactionsProps {
  blogId: string;
  initialCounts?: ReactionCounts;
  interactive?: boolean;
}

type ApiResponse = {
  counts?: Partial<ReactionCounts>;
  userReaction?: ReactionType | null;
  message?: string;
};

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '';

function hasTurnstileLoaded(): boolean {
  return typeof window !== 'undefined' && Boolean((window as any).turnstile?.render);
}

export default function BlogReactions({ blogId, initialCounts, interactive = true }: BlogReactionsProps) {
  const [counts, setCounts] = useState<ReactionCounts>(toReactionCounts(initialCounts ?? EMPTY_REACTION_COUNTS));
  const [activeReaction, setActiveReaction] = useState<ReactionType | null>(null);
  const [submitting, setSubmitting] = useState<ReactionType | null>(null);
  const [turnstileToken, setTurnstileToken] = useState('');
  const [captchaError, setCaptchaError] = useState('');
  const [requiresVerification, setRequiresVerification] = useState(false);
  const [turnstileReady, setTurnstileReady] = useState(false);
  const widgetContainerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!interactive) {
      return;
    }
    if (!TURNSTILE_SITE_KEY || hasTurnstileLoaded()) {
      setTurnstileReady(hasTurnstileLoaded());
      return;
    }

    const existingScript = document.querySelector<HTMLScriptElement>('script[data-turnstile="true"]');
    if (existingScript) {
      existingScript.addEventListener('load', () => setTurnstileReady(true), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.defer = true;
    script.dataset.turnstile = 'true';
    script.onload = () => setTurnstileReady(true);
    script.onerror = () => setCaptchaError('Failed to load human verification. Refresh and try again.');
    document.head.appendChild(script);
  }, []);

  useEffect(() => {
    if (!interactive) {
      return;
    }
    if (!requiresVerification || !turnstileReady || !TURNSTILE_SITE_KEY) {
      return;
    }
    if (!widgetContainerRef.current || widgetIdRef.current) {
      return;
    }

    const turnstile = (window as any).turnstile;
    if (!turnstile?.render) {
      return;
    }

    widgetIdRef.current = turnstile.render(widgetContainerRef.current, {
      sitekey: TURNSTILE_SITE_KEY,
      callback: (token: string) => {
        setTurnstileToken(token);
        setCaptchaError('');
      },
      'expired-callback': () => {
        setTurnstileToken('');
      },
      'error-callback': () => {
        setTurnstileToken('');
        setCaptchaError('Verification failed. Please retry.');
      },
    });
  }, [requiresVerification, turnstileReady]);

  const resetTurnstile = () => {
    setTurnstileToken('');
    const turnstile = (window as any).turnstile;
    if (turnstile?.reset && widgetIdRef.current) {
      turnstile.reset(widgetIdRef.current);
    }
  };

  const react = async (reactionType: ReactionType) => {
    if (!interactive) {
      return;
    }
    if (!blogId || submitting) {
      return;
    }

    if (!TURNSTILE_SITE_KEY) {
      setCaptchaError('Human verification is not configured. Contact support.');
      return;
    }

    if (!turnstileToken) {
      setRequiresVerification(true);
      setCaptchaError('Please verify you are human first.');
      return;
    }

    setSubmitting(reactionType);
    setCaptchaError('');
    try {
      const response = await fetch(`/api/public/blogs/${blogId}/reactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reactionType, turnstileToken }),
      });

      const body: ApiResponse = await response.json().catch(() => ({}));
      if (!response.ok) {
        resetTurnstile();
        setRequiresVerification(true);
        setCaptchaError(body.message || 'Verification failed. Please try again.');
        throw new Error(body.message || 'Failed to save reaction');
      }

      setCounts(toReactionCounts(body.counts));
      setActiveReaction((body.userReaction ?? null) as ReactionType | null);
      resetTurnstile();
    } catch (error) {
      reportError(error, {
        source: 'BlogReactions.react',
        blogId,
        reactionType,
      });
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <div className="mt-4 border border-gray-200 rounded-lg p-2.5 bg-gray-50">
      <p className="text-[11px] uppercase tracking-wide text-gray-500 font-semibold mb-2">
        {interactive ? 'Public reactions' : 'Reactions'}
      </p>
      {interactive && requiresVerification && (
        <div className="mb-2">
          <div ref={widgetContainerRef} />
        </div>
      )}
      {interactive && captchaError && <p className="mb-2 text-xs text-amber-700">{captchaError}</p>}
      <div className="flex flex-wrap gap-1.5">
        {REACTION_META.map((reaction) => {
          const isActive = activeReaction === reaction.type;
          const value = counts[reaction.type] ?? 0;
          return (
            <button
              key={reaction.type}
              type="button"
              disabled={!interactive || Boolean(submitting)}
              onClick={interactive ? () => react(reaction.type) : undefined}
              className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium transition ${
                isActive
                  ? 'bg-blue-100 text-blue-700 border-blue-300'
                  : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-100'
              } disabled:opacity-60 disabled:cursor-not-allowed`}
              title={reaction.label}
            >
              <span aria-hidden="true">{reaction.emoji}</span>
              <span>{value}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
