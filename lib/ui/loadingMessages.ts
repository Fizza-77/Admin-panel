function routePath(url: string) {
  return url.split('?')[0].split('#')[0];
}

const LONG_WAIT_HINTS = [
  'Still working on it…',
  'First visit may take a moment while the page prepares…',
  'Almost there…',
];

/** Contextual messages while navigating between pages. */
export function getRouteLoadingMessages(
  url: string | null,
  options?: { loggingOut?: boolean },
): string[] {
  if (!url) {
    return ['Loading page…', ...LONG_WAIT_HINTS];
  }

  const path = routePath(url);

  if (path === '/' || path === '') {
    return ['Loading dashboard…', 'Fetching connected sites…', ...LONG_WAIT_HINTS];
  }

  if (path === '/tasks' || path.startsWith('/tasks/')) {
    return ['Opening tasks board…', 'Preparing your workspace…', ...LONG_WAIT_HINTS];
  }

  if (path === '/admin/users' || path.startsWith('/admin/')) {
    return ['Loading user management…', 'Fetching team accounts…', ...LONG_WAIT_HINTS];
  }

  if (path === '/settings') {
    return ['Opening profile settings…', ...LONG_WAIT_HINTS];
  }

  if (path === '/sites/connect' || path === '/setup-unlock') {
    return ['Opening site setup…', ...LONG_WAIT_HINTS];
  }

  if (path.includes('/blogs/create')) {
    return ['Opening blog editor…', 'Preparing the form…', ...LONG_WAIT_HINTS];
  }

  if (path.includes('/blogs/edit')) {
    return ['Loading blog…', 'Preparing editor…', ...LONG_WAIT_HINTS];
  }

  if (path === '/attendance' || path.startsWith('/attendance/')) {
    if (path === '/attendance/manage') {
      return ['Opening mark attendance…', 'Loading team calendar…', ...LONG_WAIT_HINTS];
    }
    if (path === '/attendance/employees') {
      return ['Opening all employees…', 'Loading team roster…', ...LONG_WAIT_HINTS];
    }
    return ['Opening your attendance…', 'Loading records…', ...LONG_WAIT_HINTS];
  }

  if (path.includes('/blogs')) {
    return ['Loading blogs…', 'Fetching posts…', ...LONG_WAIT_HINTS];
  }

  if (path.includes('/categories')) {
    return ['Loading categories…', ...LONG_WAIT_HINTS];
  }

  if (path.includes('/setup') || path.includes('/recover')) {
    return ['Loading site settings…', ...LONG_WAIT_HINTS];
  }

  if (path.startsWith('/sites')) {
    return ['Loading site…', ...LONG_WAIT_HINTS];
  }

  if (path === '/login') {
    if (options?.loggingOut) {
      return ['Logging you out…', ...LONG_WAIT_HINTS];
    }
    return ['Opening sign in…', ...LONG_WAIT_HINTS];
  }

  return ['Loading page…', ...LONG_WAIT_HINTS];
}

/** Messages while the tasks board fetches its data. */
export const TASKS_LOADING_MESSAGES = {
  start: 'Loading tasks…',
  tags: 'Loading tags…',
  assignees: 'Loading assignees…',
  building: 'Building your board…',
} as const;
