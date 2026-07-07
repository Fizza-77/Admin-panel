/** Leave allowances — update when HR policy is finalized. */
export type AttendanceLeavePolicy = {
  /** Paid/unpaid leave days allowed per calendar month; null = not configured yet */
  monthlyLeaveDays: number | null;
  /** Leave days allowed per calendar year; null = not configured yet */
  yearlyLeaveDays: number | null;
};

export const ATTENDANCE_LEAVE_POLICY: AttendanceLeavePolicy = {
  monthlyLeaveDays: null,
  yearlyLeaveDays: null,
};
