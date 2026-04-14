import { useRouter } from 'next/router';
import Link from 'next/link';
import { LayoutDashboard, Link2, LogOut } from 'lucide-react';
import axios from 'axios';
import { setupUnlockHref } from '@/lib/setup';

export default function Sidebar() {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await axios.post('/api/logout');
      router.push('/login');
    } catch (e) {
      console.error(e);
    }
  };

  const navItems = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Add / Connect Site', href: setupUnlockHref('/sites/connect'), icon: Link2 },
  ];

  const isActiveItem = (item: { name: string; href: string }) => {
    return item.name === 'Dashboard'
      ? router.pathname === '/'
      : item.name === 'Add / Connect Site'
        ? router.pathname === '/sites/connect' || router.pathname === '/setup-unlock'
        : router.pathname === item.href ||
            (item.href !== '/' && router.pathname.startsWith(item.href));
  };

  return (
    <>
      <div className="md:hidden border-b border-slate-200 bg-white px-3 py-2">
        <div className="flex flex-wrap items-center gap-2">
          {navItems.map((item) => {
            const isActive = isActiveItem(item);
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`inline-flex min-h-10 items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-cyan-50 text-cyan-800 border-cyan-200'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <item.icon className="h-3.5 w-3.5" aria-hidden="true" />
                {item.name}
              </Link>
            );
          })}
          <button
            onClick={handleLogout}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
          >
            <LogOut className="h-3.5 w-3.5" />
            Logout
          </button>
        </div>
      </div>

      <div className="hidden md:flex md:w-72 md:flex-col bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100 border-r border-slate-800 shadow-2xl">
        <div className="flex flex-col flex-grow pt-5 overflow-y-auto">
          <div className="px-6">
            <div className="rounded-xl border border-slate-700/70 bg-slate-900/70 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Control Panel</p>
              <p className="mt-1 text-lg font-semibold text-white">Skyen Blog Admin</p>
            </div>
          </div>
          <div className="mt-8 flex-grow flex flex-col">
            <nav className="flex-1 px-4 pb-4 space-y-1">
              {navItems.map((item) => {
                const isActive = isActiveItem(item);
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`group flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                      isActive
                        ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-400/30'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white border border-transparent'
                    }`}
                  >
                    <item.icon
                      className={`flex-shrink-0 -ml-1 mr-3 h-5 w-5 ${
                        isActive ? 'text-cyan-300' : 'text-slate-400 group-hover:text-slate-200'
                      }`}
                      aria-hidden="true"
                    />
                    {item.name}
                  </Link>
                );
              })}
            </nav>
          </div>
          <div className="flex-shrink-0 flex border-t border-slate-800 p-4">
            <button
              onClick={handleLogout}
              className="flex-shrink-0 w-full group block bg-slate-900/80 p-3 rounded-lg hover:bg-red-500/15 border border-slate-700 hover:border-red-400/50 transition"
            >
              <div className="flex items-center">
                <div>
                  <LogOut className="inline-block h-5 w-5 text-slate-400 group-hover:text-red-300" />
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-slate-200 group-hover:text-red-200">Logout</p>
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
