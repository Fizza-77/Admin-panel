import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '@/lib/supabase/server';
import { requireApiPermission } from '@/lib/permissions/apiGuard';
import { isTaskSuperAdmin } from '@/lib/permissions/taskAdmin';
import { notifyTaskAssignees } from '@/lib/tasks/notifyAssignees';
import { reportError } from '@/lib/monitoring';
import { getTaskIdsAssignedToUser, orFilterForVisibleTasks } from '@/lib/tasks/taskQueries';
import { isTaskStatus } from '@/lib/tasks/taskStatus';
import { isTaskVisibility } from '@/lib/tasks/taskVisibility';
import type { TaskWithRelations } from '@/lib/tasks/taskRow';
import { mapTaskRow, TASK_SELECT_WITH_RELATIONS } from '@/lib/tasks/mapTaskRow';
import { parseAttachmentInput, type PendingTaskAttachment } from '@/lib/tasks/taskAttachments';
import { insertTaskAttachments, replaceTaskAttachments } from '@/lib/tasks/taskAttachmentDb';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = await requireApiPermission(req, res, { tasks: true });
  if (!auth.ok) {
    return res.status(auth.status).json({ message: auth.message });
  }

  const { userId, permissions } = auth;
  const isSuper = isTaskSuperAdmin(permissions);

  if (req.method === 'GET') {
    const statusFilter = typeof req.query.status === 'string' ? req.query.status : undefined;
    const tagId = typeof req.query.tag_id === 'string' ? req.query.tag_id : undefined;
    const qSearch = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const assignedUserId = typeof req.query.assigned_user_id === 'string' ? req.query.assigned_user_id : undefined;
    const visibilityFilter = typeof req.query.visibility === 'string' ? req.query.visibility : undefined;

    let taskIdsByTag: string[] | null = null;
    if (tagId) {
      const { data: links, error: linkErr } = await supabase.from('task_tag_links').select('task_id').eq('tag_id', tagId);
      if (linkErr) {
        reportError(linkErr, { source: 'api/tasks GET tag filter' });
        return res.status(500).json({ message: 'Failed to filter by tag' });
      }
      taskIdsByTag = (links ?? []).map((l) => l.task_id);
      if (taskIdsByTag.length === 0) {
        return res.status(200).json({ tasks: [] as TaskWithRelations[] });
      }
    }

    let query = supabase
      .from('tasks')
      .select(TASK_SELECT_WITH_RELATIONS)
      .order('updated_at', { ascending: false });

    if (!isSuper) {
      const assigneeResult = await getTaskIdsAssignedToUser(userId);
      if (!assigneeResult.ok) {
        return res.status(500).json({
          message: 'Failed to load task visibility',
          detail: assigneeResult.error,
        });
      }
      query = query.or(orFilterForVisibleTasks(userId, assigneeResult.taskIds));
    }

    if (taskIdsByTag) {
      query = query.in('id', taskIdsByTag);
    }

    if (statusFilter && isTaskStatus(statusFilter)) {
      query = query.eq('status', statusFilter);
    }

    if (visibilityFilter === 'private' || visibilityFilter === 'workspace') {
      query = query.eq('visibility', visibilityFilter);
    }

    if (qSearch) {
      query = query.ilike('title', `%${qSearch}%`);
    }

    if (assignedUserId && isSuper) {
      const { data: rows, error: aErr } = await supabase
        .from('task_assignees')
        .select('task_id')
        .eq('user_id', assignedUserId);
      if (aErr) {
        return res.status(500).json({ message: 'Failed to filter by assignee' });
      }
      const ids = (rows ?? []).map((r) => r.task_id);
      if (ids.length === 0) {
        return res.status(200).json({ tasks: [] as TaskWithRelations[] });
      }
      query = query.in('id', ids);
    }

    const { data, error } = await query;

    if (error) {
      reportError(error, { source: 'api/tasks GET' });
      return res.status(500).json({ message: error.message || 'Failed to load tasks' });
    }

    const tasks = (data ?? []).map(mapTaskRow);
    return res.status(200).json({ tasks });
  }

  if (req.method === 'POST') {
    if (!isTaskSuperAdmin(permissions)) {
      return res.status(403).json({ message: 'You do not have permission to create tasks.' });
    }

    const body = req.body ?? {};
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const description = typeof body.description === 'string' ? body.description.trim() : null;
    const status = isTaskStatus(body.status) ? body.status : 'to_do';
    const visibility = isTaskVisibility(body.visibility) ? body.visibility : 'private';
    let due_at: string | null = null;
    if (typeof body.due_at === 'string' && body.due_at.trim()) {
      due_at = body.due_at.trim();
    } else if (body.due_at === null) {
      due_at = null;
    }

    const assignee_ids = Array.isArray(body.assignee_ids)
      ? body.assignee_ids.filter((x: unknown) => typeof x === 'string')
      : [];
    const tag_ids = Array.isArray(body.tag_ids) ? body.tag_ids.filter((x: unknown) => typeof x === 'string') : [];
    const new_attachments = Array.isArray(body.attachments)
      ? body.attachments.map(parseAttachmentInput).filter((a): a is PendingTaskAttachment => a !== null)
      : [];

    if (!title) {
      return res.status(400).json({ message: 'Title is required' });
    }

    const { data: created, error: insertError } = await supabase
      .from('tasks')
      .insert({
        title,
        description: description || null,
        status,
        visibility,
        due_at,
        created_by: userId,
        updated_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (insertError || !created?.id) {
      reportError(insertError, { source: 'api/tasks POST insert' });
      return res.status(500).json({ message: insertError?.message || 'Failed to create task' });
    }

    const taskId = created.id;

    if (assignee_ids.length > 0) {
      const { error: ae } = await supabase.from('task_assignees').insert(
        assignee_ids.map((uid: string) => ({
          task_id: taskId,
          user_id: uid,
        })),
      );
      if (ae) {
        reportError(ae, { source: 'api/tasks POST assignees' });
      }
    }

    if (tag_ids.length > 0) {
      const { error: te } = await supabase.from('task_tag_links').insert(
        tag_ids.map((tid: string) => ({
          task_id: taskId,
          tag_id: tid,
        })),
      );
      if (te) {
        reportError(te, { source: 'api/tasks POST tags' });
      }
    }

    if (new_attachments.length > 0) {
      try {
        await insertTaskAttachments(taskId, userId, new_attachments);
      } catch (e) {
        reportError(e, { source: 'api/tasks POST attachments' });
      }
    }

    const { data: full, error: fullErr } = await supabase
      .from('tasks')
      .select(TASK_SELECT_WITH_RELATIONS)
      .eq('id', taskId)
      .single();

    await notifyTaskAssignees({
      taskId,
      taskTitle: title,
      assigneeIds: assignee_ids,
      actorUserId: userId,
      isNewTask: true,
    });

    if (fullErr || !full) {
      return res.status(201).json({ task: { id: taskId, title } });
    }

    return res.status(201).json({ task: mapTaskRow(full) });
  }

  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).json({ message: 'Method Not Allowed' });
}
