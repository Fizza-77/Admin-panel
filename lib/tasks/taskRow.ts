import type { TaskStatus } from './taskStatus';
import type { TaskVisibility } from './taskVisibility';

export type TaskRow = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  visibility: TaskVisibility;
  due_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type TaskWithRelations = TaskRow & {
  assignee_ids: string[];
  tag_ids: string[];
};
