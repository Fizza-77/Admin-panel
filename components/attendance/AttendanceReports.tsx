import { format } from 'date-fns';
import StatCircle from '@/components/attendance/StatCircle';
import {
  buildAttendanceReport,
  formatLateHours,
  percentOf,
  type AttendanceRecordSlice,
} from '@/lib/attendance/reports';
import { parseDateOnly } from '@/lib/attendance/workingDays';

type AttendanceReportsProps = {
  monthFrom: string;
  monthTo: string;
  today: string;
  monthRecords: AttendanceRecordSlice[];
  yearLeaveRecords: AttendanceRecordSlice[];
};

function formatRange(from: string, to: string): string {
  try {
    const f = format(parseDateOnly(from), 'MMM d');
    const t = format(parseDateOnly(to), 'MMM d');
    return from === to ? f : `${f} – ${t}`;
  } catch {
    return `${from} – ${to}`;
  }
}

function leaveSublabel(used: number, allowance: number | null, remaining: number | null): string {
  if (allowance === null) {
    return `${used} used · allowance TBD`;
  }
  return `${used} of ${allowance} · ${remaining ?? 0} left`;
}

export default function AttendanceReports({
  monthFrom,
  monthTo,
  today,
  monthRecords,
  yearLeaveRecords,
}: AttendanceReportsProps) {
  const report = buildAttendanceReport(monthRecords, yearLeaveRecords, monthFrom, monthTo, today);

  const weeklyPresentPct = percentOf(report.weekly.present + report.weekly.late, report.weekly.workingDays);
  const monthlyPresentPct = percentOf(
    report.monthly.present + report.monthly.late,
    report.monthly.workingDays,
  );
  const monthlyLeavePct =
    report.monthly.leaveAllowance === null
      ? undefined
      : percentOf(report.monthly.leave, report.monthly.leaveAllowance);

  return (
    <div className="att-reports">
      <section className="att-report-section" aria-labelledby="att-weekly-report-title">
        <div className="att-report-heading">
          <h3 id="att-weekly-report-title" className="att-report-title">
            Weekly report
          </h3>
          <p className="att-report-range">{formatRange(report.weekly.from, report.weekly.to)}</p>
        </div>
        <div className="att-report-circles">
          <StatCircle
            label="Present"
            value={String(report.weekly.present + report.weekly.late)}
            sublabel={`of ${report.weekly.workingDays} working days`}
            percent={weeklyPresentPct}
            accent="green"
          />
          <StatCircle
            label="Late"
            value={String(report.weekly.late)}
            sublabel={formatLateHours(report.weekly.lateHoursTotal)}
            accent="yellow"
          />
          <StatCircle
            label="Absent"
            value={String(report.weekly.absent)}
            accent="red"
          />
          <StatCircle
            label="Leave"
            value={String(report.weekly.leave)}
            accent="blue"
          />
        </div>
      </section>

      <section className="att-report-section" aria-labelledby="att-monthly-report-title">
        <div className="att-report-heading">
          <h3 id="att-monthly-report-title" className="att-report-title">
            Monthly report
          </h3>
          <p className="att-report-range">Salary deduction · late hours</p>
        </div>
        <div className="att-report-circles">
          <StatCircle
            label="Late hours"
            value={formatLateHours(report.monthly.lateHoursTotal)}
            sublabel={`${report.monthly.late} late day${report.monthly.late === 1 ? '' : 's'}`}
            percent={report.monthly.lateHoursTotal > 0 ? Math.min(100, report.monthly.lateHoursTotal * 10) : 0}
            accent="yellow"
          />
          <StatCircle
            label="Present"
            value={String(report.monthly.present + report.monthly.late)}
            sublabel={`of ${report.monthly.workingDays} working days`}
            percent={monthlyPresentPct}
            accent="green"
          />
          <StatCircle
            label="Leave"
            value={String(report.monthly.leave)}
            sublabel={leaveSublabel(
              report.monthly.leave,
              report.monthly.leaveAllowance,
              report.monthly.leaveRemaining,
            )}
            percent={monthlyLeavePct}
            accent="blue"
          />
          <StatCircle
            label="Year leave"
            value={String(report.yearlyLeaveUsed)}
            sublabel={
              report.yearlyLeaveAllowance === null
                ? 'allowance TBD'
                : `of ${report.yearlyLeaveAllowance} this year`
            }
            percent={
              report.yearlyLeaveAllowance === null
                ? undefined
                : percentOf(report.yearlyLeaveUsed, report.yearlyLeaveAllowance)
            }
            accent="blue"
          />
          <StatCircle
            label="Absent"
            value={String(report.monthly.absent)}
            accent="red"
          />
        </div>
      </section>
    </div>
  );
}
