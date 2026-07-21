'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DndContext,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  TASK_STATUS_LABELS,
  TASK_STATUSES,
  canSetTaskStatus,
  isTaskStatus,
  type TaskStatus,
} from '@/lib/tasks/taskStatus';
import type { TaskWithRelations } from '@/lib/tasks/taskRow';
import {
  TAG_COLOR_BG,
  TAG_COLOR_KEYS,
  TAG_COLOR_LABELS,
  type TagColorKey,
  isTagColorKey,
} from '@/lib/tasks/tagColors';
import type { AppPermissions } from '@/lib/permissions/types';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { LoadingOverlay } from '@/components/ui/Spinner';
import { OutlineFillButtonAction, PlusIcon } from '@/components/ui/OutlineFillButton';
import { useRouteNavigation } from '@/lib/ui/routeNavigation';
import { TASKS_LOADING_MESSAGES } from '@/lib/ui/loadingMessages';
import KanbanColumn from '@/components/tasks/kanban/KanbanColumn';
import KanbanTaskCard from '@/components/tasks/kanban/KanbanTaskCard';
import KanbanToast from '@/components/tasks/kanban/KanbanToast';
import TaskModal from '@/components/tasks/kanban/TaskModal';
import { reportError } from '@/lib/monitoring';

type TagRow = { id: string; name: string; color: string };
type UserOption = { id: string; email: string | undefined; display_name: string | null; avatar_url?: string | null };

function formatUserLabel(u: UserOption) {
  const n = u.display_name?.trim();
  if (n) {
    return n;
  }
  return u.email ?? u.id.slice(0, 8);
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
  const { isNavigating } = useRouteNavigation();
  const canUseTasks = permissions.canManageTasks;
  const isSuper = canUseTasks && permissions.canAdministerTasks;
  const canAddTags = canUseTasks && permissions.canCreateTaskTags;

  const [tasks, setTasks] = useState<TaskWithRelations[]>([]);
  const [tags, setTags] = useState<TagRow[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState<string>(TASKS_LOADING_MESSAGES.start);
  const [error, setError] = useState<string | null>(null);

  const [qInput, setQInput] = useState('');
  const [q, setQ] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterTagId, setFilterTagId] = useState('');
  const [filterVisibility, setFilterVisibility] = useState<string>('');
  const [filterAssigneeId, setFilterAssigneeId] = useState('');

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<TaskWithRelations | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [settlingTaskId, setSettlingTaskId] = useState<string | null>(null);
  const [taskToDelete, setTaskToDelete] = useState<TaskWithRelations | null>(null);
  const [deletingTask, setDeletingTask] = useState(false);

  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;

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
    setLoadingMessage(TASKS_LOADING_MESSAGES.start);

    const loadState = { tasks: false, tags: false, users: false };

    const advanceMessage = () => {
      if (!loadState.tasks) {
        setLoadingMessage(TASKS_LOADING_MESSAGES.start);
      } else if (!loadState.tags) {
        setLoadingMessage(TASKS_LOADING_MESSAGES.tags);
      } else if (!loadState.users) {
        setLoadingMessage(TASKS_LOADING_MESSAGES.assignees);
      } else {
        setLoadingMessage(TASKS_LOADING_MESSAGES.building);
      }
    };

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
        fetch(`/api/tasks?${params.toString()}`, { credentials: 'include' }).then((res) => {
          loadState.tasks = true;
          advanceMessage();
          return res;
        }),
        fetch('/api/tasks/tags', { credentials: 'include' }).then((res) => {
          loadState.tags = true;
          advanceMessage();
          return res;
        }),
        fetch('/api/tasks/users', { credentials: 'include' }).then((res) => {
          loadState.users = true;
          advanceMessage();
          return res;
        }),
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

  const tasksByStatus = useMemo(() => {
    const grouped = Object.fromEntries(TASK_STATUSES.map((s) => [s, [] as TaskWithRelations[]])) as Record<
      TaskStatus,
      TaskWithRelations[]
    >;
    for (const task of tasks) {
      if (isTaskStatus(task.status)) {
        grouped[task.status].push(task);
      }
    }
    return grouped;
  }, [tasks]);

  const handleOpenTask = useCallback((taskId: string) => {
    const task = tasksRef.current.find((t) => t.id === taskId);
    if (task) {
      setEditing(task);
    }
  }, []);

  const dismissToast = useCallback(() => setToast(null), []);

  const moveStatus = useCallback(
    async (taskId: string, status: TaskStatus, previousStatus: TaskStatus) => {
      try {
        const res = await fetch(`/api/tasks/${taskId}`, {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(body?.message || 'Update failed');
        }
        const serverTask = body?.task as TaskWithRelations | undefined;
        if (serverTask?.id === taskId) {
          setTasks((prev) => prev.map((t) => (t.id === taskId ? serverTask : t)));
          setEditing((prev) => (prev?.id === taskId ? serverTask : prev));
        }
      } catch (e: unknown) {
        setTasks((prev) =>
          prev.map((t) => (t.id === taskId ? { ...t, status: previousStatus } : t)),
        );
        setEditing((prev) =>
          prev?.id === taskId ? { ...prev, status: previousStatus } : prev,
        );
        const message = e instanceof Error ? e.message : 'Could not move task';
        setToast(`Move failed — reverted. ${message}`);
        reportError(e, { source: 'TaskKanban.moveStatus', taskId });
      }
    },
    [],
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
      const task = tasksRef.current.find((t) => t.id === taskId);
      if (!task || task.status === newStatus) {
        return;
      }
      if (!canSetTaskStatus(newStatus, isSuper)) {
        setToast('You cannot close the task.');
        return;
      }
      const previousStatus = task.status as TaskStatus;

      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t)),
      );
      setEditing((prev) => (prev?.id === taskId ? { ...prev, status: newStatus } : prev));
      setSettlingTaskId(taskId);
      window.setTimeout(() => {
        setSettlingTaskId((current) => (current === taskId ? null : current));
      }, 180);

      void moveStatus(taskId, newStatus, previousStatus);
    },
    [isSuper, moveStatus],
  );

  const deleteTask = async (task: TaskWithRelations) => {
    setDeletingTask(true);
    try {
      const res = await fetch(`/api/tasks/${task.id}`, { method: 'DELETE', credentials: 'include' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.message || 'Delete failed');
      }
      setTaskToDelete(null);
      setEditing(null);
      await loadAll();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Delete failed');
      reportError(e, { source: 'TaskKanban.deleteTask', taskId: task.id });
    } finally {
      setDeletingTask(false);
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
    <div className="kanban-root space-y-6">
      <div className="kanban-filters flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
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
            className="kanban-filter-input min-w-[180px]"
            aria-label="Search tasks by title"
          />
          <OutlineFillButtonAction type="button" onClick={() => setQ(qInput.trim())}>
            Search
          </OutlineFillButtonAction>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="kanban-filter-select"
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
            className="kanban-filter-select"
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
            className="kanban-filter-select"
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
              className="kanban-filter-select max-w-[200px]"
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
                  className="kanban-filter-input w-36"
                />
                <OutlineFillButtonAction type="button" onClick={() => void createTag()}>
                  Add tag
                </OutlineFillButtonAction>
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
                        ? 'ring-2 ring-offset-2 ring-[var(--kb-ink)] scale-110'
                        : 'ring-2 ring-white/50 ring-offset-1 opacity-95 hover:opacity-100'
                    }`}
                  />
                ))}
              </div>
            </div>
          )}
          {isSuper && (
            <OutlineFillButtonAction type="button" onClick={() => setCreateOpen(true)} icon={<PlusIcon />}>
              New task
            </OutlineFillButtonAction>
          )}
        </div>
      </div>

      {error && <p className="text-sm text-[var(--kb-urgent)]">{error}</p>}

      {toast && <KanbanToast message={toast} onDismiss={dismissToast} />}

      {loading && !isNavigating && (
        <LoadingOverlay
          label={loadingMessage}
          messages={[
            loadingMessage,
            'Still fetching task data…',
            'Organizing your columns…',
            'Almost ready…',
          ]}
          rotateIntervalMs={3000}
        />
      )}

      {!loading && (
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
          <div className="kanban-board-scroll">
            <div className="kanban-board-grid">
              {TASK_STATUSES.map((status) => {
                const columnTasks = tasksByStatus[status];
                return (
                  <KanbanColumn
                    key={status}
                    status={status}
                    label={TASK_STATUS_LABELS[status]}
                    count={columnTasks.length}
                  >
                    {columnTasks.map((task) => (
                      <KanbanTaskCard
                        key={task.id}
                        task={task}
                        tagNameById={tagNameById}
                        tagColorById={tagColorById}
                        userLabelById={userLabelById}
                        isSettling={settlingTaskId === task.id}
                        onOpen={handleOpenTask}
                      />
                    ))}
                  </KanbanColumn>
                );
              })}
            </div>
          </div>
        </DndContext>
      )}

      {isSuper && createOpen && (
        <TaskModal
          mode="create"
          tags={tags}
          users={users}
          isTasksAdmin={isSuper}
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
          isTasksAdmin={isSuper}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void loadAll();
          }}
          onDelete={
            canFullyManage(editing, currentUserId, isSuper)
              ? () => setTaskToDelete(editing)
              : undefined
          }
          statusOnly={isAssigneeOnly(editing, currentUserId, isSuper)}
        />
      )}

      <ConfirmDialog
        open={taskToDelete != null}
        title="Delete task?"
        description={
          <>
            Are you sure you want to delete{' '}
            <strong>{taskToDelete?.title?.trim() || 'this task'}</strong>? This action cannot be undone.
          </>
        }
        confirmLabel="Delete task"
        cancelLabel="Cancel"
        tone="danger"
        loading={deletingTask}
        onConfirm={() => {
          if (taskToDelete) {
            void deleteTask(taskToDelete);
          }
        }}
        onCancel={() => {
          if (!deletingTask) {
            setTaskToDelete(null);
          }
        }}
      />
    </div>
  );
}
