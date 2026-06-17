import type { NextApiRequest, NextApiResponse } from 'next';

import { supabase } from '@/lib/supabase/server';

import { requireApiPermission } from '@/lib/permissions/apiGuard';

import { ensureAppProfileRowsForUserIds, upsertAppProfileRow } from '@/lib/permissions/appProfileDb';

import { formatDbError } from '@/lib/db/errors';

import { reportError } from '@/lib/monitoring';



export type AdminUserRow = {

  id: string;

  email: string | undefined;

  display_name: string | null;

  created_at: string;

  last_sign_in_at: string | null;

  can_manage_blogs: boolean;

  can_manage_tasks: boolean;

  can_administer_tasks: boolean;

  can_manage_users: boolean;

  /** Present when profile row was auto-created during this request */

  profile_bootstrapped?: boolean;

};



export default async function handler(req: NextApiRequest, res: NextApiResponse) {

  const auth = await requireApiPermission(req, res, { users: true });

  if (!auth.ok) {

    return res.status(auth.status).json({ message: auth.message });

  }



  if (req.method === 'GET') {

    const rawPage = Number.parseInt(String(req.query.page ?? '1'), 10);

    const rawPer = Number.parseInt(String(req.query.per_page ?? '50'), 10);

    const page = Number.isFinite(rawPage) && rawPage > 0 ? Math.min(rawPage, 10_000) : 1;

    const perPage = Number.isFinite(rawPer) && rawPer > 0 ? Math.min(Math.max(rawPer, 1), 100) : 50;



    const { data: listData, error: listError } = await supabase.auth.admin.listUsers({

      page,

      perPage,

    });



    if (listError) {

      reportError(listError, { source: 'api/admin/users GET listUsers' });

      return res.status(500).json({ message: listError.message || 'Failed to list users' });

    }



    const batch = listData?.users ?? [];

    if (batch.length === 0) {

      return res.status(200).json({

        users: [] as AdminUserRow[],

        page,

        perPage,

        hasNextPage: false,

      });

    }



    const ids = batch.map((u) => u.id);

    const {

      byUserId,

      error: profError,

      createdUserIds,

      stillMissingUserIds,

    } = await ensureAppProfileRowsForUserIds(ids);



    if (profError) {

      reportError(profError, { source: 'api/admin/users GET ensureProfiles' });

      return res.status(500).json({

        message: 'Failed to load access profiles',

        detail: formatDbError(profError),

        still_missing_user_ids: stillMissingUserIds,

      });

    }



    if (stillMissingUserIds.length > 0) {

      return res.status(500).json({

        message: 'Some users are missing app_profiles rows after automatic bootstrap',

        still_missing_user_ids: stillMissingUserIds,

      });

    }



    const createdSet = new Set(createdUserIds);



    const users: AdminUserRow[] = [];
    for (const u of batch) {
      const p = byUserId.get(u.id);
      if (!p) {
        return res.status(500).json({
          message: 'Profile row missing after bootstrap',
          still_missing_user_ids: [u.id],
        });
      }
      users.push({
        id: u.id,
        email: u.email,
        display_name: p.display_name,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at ?? null,
        can_manage_blogs: p.can_manage_blogs,
        can_manage_tasks: p.can_manage_tasks,
        can_administer_tasks: p.can_administer_tasks,
        can_manage_users: p.can_manage_users,
        profile_bootstrapped: createdSet.has(u.id) || undefined,
      });
    }



    const hasNextPage = batch.length === perPage;



    return res.status(200).json({

      users,

      page,

      perPage,

      hasNextPage,

      profiles_bootstrapped_count: createdUserIds.length,

    });

  }



  if (req.method === 'POST') {

    const body = req.body ?? {};

    const emailRaw = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';

    const password = typeof body.password === 'string' ? body.password : '';

    const can_manage_blogs = Boolean(body.can_manage_blogs);

    const can_manage_tasks = true;

    const can_administer_tasks = Boolean(body.can_administer_tasks);

    const can_manage_users = false;

    const display_name =

      typeof body.display_name === 'string' ? body.display_name.trim().slice(0, 120) || null : null;



    if (!emailRaw || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw)) {

      return res.status(400).json({ message: 'A valid email is required' });

    }

    if (password.length < 8) {

      return res.status(400).json({ message: 'Password must be at least 8 characters' });

    }



    const { data: created, error: createError } = await supabase.auth.admin.createUser({

      email: emailRaw,

      password,

      email_confirm: true,

    });



    if (createError || !created?.user) {

      const msg = createError?.message ?? 'Failed to create user';

      if (/already|exists|registered/i.test(msg)) {

        return res.status(409).json({ message: 'A user with this email already exists' });

      }

      return res.status(500).json({ message: msg });

    }



    const profileResult = await upsertAppProfileRow({
      user_id: created.user.id,
      can_manage_blogs,
      can_manage_tasks,
      can_administer_tasks,
      can_manage_users,
      display_name,
    });

    if (!profileResult.ok) {
      reportError(profileResult.error, { source: 'api/admin/users POST profile', userId: created.user.id });
      return res.status(500).json({
        message:
          'The Auth user was created but saving access flags failed. Set them manually in `app_profiles` or try again.',
        detail: formatDbError(profileResult.error),
      });
    }



    return res.status(201).json({

      user: {

        id: created.user.id,

        email: created.user.email,

        display_name,

        created_at: created.user.created_at,

        last_sign_in_at: created.user.last_sign_in_at ?? null,

        can_manage_blogs,

        can_manage_tasks,

        can_administer_tasks,

        can_manage_users,

      },

    });

  }



  res.setHeader('Allow', ['GET', 'POST']);

  return res.status(405).json({ message: 'Method Not Allowed' });

}


