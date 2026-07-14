export type PayrollEmployeeRow = {
  user_id: string;
  email: string | null;
  display_name: string | null;
  surname: string | null;
  company_role: string | null;
  salary: number | null;
  /** Deduction applied this pay month only (0 if none). */
  deduction: number;
  /** salary - deduction for this pay month. */
  net_salary: number | null;
  avatar_url: string | null;
  contact_info: string | null;
  qualification: string | null;
};

export type PayrollReceiptData = {
  companyName: string;
  employeeName: string;
  employeeEmail: string;
  employeeId: string;
  companyRole: string | null;
  contactInfo: string | null;
  qualification: string | null;
  payPeriodLabel: string;
  payMonthName: string;
  paymentDate: string;
  salaryAmount: number | null;
  salaryFormatted: string;
  deductionAmount: number;
  deductionFormatted: string;
  netAmount: number | null;
  netFormatted: string;
  referenceNumber: string;
};
