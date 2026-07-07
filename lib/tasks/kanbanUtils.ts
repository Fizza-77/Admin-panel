import { format } from 'date-fns';

export type DueUrgency = 'overdue' | 'soon' | 'calm' | 'none';

/** Priority is encoded via a tag named "high" (case-insensitive). */
export function isHighPriorityTagName(name: string): boolean {
  return name.trim().toLowerCase() === 'high';
}

export function taskHasHighPriority(
  tagIds: string[],
  tagNameById: Map<string, string>,
): boolean {
  for (const id of tagIds) {
    const name = tagNameById.get(id);
    if (name && isHighPriorityTagName(name)) {
      return true;
    }
  }
  return false;
}

export function getDueUrgency(iso: string | null | undefined): DueUrgency {
  if (!iso) {
    return 'none';
  }
  const due = new Date(iso);
  if (Number.isNaN(due.getTime())) {
    return 'none';
  }
  const diff = due.getTime() - Date.now();
  if (diff < 0) {
    return 'overdue';
  }
  if (diff < 48 * 60 * 60 * 1000) {
    return 'soon';
  }
  return 'calm';
}

export function formatDueLabel(iso: string | null | undefined): string | null {
  if (!iso) {
    return null;
  }
  const due = new Date(iso);
  if (Number.isNaN(due.getTime())) {
    return null;
  }
  return format(due, 'MMM d, h:mm a');
}

export function formatDueShort(iso: string | null | undefined): string | null {
  if (!iso) {
    return null;
  }
  const due = new Date(iso);
  if (Number.isNaN(due.getTime())) {
    return null;
  }
  return format(due, 'MMM d');
}

const AVATAR_PALETTE = [
  '#6366f1',
  '#0284c7',
  '#059669',
  '#d97706',
  '#dc2626',
  '#7c3aed',
  '#0891b2',
  '#be185d',
] as const;

export function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function avatarColorFromLabel(label: string): string {
  return AVATAR_PALETTE[hashString(label) % AVATAR_PALETTE.length];
}

export function initialsFromLabel(label: string): string {
  const parts = label.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase().slice(0, 2);
  }
  return label.slice(0, 2).toUpperCase();
}

export function splitDatetimeLocalValue(value: string): { date: string; time: string } {
  if (!value.trim()) {
    return { date: '', time: '' };
  }
  const [date, time] = value.split('T');
  return { date: date ?? '', time: time ?? '' };
}

export function joinDatetimeLocalValue(date: string, time: string): string {
  if (!date.trim()) {
    return '';
  }
  return `${date}T${time.trim() || '09:00'}`;
}
