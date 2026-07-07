'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { format } from 'date-fns';
import { Calendar, Globe, Lock, Trash2, X } from 'lucide-react';
import {
  TASK_STATUS_LABELS,
  TASK_STATUSES,
  type TaskStatus,
} from '@/lib/tasks/taskStatus';
import { TASK_VISIBILITY_LABELS, type TaskVisibility } from '@/lib/tasks/taskVisibility';
import type { TaskWithRelations } from '@/lib/tasks/taskRow';
import {
  TAG_COLOR_BG,
  isTagColorKey,
  type TagColorKey,
} from '@/lib/tasks/tagColors';
import {
  isHighPriorityTagName,
  joinDatetimeLocalValue,
  splitDatetimeLocalValue,
} from '@/lib/tasks/kanbanUtils';
import { LoadingOverlay } from '@/components/ui/Spinner';
import { OutlineFillButtonAction } from '@/components/ui/OutlineFillButton';
import TaskAttachmentsField from '@/components/tasks/kanban/TaskAttachmentsField';
import UserAvatar from '@/components/ui/UserAvatar';
import { cn } from '@/lib/ui/cn';
import type { PendingTaskAttachment } from '@/lib/tasks/taskAttachments';

type TagRow = { id: string; name: string; color: string };
type UserOption = {
  id: string;
  email: string | undefined;
  display_name: string | null;
  avatar_url?: string | null;
};

function formatUserLabel(u: UserOption) {
  const n = u.display_name?.trim();
  if (n) {
    return n;
  }
  return u.email ?? u.id.slice(0, 8);
}

function formatTaskDueReadOnly(iso: string | null | undefined) {
  if (!iso) {
    return 'No due date';
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return 'Invalid date';
  }
  return format(d, 'MMM d, yyyy h:mm a');
}

function useFocusTrap(active: boolean, containerRef: React.RefObject<HTMLElement | null>, onClose: () => void) {
  useEffect(() => {
    if (!active || !containerRef.current) {
      return;
    }

    const root = containerRef.current;
    const selector =
      'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

    const getFocusable = () =>
      Array.from(root.querySelectorAll<HTMLElement>(selector)).filter(
        (el) => !el.hasAttribute('disabled') && el.offsetParent !== null,
      );

    const previous = document.activeElement as HTMLElement | null;
    getFocusable()[0]?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab') {
        return;
      }
      const focusable = getFocusable();
      if (focusable.length === 0) {
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previous?.focus();
    };
  }, [active, containerRef, onClose]);
}

type TaskModalProps = {
  mode: 'create' | 'edit';
  task?: TaskWithRelations;
  tags: TagRow[];
  users: UserOption[];
  onClose: () => void;
  onSaved: () => void;
  onDelete?: () => void;
  statusOnly?: boolean;
};

export default function TaskModal({
  mode,
  task,
  tags,
  users,
  onClose,
  onSaved,
  onDelete,
  statusOnly,
}: TaskModalProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

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
  const [keptAttachmentIds, setKeptAttachmentIds] = useState<string[]>(
    () => task?.attachments?.map((a) => a.id) ?? [],
  );
  const [pendingAttachments, setPendingAttachments] = useState<PendingTaskAttachment[]>([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const { date: dueDate, time: dueTime } = splitDatetimeLocalValue(dueAt);

  useFocusTrap(true, panelRef, onClose);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const toggleAssignee = (id: string) => {
    setAssigneeIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleTag = (id: string) => {
    setTagIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const setDueDatePart = (date: string) => {
    setDueAt(joinDatetimeLocalValue(date, dueTime));
  };

  const setDueTimePart = (time: string) => {
    setDueAt(joinDatetimeLocalValue(dueDate, time));
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
            attachments: pendingAttachments,
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
            attachment_ids_to_keep: keptAttachmentIds,
            new_attachments: pendingAttachments,
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

  const primaryLabel =
    saving ? 'Saving…' : mode === 'create' ? 'Create task' : statusOnly ? 'Save' : 'Save changes';

  return (
    <div
      className="kanban-modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      role="presentation"
    >
      <div
        ref={panelRef}
        className="kanban-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        {saving && <LoadingOverlay label="Saving task…" />}

        <header className="kanban-modal-header">
          <div>
            <p className="kanban-modal-eyebrow">{mode === 'create' ? 'New task' : 'Task details'}</p>
            <h2 id={titleId} className="kanban-modal-title kanban-display">
              {mode === 'create' ? 'Create task' : statusOnly ? 'Update status' : 'Edit task'}
            </h2>
          </div>
          <button type="button" onClick={onClose} className="kanban-modal-close" aria-label="Close">
            <X className="h-5 w-5" aria-hidden />
          </button>
        </header>

        <form onSubmit={(e) => void submit(e)} className="kanban-modal-form">
          <div className="kanban-modal-body">
            {err && <p className="kanban-modal-error">{err}</p>}

            {statusOnly && task ? (
              <div className="kanban-modal-section">
                <div className="kanban-modal-readonly-block">
                  <span className="kanban-modal-label">Title</span>
                  <p className="kanban-modal-readonly">{task.title}</p>
                </div>
                <div className="kanban-modal-readonly-block">
                  <span className="kanban-modal-label">Description</span>
                  <p className="kanban-modal-readonly kanban-modal-readonly--multiline">
                    {task.description?.trim() || 'No description'}
                  </p>
                </div>
                <div className="kanban-modal-readonly-block">
                  <span className="kanban-modal-label">Due</span>
                  <p className="kanban-modal-readonly">{formatTaskDueReadOnly(task.due_at)}</p>
                </div>
                <label className="kanban-modal-field">
                  <span className="kanban-modal-label">Status</span>
                  <div className={cn('kanban-modal-status-wrap', `kanban-modal-status-wrap--${status}`)}>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as TaskStatus)}
                      className="kanban-modal-select"
                    >
                      {TASK_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {TASK_STATUS_LABELS[s]}
                        </option>
                      ))}
                    </select>
                  </div>
                </label>
                <p className="kanban-modal-hint">
                  You can update the status. Title, description, and due date are set by the creator.
                </p>
                {(task.attachments?.length ?? 0) > 0 && (
                  <TaskAttachmentsField
                    existing={task.attachments}
                    pending={[]}
                    keptIds={task.attachments.map((a) => a.id)}
                    disabled
                    onPendingAdd={() => {}}
                    onPendingRemove={() => {}}
                    onExistingRemove={() => {}}
                  />
                )}
              </div>
            ) : !statusOnly ? (
              <>
                <section className="kanban-modal-section">
                  <h3 className="kanban-modal-section-title">Details</h3>
                  <label className="kanban-modal-field">
                    <span className="kanban-modal-label">Title</span>
                    <input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      required
                      className="kanban-modal-input"
                      placeholder="What needs to be done?"
                    />
                  </label>
                  <label className="kanban-modal-field">
                    <span className="kanban-modal-label">Description</span>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={4}
                      className="kanban-modal-textarea"
                      placeholder="Add context, links, or acceptance criteria…"
                    />
                  </label>
                </section>

                <section className="kanban-modal-section">
                  <h3 className="kanban-modal-section-title">Workflow</h3>
                  <div className="kanban-modal-grid-2">
                    <label className="kanban-modal-field">
                      <span className="kanban-modal-label">Status</span>
                      <div className={cn('kanban-modal-status-wrap', `kanban-modal-status-wrap--${status}`)}>
                        <select
                          value={status}
                          onChange={(e) => setStatus(e.target.value as TaskStatus)}
                          className="kanban-modal-select"
                        >
                          {TASK_STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {TASK_STATUS_LABELS[s]}
                            </option>
                          ))}
                        </select>
                      </div>
                    </label>
                    <label className="kanban-modal-field">
                      <span className="kanban-modal-label">Visibility</span>
                      <div
                        className={cn(
                          'kanban-modal-visibility-wrap',
                          visibility === 'private'
                            ? 'kanban-modal-visibility-wrap--private'
                            : 'kanban-modal-visibility-wrap--workspace',
                        )}
                      >
                        {visibility === 'private' ? (
                          <Lock className="kanban-modal-field-icon" aria-hidden />
                        ) : (
                          <Globe className="kanban-modal-field-icon" aria-hidden />
                        )}
                        <select
                          value={visibility}
                          onChange={(e) => setVisibility(e.target.value as TaskVisibility)}
                          className="kanban-modal-select kanban-modal-select--with-icon"
                        >
                          <option value="private">{TASK_VISIBILITY_LABELS.private}</option>
                          <option value="workspace">{TASK_VISIBILITY_LABELS.workspace}</option>
                        </select>
                      </div>
                    </label>
                  </div>

                  <div className="kanban-modal-field">
                    <span className="kanban-modal-label">Due date & time</span>
                    <div className="kanban-modal-datetime">
                      <div className="kanban-modal-datetime-field">
                        <Calendar className="kanban-modal-datetime-icon" aria-hidden />
                        <input
                          type="date"
                          value={dueDate}
                          onChange={(e) => setDueDatePart(e.target.value)}
                          className="kanban-modal-input kanban-modal-input--date"
                        />
                      </div>
                      <input
                        type="time"
                        value={dueTime}
                        onChange={(e) => setDueTimePart(e.target.value)}
                        className="kanban-modal-input kanban-modal-input--time"
                      />
                    </div>
                  </div>
                </section>

                <section className="kanban-modal-section">
                  <h3 className="kanban-modal-section-title">People</h3>
                  <div className="kanban-modal-field">
                    <span className="kanban-modal-label">Assignees</span>
                    <div className="kanban-modal-picker-list" role="list">
                      {users.map((u) => {
                        const label = formatUserLabel(u);
                        const selected = assigneeIds.includes(u.id);
                        return (
                          <button
                            key={u.id}
                            type="button"
                            role="listitem"
                            aria-pressed={selected}
                            onClick={() => toggleAssignee(u.id)}
                            className={cn(
                              'kanban-modal-picker-row',
                              selected && 'kanban-modal-picker-row--selected',
                            )}
                          >
                            <UserAvatar label={label} avatarUrl={u.avatar_url} size="xs" />
                            <span className="kanban-modal-picker-label">{label}</span>
                          </button>
                        );
                      })}
                      {users.length === 0 && (
                        <p className="kanban-modal-empty">No users available.</p>
                      )}
                    </div>
                  </div>
                </section>

                <section className="kanban-modal-section">
                  <h3 className="kanban-modal-section-title">Tags & priority</h3>
                  <p className="kanban-modal-hint kanban-modal-hint--inline">
                    Add the <strong>high</strong> tag to mark priority — cards show a red edge stripe.
                  </p>
                  <div className="kanban-modal-tag-grid">
                    {tags.map((t) => {
                      const selected = tagIds.includes(t.id);
                      const colorKey = isTagColorKey(t.color) ? t.color : null;
                      const isHigh = isHighPriorityTagName(t.name);
                      return (
                        <button
                          key={t.id}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => toggleTag(t.id)}
                          className={cn(
                            'kanban-modal-tag-chip',
                            selected && 'kanban-modal-tag-chip--selected',
                            colorKey && `kanban-modal-tag-chip--${colorKey}`,
                            isHigh && 'kanban-modal-tag-chip--priority',
                          )}
                        >
                          <span
                            className={cn(
                              'kanban-modal-tag-dot',
                              colorKey ? TAG_COLOR_BG[colorKey as TagColorKey] : 'bg-stone-300',
                            )}
                            aria-hidden
                          />
                          {t.name}
                          {isHigh && <span className="kanban-modal-priority-badge">Priority</span>}
                        </button>
                      );
                    })}
                    {tags.length === 0 && <p className="kanban-modal-empty">No tags yet.</p>}
                  </div>
                </section>

                <section className="kanban-modal-section">
                  <TaskAttachmentsField
                    existing={task?.attachments ?? []}
                    pending={pendingAttachments}
                    keptIds={keptAttachmentIds}
                    onPendingAdd={(attachment) =>
                      setPendingAttachments((prev) => [...prev, attachment])
                    }
                    onPendingRemove={(index) =>
                      setPendingAttachments((prev) => prev.filter((_, i) => i !== index))
                    }
                    onExistingRemove={(id) =>
                      setKeptAttachmentIds((prev) => prev.filter((x) => x !== id))
                    }
                  />
                </section>
              </>
            ) : null}
          </div>

          <footer className="kanban-modal-footer">
            <div>
              {onDelete && (
                <button type="button" onClick={onDelete} className="kanban-modal-delete">
                  <Trash2 className="h-4 w-4" aria-hidden />
                  Delete
                </button>
              )}
            </div>
            <div className="kanban-modal-footer-actions">
              <button type="button" onClick={onClose} className="kanban-modal-cancel">
                Cancel
              </button>
              <OutlineFillButtonAction type="submit" disabled={saving}>
                {primaryLabel}
              </OutlineFillButtonAction>
            </div>
          </footer>
        </form>
      </div>
    </div>
  );
}
