'use client';

import { useEffect } from 'react';

type KanbanToastProps = {
  message: string;
  onDismiss: () => void;
  durationMs?: number;
};

export default function KanbanToast({ message, onDismiss, durationMs = 4500 }: KanbanToastProps) {
  useEffect(() => {
    const timer = window.setTimeout(onDismiss, durationMs);
    return () => window.clearTimeout(timer);
  }, [message, onDismiss, durationMs]);

  return (
    <div className="kanban-toast" role="alert" aria-live="assertive">
      {message}
    </div>
  );
}
