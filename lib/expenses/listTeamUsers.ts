import { supabase } from '@/lib/supabase/server';
import { fetchAppProfileRowsByUserIds } from '@/lib/permissions/appProfileDb';
import { employeeFullName } from '@/lib/employees/profile';
import type { DbErrorLike } from '@/lib/db/errors';

export type TeamUserOption = {
  id: string;
  email: string | null;
  display_name: string | null;
  surname: string | null;
  label: string;
};

export async function listTeamUsersForExpenses(): Promise<{
  users: TeamUserOption[];
  error: DbErrorLike | null;
}> {
  const raw: Array<{ id: string; email: string | undefined }> = [];
  let page = 1;
  const perPage = 100;

  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) {
      return { users: [], error };
    }
    const batch = data?.users ?? [];
    for (const u of batch) {
      raw.push({ id: u.id, email: u.email });
    }
    if (batch.length < perPage) {
      break;
    }
    page += 1;
    if (page > 200) {
      break;
    }
  }

  const ids = raw.map((u) => u.id);
  const profiles = await fetchAppProfileRowsByUserIds(ids);

  const users = raw
    .map((u) => {
      const profile = profiles.byUserId.get(u.id);
      const email = u.email ?? null;
      return {
        id: u.id,
        email,
        display_name: profile?.display_name ?? null,
        surname: profile?.surname ?? null,
        label: employeeFullName(profile?.display_name, profile?.surname, email),
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label));

  return { users, error: profiles.error };
}
