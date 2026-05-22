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
        className="ui-btn-ghost relative !min-h-9 !rounded-xl !px-2.5"
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <span className="sr-only">View task notifications</span>
        <Bell className="h-5 w-5 text-zinc-600" aria-hidden="true" />
        {unreadCount > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-indigo-600 px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="Task notifications"
          className="absolute right-0 z-50 mt-2 w-[min(100vw-1.5rem,22rem)] animate-fade-in rounded-2xl border border-zinc-200/90 bg-white shadow-card"
        >
          <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
            <p className="text-sm font-semibold text-zinc-900">Notifications</p>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => void markAllRead()}
                className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
              >
                Mark all read
              </button>
            )}
          </div>
          <ul className="max-h-72 divide-y divide-zinc-100 overflow-y-auto">
            {loading && items.length === 0 ? (
              <li className="px-4 py-4 text-sm text-zinc-500">Loading…</li>
            ) : items.length === 0 ? (
              <li className="px-4 py-6 text-center text-sm text-zinc-500">No notifications yet.</li>
            ) : (
              items.map((n) => (
                <li key={n.id} className={n.read_at ? 'bg-white' : 'bg-indigo-50/50'}>
                  <button
                    type="button"
                    className="w-full px-4 py-3 text-left transition hover:bg-zinc-50"
                    onClick={() => {
                      if (!n.read_at) {
                        void markRead([n.id]);
                      }
                      setOpen(false);
                    }}
                  >
                    <p className="text-sm font-medium text-zinc-900">{n.title}</p>
                    {n.body && <p className="mt-0.5 line-clamp-2 text-xs text-zinc-600">{n.body}</p>}
                    <p className="mt-1 text-[10px] text-zinc-400">{new Date(n.created_at).toLocaleString()}</p>
                  </button>
                </li>
              ))
            )}
          </ul>
          <div className="border-t border-zinc-100 px-4 py-2.5">
            <Link
              href="/tasks"
              onClick={() => setOpen(false)}
              className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
            >
              Open tasks board →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
