/** Tailwind classes saved on blog HTML tables (editor + public post body). */

export const BLOG_TABLE_CLASS =
  'w-full min-w-full border-collapse my-5 text-sm leading-normal table-auto';

export const BLOG_TABLE_HEADER_CELL_CLASS =
  'border border-gray-300 bg-gray-100 px-3 py-2 text-left font-semibold text-gray-900 align-top';

export const BLOG_TABLE_BODY_CELL_CLASS =
  'border border-gray-300 bg-white px-3 py-2 text-gray-800 align-top';

/** Wrap published post HTML in this class on the public site. */
export const BLOG_POST_CONTENT_CLASS = 'blog-post-content';

/** All table-related classes — add to tailwind `safelist` so they are not purged. */
export const BLOG_TABLE_TAILWIND_SAFELIST = [
  BLOG_TABLE_CLASS,
  BLOG_TABLE_HEADER_CELL_CLASS,
  BLOG_TABLE_BODY_CELL_CLASS,
  BLOG_POST_CONTENT_CLASS,
  'overflow-x-auto',
  'my-5',
  'w-full',
  'min-w-full',
  'border-collapse',
  'table-auto',
  'border',
  'border-gray-300',
  'bg-gray-100',
  'bg-white',
  'px-3',
  'py-2',
  'text-left',
  'font-semibold',
  'text-gray-900',
  'text-gray-800',
  'align-top',
  'text-sm',
  'leading-normal',
];

export function clampTableDimension(raw: string, max: number): number {
  const n = Number.parseInt(raw.trim(), 10);
  if (!Number.isFinite(n) || n < 1) {
    return 1;
  }
  return Math.min(n, max);
}

export const TABLE_ROWS_MAX = 50;
export const TABLE_COLS_MAX = 20;
