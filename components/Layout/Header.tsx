import Link from 'next/link';
import { useRouter } from 'next/router';
import { ArrowLeft, Bell } from 'lucide-react';

export default function Header() {
  const router = useRouter();
  const onRoot = router.pathname === '/';
  const pageLabel = router.pathname
    .replace('/sites', 'sites')
    .replace('/blogs', 'blogs')
    .replace(/\[|\]/g, '')
    .split('/')
    .filter(Boolean)
    .map((segment) => segment.replace(/-/g, ' '))
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' / ');

  return (
    <header className="bg-white/95 backdrop-blur border-b border-slate-200 z-10">
      <div className="flex items-start sm:items-center justify-between px-3 sm:px-6 lg:px-8 min-h-16 py-3 gap-2 sm:gap-3">
        <div className="flex items-start sm:items-center gap-1.5 sm:gap-3 min-w-0">
          {!onRoot && (
            <button
              type="button"
              onClick={() => router.back()}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 sm:px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 shrink-0"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back
            </button>
          )}
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-400 truncate">Skyen Blog Admin</p>
            <p className="text-sm font-semibold text-slate-800 truncate">{pageLabel || 'Dashboard'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <Link
            href="/"
            className="hidden sm:inline-flex rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            Dashboard
          </Link>
          <button className="bg-white p-2 rounded-full text-gray-400 hover:text-gray-500 focus:outline-none">
              <span className="sr-only">View notifications</span>
              <Bell className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden="true" />
          </button>
          <span className="inline-block h-8 w-8 sm:h-9 sm:w-9 rounded-full bg-cyan-100 flex items-center justify-center text-cyan-700 font-bold text-xs sm:text-sm">
            A
          </span>
        </div>
      </div>
    </header>
  );
}
