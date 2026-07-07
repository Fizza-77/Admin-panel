import UserAvatar from '@/components/ui/UserAvatar';
import { userDisplayLabel } from '@/lib/users/display';
import {
  ATTENDANCE_STATUS_LABELS,
  ATTENDANCE_STATUSES,
  type AttendanceStatus,
} from '@/lib/attendance/types';

export type AttendanceMarkRow = {
  user_id: string;
  email: string | null;
  display_name: string | null;
  avatar_url?: string | null;
  draft_status: AttendanceStatus | '' | null;
  draft_notes: string;
  draft_late_hours: string;
};

type AttendanceMarkDayListProps = {
  rows: AttendanceMarkRow[];
  loading: boolean;
  disabled: boolean;
  onUpdate: (userId: string, patch: Partial<AttendanceMarkRow>) => void;
};

const STATUS_ACCENT: Record<AttendanceStatus, string> = {
  present: 'att-mark-status--present',
  absent: 'att-mark-status--absent',
  late: 'att-mark-status--late',
  leave: 'att-mark-status--leave',
};

export default function AttendanceMarkDayList({
  rows,
  loading,
  disabled,
  onUpdate,
}: AttendanceMarkDayListProps) {
  if (loading) {
    return <p className="att-mark-list-empty">Loading team members…</p>;
  }

  if (rows.length === 0) {
    return <p className="att-mark-list-empty">No team members found.</p>;
  }

  return (
    <ul className="att-mark-list" aria-label="Mark attendance by employee">
      {rows.map((row) => {
        const label = row.display_name || row.email || 'Team member';
        return (
          <li
            key={row.user_id}
            className={`att-mark-row${
              row.draft_status === 'present' ? ' att-mark-row--present' : ''
            }`}
          >
            <div className="att-mark-row-person">
              <UserAvatar
                label={userDisplayLabel(row.display_name, row.email)}
                avatarUrl={row.avatar_url}
                size="sm"
                className="att-mark-row-avatar"
              />
              <div className="min-w-0">
                <p className="att-mark-row-name">{row.display_name || '—'}</p>
                {row.email && <p className="att-mark-row-email">{row.email}</p>}
              </div>
            </div>

            <div className="att-mark-row-fields">
              <div
                className="att-mark-status-group"
                role="group"
                aria-label={`Attendance for ${label}`}
              >
                <button
                  type="button"
                  className={`att-mark-status att-mark-status--clear${
                    row.draft_status === '' || row.draft_status === null ? ' att-mark-status--active' : ''
                  }`}
                  disabled={disabled}
                  aria-pressed={row.draft_status === '' || row.draft_status === null}
                  onClick={() =>
                    onUpdate(row.user_id, { draft_status: '', draft_late_hours: '' })
                  }
                >
                  —
                </button>
                {ATTENDANCE_STATUSES.map((status) => (
                  <button
                    key={status}
                    type="button"
                    className={`att-mark-status ${STATUS_ACCENT[status]}${
                      row.draft_status === status ? ' att-mark-status--active' : ''
                    }`}
                    disabled={disabled}
                    aria-pressed={row.draft_status === status}
                    onClick={() =>
                      onUpdate(row.user_id, {
                        draft_status: status,
                        draft_late_hours: status === 'late' ? row.draft_late_hours : '',
                      })
                    }
                  >
                    {ATTENDANCE_STATUS_LABELS[status]}
                  </button>
                ))}
              </div>

              {row.draft_status === 'late' && (
                <label className="att-mark-late-field">
                  <span className="att-mark-late-label">Hours late</span>
                  <input
                    type="number"
                    min={0}
                    max={24}
                    step={0.25}
                    value={row.draft_late_hours}
                    disabled={disabled}
                    onChange={(e) => onUpdate(row.user_id, { draft_late_hours: e.target.value })}
                    placeholder="0"
                    className="att-mark-late-input"
                    aria-label={`Hours late for ${label}`}
                  />
                </label>
              )}

              <input
                type="text"
                value={row.draft_notes}
                disabled={disabled}
                onChange={(e) => onUpdate(row.user_id, { draft_notes: e.target.value })}
                placeholder="Note (optional)"
                maxLength={500}
                className="att-mark-notes-input"
                aria-label={`Note for ${label}`}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
