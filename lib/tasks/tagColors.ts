/**
 * Tag palette: red, orange, purple, pink (distinct from Kanban status bar greys/blues/greens/yellows).
 * The first applied tag drives the task card outline (white fill, colored border).
 */
export const TAG_COLOR_KEYS = ['red', 'orange', 'purple', 'pink'] as const;
export type TagColorKey = (typeof TAG_COLOR_KEYS)[number];

export function isTagColorKey(value: unknown): value is TagColorKey {
  return typeof value === 'string' && (TAG_COLOR_KEYS as readonly string[]).includes(value);
}

/** Labels for the color picker */
export const TAG_COLOR_LABELS: Record<TagColorKey, string> = {
  red: 'Red',
  orange: 'Orange',
  purple: 'Purple',
  pink: 'Pink',
};

/** Solid fill for swatches and dots */
export const TAG_COLOR_BG: Record<TagColorKey, string> = {
  red: 'bg-red-600',
  orange: 'bg-orange-600',
  purple: 'bg-purple-600',
  pink: 'bg-pink-600',
};

/**
 * White card with a 2px outline in the tag color; grip stays neutral.
 */
export const TAG_TASK_CARD_THEME: Record<TagColorKey, { border: string; hoverBorder: string }> = {
  red: {
    border: 'border-2 border-red-600',
    hoverBorder: 'hover:border-red-700 hover:shadow-md',
  },
  orange: {
    border: 'border-2 border-orange-600',
    hoverBorder: 'hover:border-orange-700 hover:shadow-md',
  },
  purple: {
    border: 'border-2 border-purple-600',
    hoverBorder: 'hover:border-purple-700 hover:shadow-md',
  },
  pink: {
    border: 'border-2 border-pink-600',
    hoverBorder: 'hover:border-pink-700 hover:shadow-md',
  },
};
