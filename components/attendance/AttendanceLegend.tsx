import { ATTENDANCE_STATUS_LABELS } from '@/lib/attendance/types';

const LEGEND_ITEMS = [
  { key: 'present', label: ATTENDANCE_STATUS_LABELS.present, swatch: 'att-legend-swatch--present' },
  { key: 'absent', label: ATTENDANCE_STATUS_LABELS.absent, swatch: 'att-legend-swatch--absent' },
  { key: 'late', label: ATTENDANCE_STATUS_LABELS.late, swatch: 'att-legend-swatch--late' },
  { key: 'leave', label: ATTENDANCE_STATUS_LABELS.leave, swatch: 'att-legend-swatch--leave' },
] as const;

export default function AttendanceLegend() {
  return (
    <table className="att-legend" aria-label="Attendance color legend">
      <tbody>
        {LEGEND_ITEMS.map((item) => (
          <tr key={item.key}>
            <td>
              <span className={`att-legend-swatch ${item.swatch}`} aria-hidden />
              {item.label}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
