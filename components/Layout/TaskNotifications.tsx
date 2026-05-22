'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Bell } from 'lucide-react';

type NotificationRow = {
  id: string;
  task_id: string;
  title: string;
  body: string | null;
  read_at: string | null;
  created_at: string;
};

type TaskNotificationsProps = {
  enabled: boolean;
};

export default function TaskNotifications({ enabled }: TaskNotificationsProps) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (!enabled) {
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/tasks/notifications?limit=30', { credentials: 'include' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        return;
      }
      setItems(Array.isArray(body.notifications) ? body.notifications : []);
      setUnreadCount(typeof body.unreadCount === 'number' ? body.unreadCount : 0);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void load();
    const interval = setInterval(() => void load(), 60_000);
    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onDoc = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const markRead = async (ids: string[]) => {
    await fetch('/api/tasks/notifications', {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    });
    await load();
  };

  const markAllRead = async () => {
    await fetch('/api/tasks/notifications', {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mark_all: true }),
    });
    await load();
  };

  if (!enabled) {
    return null;
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative bg-white p-2 rounded-full text-gray-400 hover:text-gray-500 focus:outline-none"
        aria-expanded={open}
        aria-haspopup="true"
      >
        <span className="sr-only">View task notifications</span>
        <Bell className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden="true" />
        {unreadCount > 0 && (
          <span className="absolute top-0.5 right-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-[min(100vw-1.5rem,22rem)] rounded-xl border border-slate-200 bg-white shadow-lg z-50">
          <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
            <p className="text-sm font-semibold text-slate-800">Task notifications</p>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => void markAllRead()}
                className="text-xs font-medium text-cyan-700 hover:text-cyan-800"
              >
                Mark all read
              </button>
            )}
          </div>
          <ul className="max-h-72 overflow-y-auto divide-y divide-slate-100">
            {loading && items.length === 0 ? (
              <li className="px-3 py-4 text-sm text-slate-500">Loading…</li>
            ) : items.length === 0 ? (
              <li className="px-3 py-4 text-sm text-slate-500">No notifications yet.</li>
            ) : (
              items.map((n) => (
                <li key={n.id} className={n.read_at ? 'bg-white' : 'bg-cyan-50/40'}>
                  <button
                    type="button"
                    className="w-full text-left px-3 py-2.5 hover:bg-slate-50"
                    onClick={() => {
                      if (!n.read_at) {
                        void markRead([n.id]);
                      }
                      setOpen(false);
                    }}
                  >
                    <p className="text-sm font-medium text-slate-900">{n.title}</p>
                    {n.body && <p className="text-xs text-slate-600 mt-0.5 line-clamp-2">{n.body}</p>}
                    <p className="text-[10px] text-slate-400 mt-1">
                      {new Date(n.created_at).toLocaleString()}
                    </p>
                  </button>
                </li>
              ))
            )}
          </ul>
          <div className="border-t border-slate-100 px-3 py-2">
            <Link
              href="/tasks"
              onClick={() => setOpen(false)}
              className="text-xs font-medium text-cyan-700 hover:text-cyan-800"
            >
              Open tasks board →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
