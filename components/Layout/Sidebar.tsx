import { useRouter } from 'next/router';
import Link from 'next/link';
import { LayoutDashboard, FileText, LogOut } from 'lucide-react';
import axios from 'axios';

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
    { name: 'Blogs Management', href: '/blogs', icon: FileText },
  ];

  return (
    <div className="hidden md:flex md:w-64 md:flex-col bg-white border-r border-gray-200 shadow-sm">
      <div className="flex flex-col flex-grow pt-5 overflow-y-auto">
        <div className="flex items-center flex-shrink-0 px-6 font-bold text-2xl text-blue-600 tracking-tight">
          Admin
        </div>
        <div className="mt-8 flex-grow flex flex-col">
          <nav className="flex-1 px-4 pb-4 space-y-1">
            {navItems.map((item) => {
              const isActive = router.pathname === item.href || (item.href !== '/' && router.pathname.startsWith(item.href));
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`group flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                    isActive
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <item.icon
                    className={`flex-shrink-0 -ml-1 mr-3 h-5 w-5 ${
                      isActive ? 'text-blue-700' : 'text-gray-400 group-hover:text-gray-500'
                    }`}
                    aria-hidden="true"
                  />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex-shrink-0 flex border-t border-gray-200 p-4">
          <button
            onClick={handleLogout}
            className="flex-shrink-0 w-full group block bg-gray-50 p-3 rounded-lg hover:bg-red-50 transition"
          >
            <div className="flex items-center">
              <div>
                <LogOut className="inline-block h-5 w-5 text-gray-400 group-hover:text-red-500" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-700 group-hover:text-red-700">Logout</p>
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
