'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { Bell } from 'lucide-react';
import { LoadingOverlay } from '@/components/ui/Spinner';

type NotificationKind = 'task' | 'attendance';

type NotificationRow = {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string | null;
  read_at: string | null;
  created_at: string;
  href: string;
};

type TaskNotificationsProps = {
  enabled: boolean;
};

export default function TaskNotifications({ enabled }: TaskNotificationsProps) {
  const router = useRouter();
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
      const res = await fetch('/api/notifications?limit=30', { credentials: 'include' });
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

  const markRead = async (itemsToMark: Array<{ id: string; kind: NotificationKind }>) => {
    await fetch('/api/notifications', {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: itemsToMark }),
    });
    await load();
  };

  const markAllRead = async () => {
    await fetch('/api/notifications', {
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
        className="ui-btn-ghost relative !min-h-10 !rounded-[18px] !px-3"
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <span className="sr-only">View notifications</span>
        <Bell className="h-[18px] w-[18px] text-[#6B7280]" strokeWidth={1.75} aria-hidden="true" />
        {unreadCount > 0 && (
          <span className="absolute right-1.5 top-1.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-gradient-to-r from-[#5B5CEB] to-[#7C3AED] px-1 text-[10px] font-bold text-white shadow-glow">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-[min(100vw-1.5rem,22rem)] animate-fade-in">
          <div
            role="dialog"
            aria-label="Notifications"
            className="relative overflow-hidden rounded-[20px] border border-[#E5E7EB] bg-white/95 shadow-card-hover backdrop-blur-xl"
          >
            {loading && items.length === 0 && (
              <LoadingOverlay scope="local" label="Loading notifications…" size="md" className="rounded-[20px]" />
            )}
          <div className="flex items-center justify-between border-b border-[#F3F4F6] px-5 py-4">
            <p className="text-sm font-semibold text-[#111827]">Notifications</p>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => void markAllRead()}
                className="text-xs font-medium text-[#5B5CEB] transition hover:text-[#7C3AED]"
              >
                Mark all read
              </button>
            )}
          </div>
          <ul className="max-h-72 divide-y divide-[#F3F4F6] overflow-y-auto">
            {items.length === 0 ? (
              <li className="px-5 py-8 text-center text-sm text-[#6B7280]">No notifications yet.</li>
            ) : (
              items.map((n) => (
                <li key={`${n.kind}-${n.id}`} className={n.read_at ? 'bg-white' : 'bg-[#5B5CEB]/[0.04]'}>
                  <button
                    type="button"
                    className="w-full px-5 py-3.5 text-left transition hover:bg-[#F9FAFB]"
                    onClick={() => {
                      if (!n.read_at) {
                        void markRead([{ id: n.id, kind: n.kind }]);
                      }
                      setOpen(false);
                      void router.push(n.href);
                    }}
                  >
                    <p className="text-sm font-medium text-[#111827]">{n.title}</p>
                    {n.body && <p className="mt-0.5 line-clamp-2 text-xs text-[#6B7280]">{n.body}</p>}
                    <p className="mt-1.5 text-[10px] text-[#9CA3AF]">{new Date(n.created_at).toLocaleString()}</p>
                  </button>
                </li>
              ))
            )}
          </ul>
          </div>
        </div>
      )}
    </div>
  );
}
