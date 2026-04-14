function safeReturnPath(raw: string | undefined): string {
  if (!raw || typeof raw !== 'string') return '/';
  const path = raw.split('?')[0] ?? '/';
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('..')) {
    return '/';
  }
  return path;
}

/** Use for `href` on “Add site”, “Setup”, etc. Always goes through `/setup-unlock` first. */
export function setupUnlockHref(returnPath: string): string {
  return `/setup-unlock?returnUrl=${encodeURIComponent(safeReturnPath(returnPath))}`;
}