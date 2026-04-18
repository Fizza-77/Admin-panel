export const TASK_VISIBILITIES = ['private', 'workspace'] as const;
export type TaskVisibility = (typeof TASK_VISIBILITIES)[number];

export const TASK_VISIBILITY_LABELS: Record<TaskVisibility, string> = {
  private: 'Private',
  workspace: 'Workspace',
};

export function isTaskVisibility(value: unknown): value is TaskVisibility {
  return typeof value === 'string' && (TASK_VISIBILITIES as readonly string[]).includes(value);
}
