'use client';

import { memo, type ReactNode } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { Archive, CheckCircle2, Circle, Loader2, type LucideIcon } from 'lucide-react';
import type { TaskStatus } from '@/lib/tasks/taskStatus';

const COLUMN_META: Record<
  TaskStatus,
  { icon: LucideIcon; emptyTitle: string; emptyHint: string }
> = {
  to_do: {
    icon: Circle,
    emptyTitle: 'Clear runway',
    emptyHint: 'Drag a task here when you are ready to queue it.',
  },
  in_progress: {
    icon: Loader2,
    emptyTitle: 'Nothing cooking',
    emptyHint: 'Move something here to mark it active.',
  },
  ready: {
    icon: CheckCircle2,
    emptyTitle: 'Nothing to ship',
    emptyHint: 'Tasks land here when they are ready for review.',
  },
  closed: {
    icon: Archive,
    emptyTitle: 'Archive is empty',
    emptyHint: 'Closed tasks collect here — a quiet win.',
  },
};

type KanbanColumnProps = {
  status: TaskStatus;
  label: string;
  count: number;
  children: ReactNode;
};

function KanbanColumnInner({ status, label, count, children }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: `column-${status}` });
  const meta = COLUMN_META[status];
  const Icon = meta.icon;

  return (
    <section className="kanban-column" aria-label={`${label} column`}>
      <header className={`kanban-column-header kanban-column-header--${status}`}>
        <div className="flex items-start gap-2.5 min-w-0">
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/80 border border-black/5"
            aria-hidden
          >
            <Icon className="h-4 w-4 text-[var(--kb-ink-secondary)]" strokeWidth={2.25} />
          </span>
          <div className="min-w-0 flex-1 pt-0.5">
            <h2 className="kanban-display text-[15px] font-semibold text-[var(--kb-ink)] leading-tight">
              {label}
            </h2>
            <p className="text-[11px] text-[var(--kb-muted)] mt-0.5">
              {count} {count === 1 ? 'task' : 'tasks'}
            </p>
          </div>
        </div>
      </header>
      <div
        ref={setNodeRef}
        className={`kanban-column-body ${isOver ? 'kanban-column-body--over' : ''}`}
      >
        {count === 0 ? (
          <div className="kanban-empty" role="status">
            <span className="kanban-empty-icon">
              <Icon className="h-4 w-4" strokeWidth={2} />
            </span>
            <p className="text-xs font-semibold text-[var(--kb-ink-secondary)]">{meta.emptyTitle}</p>
            <p className="text-[11px] leading-snug text-[var(--kb-muted)] max-w-[200px]">
              {meta.emptyHint}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">{children}</div>
        )}
      </div>
    </section>
  );
}

const KanbanColumn = memo(KanbanColumnInner);
export default KanbanColumn;
