/** Build breadcrumb trail from Next.js pathname segments. */
export function breadcrumbsFromPath(pathname: string): { label: string; href?: string }[] {
  if (pathname === '/attendance') {
    return [{ label: 'My Attendance' }];
  }
  if (pathname === '/attendance/manage') {
    return [{ label: 'My Attendance', href: '/attendance' }, { label: 'Mark Attendance' }];
  }
  if (pathname === '/employees') {
    return [{ label: 'All Employees' }];
  }
  if (pathname.startsWith('/employees/')) {
    return [{ label: 'All Employees', href: '/employees' }, { label: 'Employee Report' }];
  }
  if (pathname === '/expenses') {
    return [{ label: 'Expense tracker' }];
  }
  if (pathname === '/payroll') {
    return [{ label: 'Payroll' }];
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
