export const REACTION_TYPES = [
  'love',
  'thumbs_up',
  'thumbs_down',
  'celebrationpop',
  'clap',
] as const;

export type ReactionType = (typeof REACTION_TYPES)[number];

export type ReactionCounts = Record<ReactionType, number>;

export const EMPTY_REACTION_COUNTS: ReactionCounts = {
  love: 0,
  thumbs_up: 0,
  thumbs_down: 0,
  celebrationpop: 0,
  clap: 0,
};

export const REACTION_META: Array<{ type: ReactionType; label: string; emoji: string }> = [
  { type: 'love', label: 'Love', emoji: '❤️' },
  { type: 'thumbs_up', label: 'Thumbs Up', emoji: '👍' },
  { type: 'thumbs_down', label: 'Thumbs Down', emoji: '👎' },
  { type: 'celebrationpop', label: 'Celebration', emoji: '🎉' },
  { type: 'clap', label: 'Clap', emoji: '👏' },
];

export function isReactionType(value: unknown): value is ReactionType {
  return typeof value === 'string' && REACTION_TYPES.includes(value as ReactionType);
}

export function toReactionCounts(input: Partial<Record<ReactionType, number>> | null | undefined): ReactionCounts {
  return {
    love: Number(input?.love ?? 0),
    thumbs_up: Number(input?.thumbs_up ?? 0),
    thumbs_down: Number(input?.thumbs_down ?? 0),
    celebrationpop: Number(input?.celebrationpop ?? 0),
    clap: Number(input?.clap ?? 0),
  };
}
