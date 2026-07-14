import { supabase } from '@/lib/supabase/server';
import { reportError } from '@/lib/monitoring';
import { isMissingColumnError, isMissingTableError } from '@/lib/db/errors';
import { notesWithAssignee } from '@/lib/expenses/assigneeStorage';
import { EXPENSE_SELECT_COLUMNS, expenseMonthFromDate } from '@/lib/expenses/softwareExpenseLink';
import { monthDateRange } from '@/lib/expenses/types';

type FixedTemplateRow = {
  id: string;
  expense_date: string;
  title: string;
  amount: number;
  category: string | null;
  notes: string | null;
  assigned_user_id: string | null;
  employee_software_id: string | null;
};

function templatePayload(
  template: FixedTemplateRow,
  range: { from: string },
  now: string,
  linkColumnsAvailable: boolean,
) {
  const base = {
    expense_date: range.from,
    title: template.title,
    amount: template.amount,
    category: template.category,
    notes: template.notes,
    updated_at: now,
  };

  if (linkColumnsAvailable) {
    return {
      ...base,
      assigned_user_id: template.assigned_user_id,
    };
  }

  return {
    ...base,
    notes: notesWithAssignee(template.notes, template.assigned_user_id),
  };
}

async function loadExcludedTemplateIds(monthStart: string): Promise<Set<string> | null> {
  const { data, error } = await supabase
    .from('expense_fixed_month_exclusions')
    .select('fixed_expense_id')
    .eq('expense_month', monthStart);

  if (error) {
    if (isMissingTableError(error, 'expense_fixed_month_exclusions')) {
      return null;
    }
    reportError(error, { source: 'loadExcludedTemplateIds', monthStart });
    return new Set();
  }

  return new Set(
    (data ?? [])
      .map((row) => (typeof row.fixed_expense_id === 'string' ? row.fixed_expense_id : null))
      .filter((id): id is string => Boolean(id)),
  );
}

/** Mark a fixed expense as removed for one month so sync does not recreate it. */
export async function excludeFixedExpenseForMonth(templateId: string, month: string): Promise<boolean> {
  const range = monthDateRange(month);
  if (!range) {
    return false;
  }

  const { error } = await supabase.from('expense_fixed_month_exclusions').upsert(
    {
      fixed_expense_id: templateId,
      expense_month: range.from,
    },
    { onConflict: 'fixed_expense_id,expense_month' },
  );

  if (error) {
    if (isMissingTableError(error, 'expense_fixed_month_exclusions')) {
      reportError(error, { source: 'excludeFixedExpenseForMonth.missingTable', templateId, month });
      return false;
    }
    reportError(error, { source: 'excludeFixedExpenseForMonth', templateId, month });
    return false;
  }

  return true;
}

/**
 * Delete a fixed expense from a single month only.
 * Keeps the template and other months; records an exclusion so reload sync won't recreate it.
 */
export async function deleteFixedExpenseForMonth(params: {
  expenseId: string;
  isFixed: boolean;
  fixedExpenseId: string | null;
  expenseDate: string;
}): Promise<{ ok: true } | { ok: false; status: number; message: string }> {
  const templateId = params.fixedExpenseId ?? (params.isFixed ? params.expenseId : null);
  if (!templateId) {
    return { ok: false, status: 400, message: 'Not a fixed expense' };
  }

  const month = expenseMonthFromDate(params.expenseDate);
  const range = monthDateRange(month);
  if (!range) {
    return { ok: false, status: 400, message: 'Invalid expense date' };
  }

  const excluded = await excludeFixedExpenseForMonth(templateId, month);
  if (!excluded) {
    return {
      ok: false,
      status: 503,
      message:
        'Fixed expense month exclusions are not set up yet. Run supabase/migrations/20260714130000_expense_fixed_month_exclusions.sql',
    };
  }

  // Remove this month's copy (never delete the template — other months still need it).
  const { error: copyError } = await supabase
    .from('expenses')
    .delete()
    .eq('fixed_expense_id', templateId)
    .gte('expense_date', range.from)
    .lte('expense_date', range.to);

  if (copyError) {
    reportError(copyError, {
      source: 'deleteFixedExpenseForMonth.copy',
      templateId,
      month,
      expenseId: params.expenseId,
    });
    return { ok: false, status: 500, message: 'Failed to delete expense for this month' };
  }

  return { ok: true };
}

/**
 * End a fixed series in the demotion month:
 * - Keep expenses from the start month through this month (as one-time rows)
 * - Remove this expense from later months
 */
export async function demoteFixedExpenseToOneTime(params: {
  expenseId: string;
  templateId: string;
  demotionMonth: string;
  updates: Record<string, unknown>;
  selectColumns: string;
}): Promise<{ data: Record<string, unknown> | null; error: { message?: string; code?: string } | null }> {
  const range = monthDateRange(params.demotionMonth);
  if (!range) {
    return { data: null, error: { message: 'Invalid demotion month' } };
  }

  const now = new Date().toISOString();

  // Drop months after the month where Fixed was turned off.
  const { error: futureError } = await supabase
    .from('expenses')
    .delete()
    .eq('fixed_expense_id', params.templateId)
    .gt('expense_date', range.to);

  if (futureError) {
    reportError(futureError, {
      source: 'demoteFixedExpenseToOneTime.deleteFuture',
      templateId: params.templateId,
      demotionMonth: params.demotionMonth,
    });
    return { data: null, error: futureError };
  }

  const { data: template, error: templateLoadError } = await supabase
    .from('expenses')
    .select('id, expense_date')
    .eq('id', params.templateId)
    .maybeSingle();

  if (templateLoadError) {
    reportError(templateLoadError, {
      source: 'demoteFixedExpenseToOneTime.loadTemplate',
      templateId: params.templateId,
    });
    return { data: null, error: templateLoadError };
  }

  let startMonthCopyId: string | null = null;
  if (template?.expense_date) {
    const templateMonth = expenseMonthFromDate(String(template.expense_date));
    const startRange = monthDateRange(templateMonth);
    if (startRange) {
      const { data: startCopy, error: startCopyError } = await supabase
        .from('expenses')
        .select('id')
        .eq('fixed_expense_id', params.templateId)
        .gte('expense_date', startRange.from)
        .lte('expense_date', startRange.to)
        .maybeSingle();
      if (startCopyError && !isMissingColumnError(startCopyError, 'fixed_expense_id')) {
        reportError(startCopyError, {
          source: 'demoteFixedExpenseToOneTime.findStartCopy',
          templateId: params.templateId,
        });
        return { data: null, error: startCopyError };
      }
      startMonthCopyId = typeof startCopy?.id === 'string' ? startCopy.id : null;
    }
  }

  const keepPayload: Record<string, unknown> = {
    ...params.updates,
    is_fixed: false,
    fixed_expense_id: null,
    updated_at: now,
  };

  const { data, error } = await supabase
    .from('expenses')
    .update(keepPayload)
    .eq('id', params.expenseId)
    .select(params.selectColumns)
    .maybeSingle();

  if (error) {
    reportError(error, {
      source: 'demoteFixedExpenseToOneTime.update',
      expenseId: params.expenseId,
      templateId: params.templateId,
    });
    return { data: null, error };
  }

  if (!data) {
    return { data: null, error: { message: 'Expense not found' } };
  }

  // Preserve past months as independent one-time rows.
  const { error: unlinkError } = await supabase
    .from('expenses')
    .update({
      is_fixed: false,
      fixed_expense_id: null,
      updated_at: now,
    })
    .eq('fixed_expense_id', params.templateId);

  if (unlinkError) {
    reportError(unlinkError, {
      source: 'demoteFixedExpenseToOneTime.unlinkPast',
      templateId: params.templateId,
    });
    return { data: data as unknown as Record<string, unknown>, error: unlinkError };
  }

  if (params.templateId !== params.expenseId) {
    const templateMonth = template?.expense_date
      ? expenseMonthFromDate(String(template.expense_date))
      : null;

    if (startMonthCopyId || (templateMonth && templateMonth > params.demotionMonth)) {
      const { error: deleteTemplateError } = await supabase
        .from('expenses')
        .delete()
        .eq('id', params.templateId);
      if (deleteTemplateError) {
        reportError(deleteTemplateError, {
          source: 'demoteFixedExpenseToOneTime.deleteTemplate',
          templateId: params.templateId,
        });
        return { data: data as unknown as Record<string, unknown>, error: deleteTemplateError };
      }
    } else if (templateMonth && templateMonth <= params.demotionMonth) {
      // No monthly copy for the start month — keep the former template as that month's one-time row.
      const { error: demoteTemplateError } = await supabase
        .from('expenses')
        .update({
          is_fixed: false,
          fixed_expense_id: null,
          updated_at: now,
        })
        .eq('id', params.templateId);
      if (demoteTemplateError) {
        reportError(demoteTemplateError, {
          source: 'demoteFixedExpenseToOneTime.demoteTemplate',
          templateId: params.templateId,
        });
        return { data: data as unknown as Record<string, unknown>, error: demoteTemplateError };
      }
    }
  }

  return { data: data as unknown as Record<string, unknown>, error: null };
}

/** Ensure each fixed expense template appears in the given month's expense list. */
export async function syncFixedExpensesForMonth(month: string, createdBy: string): Promise<void> {
  const range = monthDateRange(month);
  if (!range) {
    return;
  }

  const { data, error } = await supabase
    .from('expenses')
    .select(EXPENSE_SELECT_COLUMNS)
    .eq('is_fixed', true)
    .is('fixed_expense_id', null);

  if (error) {
    if (isMissingColumnError(error, 'is_fixed') || isMissingColumnError(error, 'fixed_expense_id')) {
      return;
    }
    reportError(error, { source: 'syncFixedExpensesForMonth.list', month });
    return;
  }

  const excludedIds = await loadExcludedTemplateIds(range.from);
  let linkColumnsAvailable = true;
  const now = new Date().toISOString();

  for (const row of (data ?? []) as FixedTemplateRow[]) {
    // Subscription-linked software rows are owned by software sync — skip them here.
    if (row.employee_software_id) {
      continue;
    }

    if (excludedIds?.has(row.id)) {
      continue;
    }

    // Only show from the template's start month forward (e.g. July start → not June).
    const startMonth = expenseMonthFromDate(row.expense_date);
    const startRange = monthDateRange(startMonth);
    if (startRange) {
      const { error: prunePastError } = await supabase
        .from('expenses')
        .delete()
        .eq('fixed_expense_id', row.id)
        .lt('expense_date', startRange.from);
      if (prunePastError && !isMissingColumnError(prunePastError, 'fixed_expense_id')) {
        reportError(prunePastError, {
          source: 'syncFixedExpensesForMonth.pruneBeforeStart',
          templateId: row.id,
          startMonth,
        });
      }
    }

    if (month < startMonth) {
      continue;
    }

    const { data: copy, error: copyError } = await supabase
      .from('expenses')
      .select('id')
      .eq('fixed_expense_id', row.id)
      .gte('expense_date', range.from)
      .lte('expense_date', range.to)
      .maybeSingle();

    if (copyError) {
      if (isMissingColumnError(copyError, 'fixed_expense_id')) {
        linkColumnsAvailable = false;
        continue;
      }
      reportError(copyError, { source: 'syncFixedExpensesForMonth.findCopy', templateId: row.id, month });
      continue;
    }

    const payload = templatePayload(row, range, now, linkColumnsAvailable);
    const existingId = typeof copy?.id === 'string' ? copy.id : null;

    if (existingId) {
      const { error: updateError } = await supabase.from('expenses').update(payload).eq('id', existingId);
      if (updateError) {
        reportError(updateError, { source: 'syncFixedExpensesForMonth.update', templateId: row.id, month });
      }
      continue;
    }

    // Always insert a monthly copy (including the template's own month) so month delete
    // can remove one month without deleting the template used by other months.
    const insertPayload: Record<string, unknown> = {
      ...payload,
      is_fixed: false,
      fixed_expense_id: row.id,
      created_by: createdBy,
    };

    if (linkColumnsAvailable) {
      insertPayload.assigned_user_id = row.assigned_user_id;
    }

    const { error: insertError } = await supabase.from('expenses').insert(insertPayload);
    if (insertError) {
      if (isMissingColumnError(insertError, 'fixed_expense_id') || isMissingColumnError(insertError, 'is_fixed')) {
        continue;
      }
      reportError(insertError, { source: 'syncFixedExpensesForMonth.insert', templateId: row.id, month });
    }
  }
}
