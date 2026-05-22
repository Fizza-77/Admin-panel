import {
  BLOG_POST_CONTENT_CLASS,
  BLOG_TABLE_BODY_CELL_CLASS,
  BLOG_TABLE_CLASS,
  BLOG_TABLE_HEADER_CELL_CLASS,
} from './blogTableTailwind';

/**
 * On your public blog page (e.g. Studiely), wrap post HTML:
 * `<div class="${BLOG_POST_CONTENT_CLASS}">...</div>`
 * Tailwind classes are already on each `<table>`, `<th>`, and `<td>` from the editor.
 * Add `overflow-x-auto` on the wrapper for small screens if needed.
 */
export const BLOG_POST_CONTENT_WRAPPER_CLASS = `${BLOG_POST_CONTENT_CLASS} overflow-x-auto max-w-none`;

export const BLOG_TABLE_CLASSES = {
  table: BLOG_TABLE_CLASS,
  th: BLOG_TABLE_HEADER_CELL_CLASS,
  td: BLOG_TABLE_BODY_CELL_CLASS,
} as const;
