-- Add per-blog reactions for public visitors.
-- Supports: love, thumbs_up, thumbs_down, celebrationpop, clap.

CREATE TABLE IF NOT EXISTS public.blog_reactions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  blog_id uuid NOT NULL REFERENCES public.blogs(id) ON DELETE CASCADE,
  reactor_id text NOT NULL,
  reaction_type text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT blog_reactions_reaction_type_check
    CHECK (reaction_type IN ('love', 'thumbs_up', 'thumbs_down', 'celebrationpop', 'clap')),
  CONSTRAINT blog_reactions_blog_reactor_unique UNIQUE (blog_id, reactor_id)
);

CREATE INDEX IF NOT EXISTS blog_reactions_blog_id_idx
  ON public.blog_reactions (blog_id);

CREATE INDEX IF NOT EXISTS blog_reactions_blog_reaction_idx
  ON public.blog_reactions (blog_id, reaction_type);

ALTER TABLE public.blog_reactions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'blog_reactions'
      AND policyname = 'Anon can read reactions for published blogs'
  ) THEN
    CREATE POLICY "Anon can read reactions for published blogs"
      ON public.blog_reactions
      FOR SELECT
      TO anon
      USING (
        EXISTS (
          SELECT 1
          FROM public.blogs b
          WHERE b.id = blog_reactions.blog_id
            AND b.status = 'published'
        )
      );
  END IF;
END $$;

CREATE OR REPLACE VIEW public.blog_reaction_counts AS
SELECT
  br.blog_id,
  COUNT(*) FILTER (WHERE br.reaction_type = 'love')::int AS love,
  COUNT(*) FILTER (WHERE br.reaction_type = 'thumbs_up')::int AS thumbs_up,
  COUNT(*) FILTER (WHERE br.reaction_type = 'thumbs_down')::int AS thumbs_down,
  COUNT(*) FILTER (WHERE br.reaction_type = 'celebrationpop')::int AS celebrationpop,
  COUNT(*) FILTER (WHERE br.reaction_type = 'clap')::int AS clap
FROM public.blog_reactions br
GROUP BY br.blog_id;

GRANT SELECT ON public.blog_reactions TO anon, authenticated;
GRANT SELECT ON public.blog_reaction_counts TO anon, authenticated;

COMMENT ON TABLE public.blog_reactions IS
  'Stores one reaction per visitor per blog using cookie-based reactor_id.';

COMMENT ON VIEW public.blog_reaction_counts IS
  'Aggregated reaction counters per blog.';
