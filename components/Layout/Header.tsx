import { Menu, Bell } from 'lucide-react';

export default function Header() {
  return (
    <header className="bg-white shadow-sm border-b border-gray-200 z-10">
      <div className="flex-1 flex justify-between px-4 sm:px-6 lg:px-8 h-16">
        <div className="flex items-center md:hidden">
          <button
            type="button"
            className="-ml-0.5 -mt-0.5 h-12 w-12 inline-flex items-center justify-center rounded-md text-gray-500 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
          >
            <span className="sr-only">Open sidebar</span>
            <Menu className="h-6 w-6" aria-hidden="true" />
          </button>
        </div>
        <div className="flex-1 flex justify-end">
          <div className="ml-4 flex items-center md:ml-6 space-x-4">
            <button className="bg-white p-1 rounded-full text-gray-400 hover:text-gray-500 focus:outline-none">
              <span className="sr-only">View notifications</span>
              <Bell className="h-6 w-6" aria-hidden="true" />
            </button>
            <div className="flex items-center">
              <span className="inline-block h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold">
                A
              </span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
