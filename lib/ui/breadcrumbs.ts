/** Build breadcrumb trail from Next.js pathname segments. */
export function breadcrumbsFromPath(pathname: string): { label: string; href?: string }[] {
  if (pathname === '/attendance') {
    return [{ label: 'My Attendance' }];
  }
  if (pathname === '/attendance/manage') {
    return [{ label: 'My Attendance', href: '/attendance' }, { label: 'Mark Attendance' }];
  }
  if (pathname === '/attendance/employees') {
    return [{ label: 'My Attendance', href: '/attendance' }, { label: 'All Employees' }];
  }

  const segments = pathname
    .split('/')
    .filter(Boolean)
    .filter((s) => !s.startsWith('['));

  const crumbs: { label: string; href?: string }[] = [{ label: 'Blogs', href: '/' }];

  let path = '';
  for (const segment of segments) {
    path += `/${segment}`;
    const label = segment.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    crumbs.push({ label, href: path });
  }

  if (crumbs.length > 0) {
    delete crumbs[crumbs.length - 1].href;
  }

  return crumbs;
}
