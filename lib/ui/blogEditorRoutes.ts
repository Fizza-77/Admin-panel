/** True on blog create/edit pages that use the full-screen editor chrome. */
export function isBlogEditorPath(pathname: string): boolean {
  return pathname.endsWith('/blogs/create') || /\/blogs\/edit\/[^/]+$/.test(pathname);
}
