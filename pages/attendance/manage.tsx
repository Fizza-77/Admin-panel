import Head from 'next/head';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ArrowLeft, ChevronLeft, ChevronRight, Save } from 'lucide-react';
import { requireAuthentication, requirePermission } from '@/lib/auth';
import AdminLayout from '@/components/Layout/AdminLayout';
import AttendanceCalendar from '@/components/attendance/AttendanceCalendar';
import AttendanceLegend from '@/components/attendance/AttendanceLegend';
import AttendanceMarkDayList from '@/components/attendance/AttendanceMarkDayList';
import type { AppPermissions } from '@/lib/permissions/types';
import { LoadingOverlay } from '@/components/ui/Spinner';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { OutlineFillButtonAction } from '@/components/ui/OutlineFillButton';
import { reportError } from '@/lib/monitoring';
import {
  composeMonth,
  monthYearParts,
  shiftMonth,
  yearOptions,
} from '@/lib/attendance/calendarGrid';
import {
  resolveTeamDayVariant,
  summaryToRecordStatus,
  teamDaySummaryTitle,
  type TeamDaySummary,
} from '@/lib/attendance/teamDaySummary';
import {
  monthInputValue,
  todayDateInputValue,
  type AttendanceRow,
  type AttendanceStatus,
} from '@/lib/attendance/types';
import { isWorkingDayString, parseDateOnly } from '@/lib/attendance/workingDays';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

type EditableRow = AttendanceRow & {
  draft_status: AttendanceStatus | '' | null;
  draft_notes: string;
  draft_late_hours: string;
};

export const getServerSideProps = requireAuthentication(
  requirePermission({ attendance: true }, async () => ({ props: {} })),
);

function toEditable(row: AttendanceRow): EditableRow {
  return {
    ...row,
    draft_status: row.status,
    draft_notes: row.notes ?? '',
    draft_late_hours: row.late_hours != null ? String(row.late_hours) : '',
  };
}

function dateInMonth(date: string, month: string): boolean {
  return date.startsWith(`${month}-`);
}

export default function AttendanceManagePage({ permissions }: { permissions: AppPermissions }) {
  const today = todayDateInputValue();
  const [month, setMonth] = useState(monthInputValue());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [teamSize, setTeamSize] = useState(0);
  const [daySummaries, setDaySummaries] = useState<Record<string, TeamDaySummary>>({});
  const [rows, setRows] = useState<EditableRow[]>([]);
  const [loadingMonth, setLoadingMonth] = useState(true);
  const [loadingDay, setLoadingDay] = useState(false);
  const [saving, setSaving] = useState(false);
  const [monthError, setMonthError] = useState<string | null>(null);
  const [dayError, setDayError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveConfirmOpen, setSaveConfirmOpen] = useState(false);

  const { year, monthIndex } = monthYearParts(month);
  const isDayView = selectedDate !== null;

  const loadMonth = useCallback(async (targetMonth: string) => {
    setMonthError(null);
    setLoadingMonth(true);
    try {
      const res = await fetch(`/api/attendance?month=${encodeURIComponent(targetMonth)}`, {
        credentials: 'include',
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.message || 'Failed to load attendance calendar');
      }
      setTeamSize(typeof body?.team_size === 'number' ? body.team_size : 0);
      setDaySummaries(body?.days && typeof body.days === 'object' ? body.days : {});
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to load attendance calendar';
      setMonthError(msg);
      reportError(e, { source: 'AttendanceManagePage.loadMonth', month: targetMonth });
    } finally {
      setLoadingMonth(false);
    }
  }, []);

  const loadDay = useCallback(async (targetDate: string) => {
    setDayError(null);
    setSaveMessage(null);
    setLoadingDay(true);
    try {
      const res = await fetch(`/api/attendance?date=${encodeURIComponent(targetDate)}`, {
        credentials: 'include',
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.message || 'Failed to load team attendance');
      }
      const list = Array.isArray(body?.rows) ? (body.rows as AttendanceRow[]) : [];
      setRows(list.map(toEditable));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to load team attendance';
      setDayError(msg);
      reportError(e, { source: 'AttendanceManagePage.loadDay', date: targetDate });
    } finally {
      setLoadingDay(false);
    }
  }, []);

  useEffect(() => {
    void loadMonth(month);
  }, [month, loadMonth]);

  useEffect(() => {
    if (!selectedDate) {
      setRows([]);
      setDayError(null);
      setSaveMessage(null);
      return;
    }
    if (!dateInMonth(selectedDate, month)) {
      setSelectedDate(null);
      return;
    }
    void loadDay(selectedDate);
  }, [selectedDate, month, loadDay]);

  const handleDayClick = (date: string) => {
    setSelectedDate(date);
  };

  const handleBackToCalendar = () => {
    setSelectedDate(null);
    setSaveMessage(null);
    setDayError(null);
  };

  const updateRow = (userId: string, patch: Partial<EditableRow>) => {
    setRows((prev) => prev.map((r) => (r.user_id === userId ? { ...r, ...patch } : r)));
  };

  const saveAll = async (): Promise<boolean> => {
    if (!selectedDate) {
      return false;
    }
    setSaving(true);
    setSaveMessage(null);
    try {
      const entries = rows.map((r) => ({
        user_id: r.user_id,
        status: r.draft_status === null ? '' : r.draft_status,
        notes: r.draft_notes,
        late_hours: r.draft_status === 'late' ? r.draft_late_hours : null,
      }));
      const res = await fetch('/api/attendance', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: selectedDate, entries }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.message || 'Save failed');
      }
      setSaveMessage('Attendance saved.');
      await Promise.all([loadMonth(month), loadDay(selectedDate)]);
      return true;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Save failed';
      alert(msg);
      reportError(e, { source: 'AttendanceManagePage.saveAll', date: selectedDate });
      return false;
    } finally {
      setSaving(false);
    }
  };

  const confirmSave = async () => {
    const ok = await saveAll();
    if (ok) {
      setSaveConfirmOpen(false);
    }
  };

  const recordsByDate = useMemo(() => {
    const map = new Map<string, { status: AttendanceStatus | null; notes: string | null }>();
    for (const [date, summary] of Object.entries(daySummaries)) {
      map.set(date, {
        status: summaryToRecordStatus(date, today, summary, teamSize),
        notes: null,
      });
    }
    return map;
  }, [daySummaries, teamSize, today]);

  const monthLabel =
    (() => {
      try {
        return format(new Date(year, monthIndex - 1, 1), 'MMMM yyyy');
      } catch {
        return month;
      }
    })();

  const formattedDate =
    selectedDate
      ? (() => {
          try {
            return format(parseDateOnly(selectedDate), 'EEEE, MMMM d, yyyy');
          } catch {
            return selectedDate;
          }
        })()
      : '';

  const isOffDay = selectedDate ? !isWorkingDayString(selectedDate) : false;
  const overlayMessages =
    saving ? ['Saving attendance…', 'Updating records…', 'Almost done…']
    : !isDayView && loadingMonth ? ['Loading attendance…', 'Fetching calendar…', 'Almost ready…']
    : isDayView && loadingDay ? ['Loading team members…', 'Fetching attendance…', 'Almost ready…']
    : null;

  return (
    <AdminLayout permissions={permissions}>
      {overlayMessages && <LoadingOverlay messages={overlayMessages} rotateIntervalMs={3000} />}
      <Head>
        <title>Mark attendance - Skyen Admin</title>
      </Head>

      <div className="att-page relative mx-auto w-full max-w-4xl space-y-4">
        {!isDayView ? (
          <>
            <div className="att-month-toolbar">
              <div className="att-month-header">
                <div className="att-month-header-left" aria-hidden />
                <h2 className="att-month-title">{monthLabel}</h2>
                <div className="att-month-header-legend">
                  <AttendanceLegend />
                </div>
              </div>

              <div className="att-controls-row">
                <div className="att-controls-nav">
                  <button
                    type="button"
                    className="att-nav-btn"
                    onClick={() => setMonth((m) => shiftMonth(m, -1))}
                    aria-label="Previous month"
                  >
                    <ChevronLeft className="h-5 w-5" aria-hidden />
                  </button>
                  <label className="sr-only" htmlFor="att-manage-month-select">Month</label>
                  <select
                    id="att-manage-month-select"
                    className="att-select"
                    value={monthIndex}
                    onChange={(e) => setMonth(composeMonth(year, Number(e.target.value)))}
                  >
                    {MONTH_NAMES.map((name, idx) => (
                      <option key={name} value={idx + 1}>
                        {name}
                      </option>
                    ))}
                  </select>
                  <label className="sr-only" htmlFor="att-manage-year-select">Year</label>
                  <select
                    id="att-manage-year-select"
                    className="att-select"
                    value={year}
                    onChange={(e) => setMonth(composeMonth(Number(e.target.value), monthIndex))}
                  >
                    {yearOptions(new Date().getFullYear()).map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="att-nav-btn"
                    onClick={() => setMonth((m) => shiftMonth(m, 1))}
                    aria-label="Next month"
                  >
                    <ChevronRight className="h-5 w-5" aria-hidden />
                  </button>
                </div>
              </div>
            </div>

            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              {monthError ? (
                <p className="text-red-600">{monthError}</p>
              ) : (
                <AttendanceCalendar
                  month={month}
                  today={today}
                  recordsByDate={recordsByDate}
                  allowFutureDays
                  onDayClick={handleDayClick}
                  getVariant={(date) =>
                    resolveTeamDayVariant(date, today, daySummaries[date], teamSize)
                  }
                  getTitle={(date) => teamDaySummaryTitle(daySummaries[date])}
                />
              )}
              {!monthError && (
                <p className="mt-4 text-center text-sm text-slate-500">
                  Click a day on the calendar to mark attendance for each team member.
                </p>
              )}
            </section>
          </>
        ) : (
          <section className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleBackToCalendar}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
                  aria-label="Back to calendar"
                >
                  <ArrowLeft className="h-4 w-4" aria-hidden />
                </button>
                <div>
                  <h2 className="text-base font-semibold text-slate-900">Mark attendance</h2>
                  <p className="mt-0.5 text-sm text-slate-500">{formattedDate}</p>
                </div>
              </div>
              <OutlineFillButtonAction
                type="button"
                onClick={() => setSaveConfirmOpen(true)}
                disabled={saving || loadingDay || rows.length === 0 || isOffDay}
                icon={<Save className="h-[15px] w-[15px]" aria-hidden />}
              >
                {saving ? 'Saving…' : 'Save attendance'}
              </OutlineFillButtonAction>
            </div>

            {isOffDay && (
              <p className="mx-4 mt-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600 sm:mx-5">
                <span className="font-semibold text-slate-800">Sunday is off</span> — no attendance is
                recorded on Sundays.
              </p>
            )}

            {saveMessage && (
              <p className="mx-4 mt-4 text-sm font-medium text-emerald-700 sm:mx-5">{saveMessage}</p>
            )}

            {dayError ? (
              <p className="p-5 text-red-600">{dayError}</p>
            ) : (
              <div className="px-4 py-4 sm:px-5">
                <AttendanceMarkDayList
                  rows={rows}
                  loading={loadingDay}
                  disabled={isOffDay}
                  onUpdate={updateRow}
                />
              </div>
            )}
          </section>
        )}
      </div>

      <ConfirmDialog
        open={saveConfirmOpen}
        title="Save attendance?"
        description={
          <>
            Are you sure you want to save the changes for{' '}
            <strong>{formattedDate || 'this day'}</strong>?
          </>
        }
        confirmLabel="Save changes"
        cancelLabel="Keep editing"
        tone="primary"
        loading={saving}
        onConfirm={() => void confirmSave()}
        onCancel={() => {
          if (!saving) {
            setSaveConfirmOpen(false);
          }
        }}
      />
    </AdminLayout>
  );
}
