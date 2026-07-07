'use client';

import { memo } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { Calendar, GripVertical, Lock, Paperclip, Users } from 'lucide-react';
import { TASK_VISIBILITY_LABELS, type TaskVisibility } from '@/lib/tasks/taskVisibility';
import type { TaskWithRelations } from '@/lib/tasks/taskRow';
import { type TagColorKey } from '@/lib/tasks/tagColors';
import {
  formatDueShort,
  getDueUrgency,
  taskHasHighPriority,
} from '@/lib/tasks/kanbanUtils';

type KanbanTaskCardProps = {
  task: TaskWithRelations;
  tagNameById: Map<string, string>;
  tagColorById: Map<string, TagColorKey>;
  userLabelById: Map<string, string>;
  isSettling: boolean;
  onOpen: (taskId: string) => void;
};

function KanbanTaskCardInner({
  task,
  tagNameById,
  tagColorById,
  userLabelById,
  isSettling,
  onOpen,
}: KanbanTaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id });
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  const urgency = getDueUrgency(task.due_at);
  const dueShort = formatDueShort(task.due_at);
  const isHighPriority = taskHasHighPriority(task.tag_ids, tagNameById);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`kanban-card ${isDragging ? 'kanban-card--dragging' : ''} ${
        isSettling ? 'kanban-card--settle' : ''
      }`}
    >
      {isHighPriority && (
        <div
          className="kanban-card-priority kanban-card-priority--high"
          aria-hidden
          title="High priority"
        />
      )}
      <button
        type="button"
        className="kanban-card-grip"
        {...listeners}
        {...attributes}
        aria-label="Drag to change column"
      >
        <GripVertical className="h-4 w-4" aria-hidden />
      </button>
      <button type="button" onClick={() => onOpen(task.id)} className="kanban-card-body">
        <p className="line-clamp-2 text-[13px] font-semibold leading-snug text-[var(--kb-ink)]">
          {task.title}
        </p>

        {task.tag_ids.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {task.tag_ids.map((tid) => {
              const colorKey = tagColorById.get(tid);
              const tagName = tagNameById.get(tid) ?? tid.slice(0, 6);
              return (
                <span
                  key={tid}
                  className={`kanban-tag ${colorKey ? `kanban-tag--${colorKey}` : ''} ${
                    tagName.toLowerCase() === 'high' ? 'kanban-tag--priority-high' : ''
                  }`}
                >
                  {tagName}
                </span>
              );
            })}
          </div>
        )}

        <div className="mt-2 flex items-center gap-1.5">
          <span
            className={`inline-flex items-center gap-0.5 text-[10px] font-medium ${
              task.visibility === 'private' ? 'text-[var(--kb-soon)]' : 'text-[var(--kb-ready)]'
            }`}
          >
            {task.visibility === 'private' && <Lock className="h-2.5 w-2.5" aria-hidden />}
            {TASK_VISIBILITY_LABELS[task.visibility as TaskVisibility]}
          </span>
          {(task.attachments?.length ?? 0) > 0 && (
            <span
              className="inline-flex items-center gap-0.5 text-[10px] font-medium text-[var(--kb-muted)]"
              title={`${task.attachments.length} document${task.attachments.length === 1 ? '' : 's'}`}
            >
              <Paperclip className="h-2.5 w-2.5" aria-hidden />
              {task.attachments.length}
            </span>
          )}
        </div>

        {dueShort && (
          <div
            className={`mt-1.5 inline-flex items-center gap-1 text-[11px] ${
              urgency === 'overdue'
                ? 'font-semibold text-[var(--kb-urgent)]'
                : urgency === 'soon'
                  ? 'font-medium text-[var(--kb-soon)]'
                  : 'text-[var(--kb-muted)]'
            }`}
          >
            <Calendar className="h-3 w-3 shrink-0" aria-hidden />
            {dueShort}
            {urgency === 'overdue' && <span className="text-[10px] uppercase tracking-wide">Overdue</span>}
          </div>
        )}

        {task.assignee_ids.length > 0 && (
          <p className="mt-2 flex items-center gap-1 truncate text-[11px] text-[var(--kb-muted)]">
            <Users className="h-3 w-3 shrink-0" aria-hidden />
            <span className="truncate">
              {task.assignee_ids.map((id) => userLabelById.get(id) ?? id).join(', ')}
            </span>
          </p>
        )}
      </button>
    </div>
  );
}

const KanbanTaskCard = memo(KanbanTaskCardInner);
export default KanbanTaskCard;
