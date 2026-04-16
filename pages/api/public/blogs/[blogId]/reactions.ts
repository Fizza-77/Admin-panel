import type { NextApiRequest, NextApiResponse } from 'next';
import { randomUUID } from 'crypto';
import { serialize } from 'cookie';
import { supabase } from '@/lib/supabase/server';
import { reportError } from '@/lib/monitoring';
import { getRequestIp, verifyTurnstileToken } from '@/lib/security/turnstile';
import {
  EMPTY_REACTION_COUNTS,
  isReactionType,
  type ReactionCounts,
  type ReactionType,
  toReactionCounts,
} from '@/lib/blogs/reactions';

const REACTOR_COOKIE = 'blog_reactor_id';
const REACTION_COOLDOWN_MS = 2500;

type ReactionsResponse = {
  counts: ReactionCounts;
  userReaction: ReactionType | null;
};

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function ensureReactorId(req: NextApiRequest, res: NextApiResponse): string {
  const existing = req.cookies[REACTOR_COOKIE];
  if (existing && existing.length >= 12) {
    return existing;
  }

  const generated = randomUUID();
  res.setHeader(
    'Set-Cookie',
    serialize(REACTOR_COOKIE, generated, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365,
      path: '/',
    }),
  );
  return generated;
}

async function getReactionCounts(blogId: string): Promise<ReactionCounts> {
  const { data } = await supabase
    .from('blog_reaction_counts')
    .select('love,thumbs_up,thumbs_down,celebrationpop,clap')
    .eq('blog_id', blogId)
    .maybeSingle();

  if (!data) {
    return { ...EMPTY_REACTION_COUNTS };
  }

  return toReactionCounts(data as Partial<Record<ReactionType, number>>);
}

async function getUserReaction(blogId: string, reactorId: string): Promise<ReactionType | null> {
  const { data } = await supabase
    .from('blog_reactions')
    .select('reaction_type')
    .eq('blog_id', blogId)
    .eq('reactor_id', reactorId)
    .maybeSingle();

  const value = data?.reaction_type;
  return isReactionType(value) ? value : null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const blogId = req.query.blogId;
  if (typeof blogId !== 'string' || !isUuid(blogId)) {
    return res.status(400).json({ message: 'Invalid blog id' });
  }

  try {
    const { data: blog } = await supabase
      .from('blogs')
      .select('id,status')
      .eq('id', blogId)
      .maybeSingle();

    if (!blog || blog.status !== 'published') {
      return res.status(404).json({ message: 'Blog not found' });
    }

    const reactorId = ensureReactorId(req, res);

    if (req.method === 'GET') {
      const [counts, userReaction] = await Promise.all([
        getReactionCounts(blogId),
        getUserReaction(blogId, reactorId),
      ]);

      const response: ReactionsResponse = {
        counts,
        userReaction,
      };
      return res.status(200).json(response);
    }

    if (req.method === 'POST') {
      const reactionType = req.body?.reactionType;
      const turnstileToken = typeof req.body?.turnstileToken === 'string' ? req.body.turnstileToken : '';
      if (!isReactionType(reactionType)) {
        return res.status(400).json({ message: 'Invalid reaction type' });
      }

      const verify = await verifyTurnstileToken(turnstileToken, getRequestIp(req.headers));
      if (!verify.ok) {
        const status = verify.message?.includes('not configured') ? 503 : 400;
        return res.status(status).json({ message: verify.message || 'Human verification failed' });
      }

      const { data: existing } = await supabase
        .from('blog_reactions')
        .select('reaction_type,updated_at')
        .eq('blog_id', blogId)
        .eq('reactor_id', reactorId)
        .maybeSingle();

      if (existing?.updated_at) {
        const elapsedMs = Date.now() - new Date(existing.updated_at).getTime();
        if (!Number.isNaN(elapsedMs) && elapsedMs < REACTION_COOLDOWN_MS) {
          return res.status(429).json({ message: 'You are reacting too fast. Please try again.' });
        }
      }

      let userReaction: ReactionType | null = null;

      if (existing?.reaction_type === reactionType) {
        await supabase.from('blog_reactions').delete().eq('blog_id', blogId).eq('reactor_id', reactorId);
      } else {
        const { error: upsertError } = await supabase.from('blog_reactions').upsert(
          {
            blog_id: blogId,
            reactor_id: reactorId,
            reaction_type: reactionType,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'blog_id,reactor_id' },
        );

        if (upsertError) {
          return res.status(500).json({ message: 'Failed to save reaction' });
        }

        userReaction = reactionType;
      }

      const counts = await getReactionCounts(blogId);
      const response: ReactionsResponse = {
        counts,
        userReaction,
      };
      return res.status(200).json(response);
    }

    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({ message: 'Method Not Allowed' });
  } catch (error) {
    reportError(error, { source: 'api/public/blogs/[blogId]/reactions', blogId });
    return res.status(500).json({ message: 'Unexpected server error' });
  }
}
