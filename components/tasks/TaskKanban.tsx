'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DndContext,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import {
  TASK_STATUS_LABELS,
  TASK_STATUSES,
  isTaskStatus,
  type TaskStatus,
} from '@/lib/tasks/taskStatus';
import { TASK_VISIBILITY_LABELS, type TaskVisibility } from '@/lib/tasks/taskVisibility';
import type { TaskWithRelations } from '@/lib/tasks/taskRow';
import {
  TAG_COLOR_BG,
  TAG_COLOR_KEYS,
  TAG_COLOR_LABELS,
  TAG_TASK_CARD_THEME,
  type TagColorKey,
  isTagColorKey,
} from '@/lib/tasks/tagColors';
import type { AppPermissions } from '@/lib/permissions/types';
import { Calendar, GripVertical, Lock, Plus, Trash2, Users, X } from 'lucide-react';
import { KanbanSkeleton } from '@/components/ui/Skeleton';
import PageHeader from '@/components/ui/PageHeader';
import { format } from 'date-fns';
import { reportError } from '@/lib/monitoring';

type TagRow = { id: string; name: string; color: string };
type UserOption = { id: string; email: string | undefined; display_name: string | null };

function formatUserLabel(u: UserOption) {
  const n = u.display_name?.trim();
  if (n) {
    return n;
  }
  return u.email ?? u.id.slice(0, 8);
}

function formatTaskDueReadOnly(iso: string | null | undefined) {
  if (!iso) {
    return <span className="text-slate-400">No due date</span>;
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return <span className="text-slate-400">Invalid date</span>;
  }
  return format(d, 'MMM d, yyyy h:mm a');
}

/** Column header accent; body stays neutral for readability */
const TASK_STATUS_COLUMN_THEME: Record<
  TaskStatus,
  {
    shell: string;
    header: string;
    title: string;
    sub: string;
    body: string;
    dropOver: string;
    dot: string;
  }
> = {
  to_do: {
    shell: 'border-zinc-200/90 shadow-sm',
    header: 'border-b border-zinc-200/80 bg-white',
    title: 'text-zinc-900',
    sub: 'text-zinc-500',
    body: 'bg-zinc-50/80',
    dropOver: 'ring-2 ring-indigo-400/40 ring-inset rounded-b-2xl bg-indigo-50/60',
    dot: 'bg-zinc-400',
  },
  in_progress: {
    shell: 'border-zinc-200/90 shadow-sm',
    header: 'border-b border-indigo-100 bg-indigo-50/90',
    title: 'text-indigo-950',
    sub: 'text-indigo-600/90',
    body: 'bg-zinc-50/80',
    dropOver: 'ring-2 ring-indigo-400/50 ring-inset rounded-b-2xl bg-indigo-50/70',
    dot: 'bg-indigo-500',
  },
  ready: {
    shell: 'border-zinc-200/90 shadow-sm',
    header: 'border-b border-emerald-100 bg-emerald-50/90',
    title: 'text-emerald-950',
    sub: 'text-emerald-700/90',
    body: 'bg-zinc-50/80',
    dropOver: 'ring-2 ring-emerald-400/45 ring-inset rounded-b-2xl bg-emerald-50/70',
    dot: 'bg-emerald-500',
  },
  closed: {
    shell: 'border-zinc-200/90 shadow-sm',
    header: 'border-b border-amber-100 bg-amber-50/90',
    title: 'text-amber-950',
    sub: 'text-amber-700/90',
    body: 'bg-zinc-50/80',
    dropOver: 'ring-2 ring-amber-400/50 ring-inset rounded-b-2xl bg-amber-50/70',
    dot: 'bg-amber-500',
  },
};

function KanbanColumn({
  status,
  label,
  count,
  children,
}: {
  status: TaskStatus;
  label: string;
  count: number;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `column-${status}` });
  const theme = TASK_STATUS_COLUMN_THEME[status];
  return (
    <section
      className={`ui-kanban-column min-h-[28rem] ${theme.shell}`}
      aria-label={`${label} column`}
    >
      <div className={`sticky top-0 z-[1] rounded-t-2xl px-3 py-3 ${theme.header}`}>
        <div className="flex items-center gap-2 min-w-0">
          <span className={`h-2 w-2 shrink-0 rounded-full ${theme.dot}`} aria-hidden />
          <div className="min-w-0 flex-1">
            <h2 className={`text-sm font-semibold tracking-tight ${theme.title}`}>{label}</h2>
            <p className={`text-xs mt-0.5 ${theme.sub}`}>
              {count} {count === 1 ? 'task' : 'tasks'}
            </p>
          </div>
          <span className={`rounded-lg px-2 py-0.5 text-xs font-medium tabular-nums ${theme.sub} bg-white/60`}>
            {count}
          </span>
        </div>
      </div>
      <div
        ref={setNodeRef}
        className={`flex-1 space-y-2 overflow-y-auto p-2.5 max-h-[calc(100vh-12rem)] min-h-[8rem] rounded-b-2xl ${theme.body} ${
          isOver ? theme.dropOver : ''
        }`}
      >
        {children}
        {count === 0 && (
          <p className="px-2 py-8 text-center text-xs text-zinc-400" role="status">
            Drop tasks here
          </p>
        )}
      </div>
    </section>
  );
}

function DraggableTaskCard({
  task,
  tagNameById,
  tagColorById,
  userLabelById,
  onOpen,
}: {
  task: TaskWithRelations;
  tagNameById: Map<string, string>;
  tagColorById: Map<string, TagColorKey>;
  userLabelById: Map<string, string>;
  onOpen: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id });
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  const firstTagId = task.tag_ids[0];
  const accentKey = firstTagId ? tagColorById.get(firstTagId) : undefined;
  const theme = accentKey ? TAG_TASK_CARD_THEME[accentKey] : null;

  const dueDate = task.due_at ? new Date(task.due_at) : null;
  const dueSoon =
    dueDate && !Number.isNaN(dueDate.getTime()) && dueDate.getTime() - Date.now() < 48 * 60 * 60 * 1000;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`ui-kanban-card ${
        theme ? `${theme.border} ${theme.hoverBorder}` : ''
      } ${isDragging ? 'ui-kanban-card-dragging' : ''}`}
    >
      <button
        type="button"
        className="shrink-0 touch-none cursor-grab border-r border-zinc-100 bg-zinc-50/90 px-1.5 py-3 text-zinc-400 transition active:cursor-grabbing hover:text-zinc-600"
        {...listeners}
        {...attributes}
        aria-label="Drag to change column"
      >
        <GripVertical className="h-4 w-4" aria-hidden />
      </button>
      <button type="button" onClick={onOpen} className="min-w-0 flex-1 p-3 text-left">
        <p className="line-clamp-2 text-sm font-medium leading-snug text-zinc-900">{task.title}</p>
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <span
            className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
              task.visibility === 'private'
                ? 'bg-amber-50 text-amber-800 ring-1 ring-amber-200/80'
                : 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200/80'
            }`}
          >
            {task.visibility === 'private' && <Lock className="h-2.5 w-2.5" aria-hidden />}
            {TASK_VISIBILITY_LABELS[task.visibility as TaskVisibility]}
          </span>
          {dueDate && !Number.isNaN(dueDate.getTime()) && (
            <span
              className={`inline-flex items-center gap-0.5 text-[10px] ${
                dueSoon ? 'font-medium text-amber-700' : 'text-zinc-500'
              }`}
            >
              <Calendar className="h-2.5 w-2.5" aria-hidden />
              {format(dueDate, 'MMM d')}
            </span>
          )}
        </div>
        {task.tag_ids.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {task.tag_ids.map((tid) => {
              const colorKey = tagColorById.get(tid);
              const pillBg = colorKey ? TAG_COLOR_BG[colorKey] : 'bg-zinc-100';
              return (
                <span
                  key={tid}
                  className={`rounded-md px-1.5 py-0.5 text-[10px] font-medium text-zinc-800 ring-1 ring-black/5 ${pillBg}`}
                >
                  {tagNameById.get(tid) ?? tid.slice(0, 6)}
                </span>
              );
            })}
          </div>
        )}
        {task.assignee_ids.length > 0 && (
          <p className="mt-2 flex items-center gap-1 truncate text-[10px] text-zinc-500">
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

type TaskKanbanProps = {
  permissions: AppPermissions;
  currentUserId: string;
};

function canFullyManage(task: TaskWithRelations, currentUserId: string, isSuper: boolean) {
  return isSuper || task.created_by === currentUserId;
}

function isAssigneeOnly(task: TaskWithRelations, currentUserId: string, isSuper: boolean) {
  if (isSuper || task.created_by === currentUserId) {
    return false;
  }
  return task.assignee_ids.includes(currentUserId);
}

export default function TaskKanban({ permissions, currentUserId }: TaskKanbanProps) {
  const isSuper = permissions.canAdministerTasks;
  const canAddTags = permissions.canCreateTaskTags;

  const [tasks, setTasks] = useState<TaskWithRelations[]>([]);
  const [tags, setTags] = useState<TagRow[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [qInput, setQInput] = useState('');
  const [q, setQ] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterTagId, setFilterTagId] = useState('');
  const [filterVisibility, setFilterVisibility] = useState<string>('');
  const [filterAssigneeId, setFilterAssigneeId] = useState('');

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<TaskWithRelations | null>(null);

  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState<TagColorKey>('red');

  useEffect(() => {
    if (!isSuper) {
      setCreateOpen(false);
    }
  }, [isSuper]);

  const loadAll = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q.trim()) {
        params.set('q', q.trim());
      }
      if (filterStatus) {
        params.set('status', filterStatus);
      }
      if (filterTagId) {
        params.set('tag_id', filterTagId);
      }
      if (filterVisibility) {
        params.set('visibility', filterVisibility);
      }
      if (filterAssigneeId && isSuper) {
        params.set('assigned_user_id', filterAssigneeId);
      }

      const [tRes, tagRes, uRes] = await Promise.all([
        fetch(`/api/tasks?${params.toString()}`, { credentials: 'include' }),
        fetch('/api/tasks/tags', { credentials: 'include' }),
        fetch('/api/tasks/users', { credentials: 'include' }),
      ]);

      const tBody = await tRes.json().catch(() => ({}));
      const tagBody = await tagRes.json().catch(() => ({}));
      const uBody = await uRes.json().catch(() => ({}));

      if (!tRes.ok) {
        throw new Error(tBody?.message || 'Failed to load tasks');
      }
      if (!tagRes.ok) {
        throw new Error(tagBody?.message || 'Failed to load tags');
      }
      if (!uRes.ok) {
        throw new Error(uBody?.message || 'Failed to load users');
      }

      setTasks(Array.isArray(tBody.tasks) ? tBody.tasks : []);
      setTags(Array.isArray(tagBody.tags) ? tagBody.tags : []);
      setUsers(Array.isArray(uBody.users) ? uBody.users : []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load');
      reportError(e, { source: 'TaskKanban.loadAll' });
    } finally {
      setLoading(false);
    }
  }, [q, filterStatus, filterTagId, filterVisibility, filterAssigneeId, isSuper]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const userLabelById = useMemo(() => {
    const m = new Map<string, string>();
    for (const u of users) {
      m.set(u.id, formatUserLabel(u));
    }
    return m;
  }, [users]);

  const tagNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of tags) {
      m.set(t.id, t.name);
    }
    return m;
  }, [tags]);

  const tagColorById = useMemo(() => {
    const m = new Map<string, TagColorKey>();
    for (const t of tags) {
      if (isTagColorKey(t.color)) {
        m.set(t.id, t.color);
      }
    }
    return m;
  }, [tags]);

  const moveStatus = useCallback(
    async (task: TaskWithRelations, status: TaskStatus) => {
      try {
        const res = await fetch(`/api/tasks/${task.id}`, {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(body?.message || 'Update failed');
        }
        await loadAll();
      } catch (e: unknown) {
        alert(e instanceof Error ? e.message : 'Update failed');
        reportError(e, { source: 'TaskKanban.moveStatus', taskId: task.id });
      }
    },
    [loadAll],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over) {
        return;
      }
      const taskId = String(active.id);
      const overId = String(over.id);
      if (!overId.startsWith('column-')) {
        return;
      }
      const newStatus = overId.replace('column-', '');
      if (!isTaskStatus(newStatus)) {
        return;
      }
      const task = tasks.find((t) => t.id === taskId);
      if (!task || task.status === newStatus) {
        return;
      }
      void moveStatus(task, newStatus);
    },
    [tasks, moveStatus],
  );

  const deleteTask = async (task: TaskWithRelations) => {
    if (!confirm(`Delete “${task.title}”?`)) {
      return;
    }
    try {
      const res = await fetch(`/api/tasks/${task.id}`, { method: 'DELETE', credentials: 'include' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.message || 'Delete failed');
      }
      setEditing(null);
      await loadAll();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Delete failed');
      reportError(e, { source: 'TaskKanban.deleteTask', taskId: task.id });
    }
  };

  const createTag = async () => {
    const name = newTagName.trim();
    if (!name) {
      return;
    }
    try {
      const res = await fetch('/api/tasks/tags', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, color: newTagColor }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.message || 'Could not create tag');
      }
      setNewTagName('');
      await loadAll();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Could not create tag');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tasks"
        description="Drag cards between columns to update status. Use filters to narrow your board."
        breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Tasks' }]}
      />
      <div className="ui-surface-elevated flex flex-col gap-3 p-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-wrap gap-2 items-center">
          <input
            type="search"
            placeholder="Search title…"
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setQ(qInput.trim());
              }
            }}
            className="ui-input min-w-[180px]"
            aria-label="Search tasks by title"
          />
          <button
            type="button"
            onClick={() => setQ(qInput.trim())}
            className="ui-btn-secondary"
          >
            Search
          </button>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="ui-select"
            aria-label="Filter by status"
          >
            <option value="">All statuses</option>
            {TASK_STATUSES.map((s) => (
              <option key={s} value={s}>
                {TASK_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
          <select
            value={filterTagId}
            onChange={(e) => setFilterTagId(e.target.value)}
            className="ui-select"
            aria-label="Filter by tag"
          >
            <option value="">All tags</option>
            {tags.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <select
            value={filterVisibility}
            onChange={(e) => setFilterVisibility(e.target.value)}
            className="ui-select"
            aria-label="Filter by visibility"
          >
            <option value="">All visibility</option>
            <option value="private">Private</option>
            <option value="workspace">Workspace</option>
          </select>
          {isSuper && (
            <select
              value={filterAssigneeId}
              onChange={(e) => setFilterAssigneeId(e.target.value)}
              className="ui-select max-w-[200px]"
              aria-label="Filter by assignee"
            >
              <option value="">All assignees</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {formatUserLabel(u)}
                </option>
              ))}
            </select>
          )}
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          {canAddTags && (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:flex-wrap">
              <div className="flex gap-1 items-center">
                <input
                  type="text"
                  placeholder="New tag name"
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm w-36"
                />
                <button
                  type="button"
                  onClick={() => void createTag()}
                  className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Add tag
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Tag color">
                {TAG_COLOR_KEYS.map((key) => (
                  <button
                    key={key}
                    type="button"
                    title={TAG_COLOR_LABELS[key]}
                    onClick={() => setNewTagColor(key)}
                    className={`h-6 w-6 rounded-full transition ${TAG_COLOR_BG[key]} ${
                      newTagColor === key
                        ? 'ring-2 ring-offset-2 ring-slate-900 scale-110'
                        : 'ring-2 ring-white/50 ring-offset-1 opacity-95 hover:opacity-100'
                    }`}
                  />
                ))}
              </div>
            </div>
          )}
          {isSuper && (
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="ui-btn-primary"
            >
              <Plus className="h-4 w-4" />
              New task
            </button>
          )}
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {loading ? (
        <KanbanSkeleton />
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4 min-h-[28rem]">
            {TASK_STATUSES.map((status) => {
              const columnTasks = tasks.filter((t) => t.status === status);
              return (
                <KanbanColumn
                  key={status}
                  status={status}
                  label={TASK_STATUS_LABELS[status]}
                  count={columnTasks.length}
                >
                  {columnTasks.map((task) => (
                    <DraggableTaskCard
                      key={task.id}
                      task={task}
                      tagNameById={tagNameById}
                      tagColorById={tagColorById}
                      userLabelById={userLabelById}
                      onOpen={() => setEditing(task)}
                    />
                  ))}
                </KanbanColumn>
              );
            })}
          </div>
        </DndContext>
      )}

      {isSuper && createOpen && (
        <TaskModal
          mode="create"
          tags={tags}
          users={users}
          onClose={() => setCreateOpen(false)}
          onSaved={() => {
            setCreateOpen(false);
            void loadAll();
          }}
        />
      )}

      {editing && (
        <TaskModal
          mode="edit"
          task={editing}
          tags={tags}
          users={users}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void loadAll();
          }}
          onDelete={canFullyManage(editing, currentUserId, isSuper) ? () => void deleteTask(editing) : undefined}
          statusOnly={isAssigneeOnly(editing, currentUserId, isSuper)}
        />
      )}
    </div>
  );
}

function TaskModal({
  mode,
  task,
  tags,
  users,
  onClose,
  onSaved,
  onDelete,
  statusOnly,
}: {
  mode: 'create' | 'edit';
  task?: TaskWithRelations;
  tags: TagRow[];
  users: UserOption[];
  onClose: () => void;
  onSaved: () => void;
  onDelete?: () => void;
  statusOnly?: boolean;
}) {
  const [title, setTitle] = useState(task?.title ?? '');
  const [description, setDescription] = useState(task?.description ?? '');
  const [status, setStatus] = useState<TaskStatus>((task?.status as TaskStatus) ?? 'to_do');
  const [visibility, setVisibility] = useState<TaskVisibility>(
    (task?.visibility as TaskVisibility) ?? 'private',
  );
  const [dueAt, setDueAt] = useState(() => {
    if (!task?.due_at) {
      return '';
    }
    try {
      const d = new Date(task.due_at);
      if (Number.isNaN(d.getTime())) {
        return '';
      }
      return format(d, "yyyy-MM-dd'T'HH:mm");
    } catch {
      return '';
    }
  });
  const [assigneeIds, setAssigneeIds] = useState<string[]>(task?.assignee_ids ?? []);
  const [tagIds, setTagIds] = useState<string[]>(task?.tag_ids ?? []);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const toggleAssignee = (id: string) => {
    setAssigneeIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleTag = (id: string) => {
    setTagIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setSaving(true);
    try {
      if (statusOnly && task) {
        const res = await fetch(`/api/tasks/${task.id}`, {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(body?.message || 'Save failed');
        }
        onSaved();
        return;
      }

      const duePayload = dueAt.trim() ? new Date(dueAt).toISOString() : null;

      if (mode === 'create') {
        const res = await fetch('/api/tasks', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title,
            description: description.trim() || null,
            status,
            visibility,
            due_at: duePayload,
            assignee_ids: assigneeIds,
            tag_ids: tagIds,
          }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(body?.message || 'Create failed');
        }
        onSaved();
        return;
      }

      if (task) {
        const res = await fetch(`/api/tasks/${task.id}`, {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title,
            description: description.trim() || null,
            status,
            visibility,
            due_at: duePayload,
            assignee_ids: assigneeIds,
            tag_ids: tagIds,
          }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(body?.message || 'Save failed');
        }
        onSaved();
      }
    } catch (ex: unknown) {
      setErr(ex instanceof Error ? ex.message : 'Request failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto border border-slate-200">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h2 className="text-lg font-semibold text-slate-900">
            {mode === 'create' ? 'New task' : statusOnly ? 'Task' : 'Edit task'}
          </h2>
          <button type="button" onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100">
            <X className="h-5 w-5 text-slate-600" />
          </button>
        </div>
        <form onSubmit={(e) => void submit(e)} className="p-4 space-y-4">
          {err && <p className="text-sm text-red-600">{err}</p>}

          {statusOnly && task ? (
            <>
              <div>
                <span className="text-xs font-medium text-slate-700">Title</span>
                <p className="mt-1 text-sm font-medium text-slate-900">{task.title}</p>
              </div>
              <div>
                <span className="text-xs font-medium text-slate-700">Description</span>
                <div className="mt-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 whitespace-pre-wrap min-h-[4.5rem]">
                  {task.description?.trim() ? (
                    task.description
                  ) : (
                    <span className="text-slate-400 italic">No description</span>
                  )}
                </div>
              </div>
              <div>
                <span className="text-xs font-medium text-slate-700">Due</span>
                <p className="mt-1 text-sm text-slate-900">{formatTaskDueReadOnly(task.due_at)}</p>
              </div>
              <label className="block">
                <span className="text-xs font-medium text-slate-700">Status</span>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as TaskStatus)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  {TASK_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {TASK_STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
              </label>
              <p className="text-xs text-slate-500">
                You can update the status. Title, description, and due date are set by the creator.
              </p>
            </>
          ) : !statusOnly ? (
            <>
              <label className="block">
                <span className="text-xs font-medium text-slate-700">Title</span>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-slate-700">Description</span>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-medium text-slate-700">Status</span>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as TaskStatus)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  >
                    {TASK_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {TASK_STATUS_LABELS[s]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-slate-700">Visibility</span>
                  <select
                    value={visibility}
                    onChange={(e) => setVisibility(e.target.value as TaskVisibility)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="private">Private (creator + assignees + admins)</option>
                    <option value="workspace">Workspace (everyone with task access)</option>
                  </select>
                </label>
              </div>
              <label className="block">
                <span className="text-xs font-medium text-slate-700">Due</span>
                <input
                  type="datetime-local"
                  value={dueAt}
                  onChange={(e) => setDueAt(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </label>
              <div>
                <span className="text-xs font-medium text-slate-700">Assignees</span>
                <div className="mt-1 max-h-28 overflow-y-auto rounded-lg border border-slate-200 p-2 space-y-1">
                  {users.map((u) => (
                    <label key={u.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={assigneeIds.includes(u.id)}
                        onChange={() => toggleAssignee(u.id)}
                        />
                        {formatUserLabel(u)}
                      </label>
                    ))}
                </div>
              </div>
              <div>
                <span className="text-xs font-medium text-slate-700">Tags</span>
                <div className="mt-1 max-h-28 overflow-y-auto rounded-lg border border-slate-200 p-2 space-y-1">
                  {tags.map((t) => (
                    <label key={t.id} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={tagIds.includes(t.id)} onChange={() => toggleTag(t.id)} />
                      <span
                        className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${
                          isTagColorKey(t.color) ? TAG_COLOR_BG[t.color] : 'bg-slate-300'
                        }`}
                        aria-hidden
                      />
                      {t.name}
                    </label>
                  ))}
                  {tags.length === 0 && <p className="text-xs text-slate-500">No tags yet.</p>}
                </div>
              </div>
            </>
          ) : null}

          <div className="flex flex-wrap gap-2 justify-between pt-2">
            <div>
              {onDelete && (
                <button
                  type="button"
                  onClick={onDelete}
                  className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 hover:bg-red-100"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-700 disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
