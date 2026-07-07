import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '@/lib/supabase/server';
import { requireApiPermission } from '@/lib/permissions/apiGuard';
import { isTaskSuperAdmin } from '@/lib/permissions/taskAdmin';
import { reportError } from '@/lib/monitoring';
import { assigneeStatusOnly, canUserFullyManageTask, canUserViewTask } from '@/lib/tasks/taskAccess';
import { isTaskStatus } from '@/lib/tasks/taskStatus';
import { isTaskVisibility } from '@/lib/tasks/taskVisibility';
import type { TaskWithRelations } from '@/lib/tasks/taskRow';
import { mapTaskRow, TASK_SELECT_WITH_RELATIONS } from '@/lib/tasks/mapTaskRow';
import { parseAttachmentInput, type PendingTaskAttachment } from '@/lib/tasks/taskAttachments';
import { replaceTaskAttachments } from '@/lib/tasks/taskAttachmentDb';
import { notifyTaskAssignees } from '@/lib/tasks/notifyAssignees';

async function loadTaskWithRelations(taskId: string) {
  const { data, error } = await supabase
    .from('tasks')
    .select(TASK_SELECT_WITH_RELATIONS)
    .eq('id', taskId)
    .maybeSingle();

  if (error || !data) {
    return { task: null as TaskWithRelations | null, error };
  }
  return { task: mapTaskRow(data), error: null };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = await requireApiPermission(req, res, { tasks: true });
  if (!auth.ok) {
    return res.status(auth.status).json({ message: auth.message });
  }

  const { userId, permissions } = auth;
  const isSuper = isTaskSuperAdmin(permissions);

  const taskId = req.query.taskId;
  if (typeof taskId !== 'string') {
    return res.status(400).json({ message: 'Invalid task id' });
  }

  const { task: loaded, error: loadErr } = await loadTaskWithRelations(taskId);
  if (loadErr || !loaded) {
    return res.status(404).json({ message: 'Task not found' });
  }

  const assigneeIds = loaded.assignee_ids;

  if (!canUserViewTask(loaded, userId, isSuper, assigneeIds)) {
    return res.status(403).json({ message: 'You cannot view this task' });
  }

  if (req.method === 'GET') {
    return res.status(200).json({ task: loaded });
  }

  const fullManage = canUserFullyManageTask(loaded, userId, isSuper);
  const statusOnly = assigneeStatusOnly(loaded, userId, isSuper, assigneeIds);

  if (req.method === 'PATCH') {
    const body = req.body ?? {};

    if (statusOnly) {
      if (Object.keys(body).some((k) => k !== 'status')) {
        return res.status(403).json({ message: 'You can only update status on this task' });
      }
      if (!isTaskStatus(body.status)) {
        return res.status(400).json({ message: 'Valid status is required' });
      }
      const { error: upErr } = await supabase
        .from('tasks')
        .update({ status: body.status, updated_at: new Date().toISOString() })
        .eq('id', taskId);
      if (upErr) {
        return res.status(500).json({ message: upErr.message });
      }
      const { task: next } = await loadTaskWithRelations(taskId);
      return res.status(200).json({ task: next });
    }

    if (!fullManage) {
      return res.status(403).json({ message: 'You cannot edit this task' });
    }

    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (typeof body.title === 'string' && body.title.trim()) {
      patch.title = body.title.trim();
    }
    if (typeof body.description === 'string') {
      patch.description = body.description.trim() || null;
    }
    if (isTaskStatus(body.status)) {
      patch.status = body.status;
    }
    if (isTaskVisibility(body.visibility)) {
      patch.visibility = body.visibility;
    }
    if (body.due_at === null) {
      patch.due_at = null;
    } else if (typeof body.due_at === 'string' && body.due_at.trim()) {
      patch.due_at = body.due_at;
    }

    const { error: upErr } = await supabase.from('tasks').update(patch).eq('id', taskId);
    if (upErr) {
      return res.status(500).json({ message: upErr.message });
    }

    if (Array.isArray(body.assignee_ids)) {
      const ids = body.assignee_ids.filter((x: unknown): x is string => typeof x === 'string');
      const previous = new Set(assigneeIds);
      const added = ids.filter((uid: string) => !previous.has(uid));
      await supabase.from('task_assignees').delete().eq('task_id', taskId);
      if (ids.length > 0) {
        const { error: ae } = await supabase.from('task_assignees').insert(
          ids.map((uid: string) => ({ task_id: taskId, user_id: uid })),
        );
        if (ae) {
          reportError(ae, { source: 'api/tasks PATCH assignees' });
        }
      }
      if (added.length > 0) {
        const taskTitle =
          typeof patch.title === 'string' ? patch.title : loaded.title;
        await notifyTaskAssignees({
          taskId,
          taskTitle,
          assigneeIds: added,
          actorUserId: userId,
          isNewTask: false,
        });
      }
    }

    if (Array.isArray(body.tag_ids)) {
      const tids = body.tag_ids.filter((x: unknown) => typeof x === 'string');
      await supabase.from('task_tag_links').delete().eq('task_id', taskId);
      if (tids.length > 0) {
        const { error: te } = await supabase.from('task_tag_links').insert(
          tids.map((tid: string) => ({ task_id: taskId, tag_id: tid })),
        );
        if (te) {
          reportError(te, { source: 'api/tasks PATCH tags' });
        }
      }
    }

    if (Array.isArray(body.attachment_ids_to_keep) || Array.isArray(body.new_attachments)) {
      const keepIds = Array.isArray(body.attachment_ids_to_keep)
        ? body.attachment_ids_to_keep.filter((x: unknown): x is string => typeof x === 'string')
        : loaded.attachments.map((a) => a.id);
      const newOnes = Array.isArray(body.new_attachments)
        ? body.new_attachments
            .map((item: unknown) => parseAttachmentInput(item))
            .filter((a: PendingTaskAttachment | null): a is PendingTaskAttachment => a !== null)
        : [];
      try {
        await replaceTaskAttachments(taskId, userId, keepIds, newOnes);
      } catch (e) {
        reportError(e, { source: 'api/tasks PATCH attachments' });
        return res.status(500).json({ message: e instanceof Error ? e.message : 'Failed to update attachments' });
      }
    }

    const { task: next } = await loadTaskWithRelations(taskId);
    return res.status(200).json({ task: next });
  }

  if (req.method === 'DELETE') {
    if (!fullManage) {
      return res.status(403).json({ message: 'Only the creator or an admin can delete this task' });
    }
    const { error: delErr } = await supabase.from('tasks').delete().eq('id', taskId);
    if (delErr) {
      return res.status(500).json({ message: delErr.message });
    }
    return res.status(200).json({ success: true });
  }

  res.setHeader('Allow', ['GET', 'PATCH', 'DELETE']);
  return res.status(405).json({ message: 'Method Not Allowed' });
}
