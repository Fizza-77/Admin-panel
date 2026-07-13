const ASSIGNEE_NOTE_RE = /\n?__assigned_user_id:([0-9a-f-]{36})__/i;

/** Read assignee id embedded in notes when DB link columns are not migrated yet. */
export function parseAssigneeIdFromNotes(notes: string | null | undefined): string | null {
  if (!notes) {
    return null;
  }
  const match = notes.match(ASSIGNEE_NOTE_RE);
  return match?.[1] ?? null;
}

/** Remove hidden assignee marker from notes shown in the UI. */
export function stripAssigneeFromNotes(notes: string | null | undefined): string | null {
  if (!notes) {
    return null;
  }
  const cleaned = notes.replace(ASSIGNEE_NOTE_RE, '').trim();
  return cleaned || null;
}

/** Persist assignee in notes when assigned_user_id column is unavailable. */
export function notesWithAssignee(notes: string | null | undefined, userId: string | null): string | null {
  const cleaned = stripAssigneeFromNotes(notes);
  if (!userId) {
    return cleaned;
  }
  const tag = `__assigned_user_id:${userId}__`;
  return cleaned ? `${cleaned}\n${tag}` : tag;
}

export function resolveAssigneeId(
  assignedUserId: string | null | undefined,
  notes: string | null | undefined,
): string | null {
  if (assignedUserId) {
    return assignedUserId;
  }
  return parseAssigneeIdFromNotes(notes);
}
