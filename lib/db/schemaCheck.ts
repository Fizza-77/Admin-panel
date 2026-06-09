import { supabase } from '@/lib/supabase/server';
import { formatDbError, isMissingColumnError } from '@/lib/db/errors';

export const APP_PROFILE_PERMISSION_COLUMNS = [
  'can_manage_blogs',
  'can_manage_tasks',
  'can_administer_tasks',
  'can_manage_users',
  'display_name',
] as const;

export type AppProfileSchemaStatus = {
  tableReadable: boolean;
  missingColumns: string[];
  queryError: string | null;
};

/**
 * Probe `app_profiles` by selecting each expected permission column.
 * Used by diagnostics and health checks — not for hot-path permission reads.
 */
export async function checkAppProfileSchema(): Promise<AppProfileSchemaStatus> {
  const missingColumns: string[] = [];
  let queryError: string | null = null;

  for (const column of APP_PROFILE_PERMISSION_COLUMNS) {
    const { error } = await supabase.from('app_profiles').select(column).limit(1);
    if (error) {
      if (isMissingColumnError(error, column)) {
        missingColumns.push(column);
      } else {
        queryError = formatDbError(error);
        return { tableReadable: false, missingColumns, queryError };
      }
    }
  }

  return {
    tableReadable: true,
    missingColumns,
    queryError: null,
  };
}
