import Head from 'next/head';
import { useEffect, useState } from 'react';
import type { GetServerSidePropsContext } from 'next';
import { requireAuthentication } from '@/lib/auth';
import { resolveAdminUserContextFromGssp } from '@/lib/auth/resolveUserContext';
import { ensureAppProfileRow } from '@/lib/permissions/getAppProfile';
import AdminLayout from '@/components/Layout/AdminLayout';
import ProfileAvatarField from '@/components/ProfileAvatarField';
import type { AppPermissions } from '@/lib/permissions/types';
import { LoadingOverlay } from '@/components/ui/Spinner';
import { OutlineFillButtonAction } from '@/components/ui/OutlineFillButton';
import { useSession } from '@/components/Layout/SessionContext';
import { reportError } from '@/lib/monitoring';

export const getServerSideProps = requireAuthentication(async (context: GetServerSidePropsContext) => {
  const ctx = await resolveAdminUserContextFromGssp(context);
  if (!ctx) {
    return { redirect: { destination: '/login', permanent: false } };
  }

  if (ctx.profileLoadError) {
    await ensureAppProfileRow(ctx.userId);
    const refreshed = await resolveAdminUserContextFromGssp(context);
    if (refreshed) {
      return { props: { permissions: refreshed.permissions } };
    }
  }

  return { props: { permissions: ctx.permissions } };
});

export default function SettingsPage({ permissions }: { permissions: AppPermissions }) {
  const { refreshSession } = useSession();
  const [firstName, setFirstName] = useState(permissions.displayName ?? '');
  const [surname, setSurname] = useState('');
  const [qualification, setQualification] = useState('');
  const [contactInfo, setContactInfo] = useState('');
  const [avatarUrl, setAvatarUrl] = useState(permissions.avatarUrl ?? null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setAvatarUrl(permissions.avatarUrl ?? null);
  }, [permissions.avatarUrl]);

  useEffect(() => {
    void (async () => {
      setProfileLoading(true);
      try {
        const res = await fetch('/api/profile', { credentials: 'include' });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(body?.message || 'Failed to load profile');
        }
        setFirstName(body.display_name ?? '');
        setSurname(body.surname ?? '');
        setQualification(body.qualification ?? '');
        setContactInfo(body.contact_info ?? '');
      } catch (e: unknown) {
        reportError(e, { source: 'SettingsPage.loadProfile' });
      } finally {
        setProfileLoading(false);
      }
    })();
  }, []);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMessage, setPwMessage] = useState<string | null>(null);
  const [pwError, setPwError] = useState<string | null>(null);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setError(null);
    setSaving(true);
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          display_name: firstName.trim() || null,
          surname: surname.trim() || null,
          qualification: qualification.trim() || null,
          contact_info: contactInfo.trim() || null,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.message || 'Could not save');
      }
      setFirstName(body.display_name ?? '');
      setSurname(body.surname ?? '');
      setQualification(body.qualification ?? '');
      setContactInfo(body.contact_info ?? '');
      setMessage('Saved.');
      await refreshSession();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not save');
      reportError(err, { source: 'SettingsPage.save' });
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwMessage(null);
    setPwError(null);
    if (newPassword.length < 8) {
      setPwError('New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError('New password and confirmation do not match.');
      return;
    }
    setPwSaving(true);
    try {
      const res = await fetch('/api/profile/password', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.message || 'Could not update password');
      }
      setPwMessage('Password updated.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: unknown) {
      setPwError(err instanceof Error ? err.message : 'Could not update password');
      reportError(err, { source: 'SettingsPage.changePassword' });
    } finally {
      setPwSaving(false);
    }
  };

  return (
    <AdminLayout permissions={permissions}>
      {(saving || profileLoading) && <LoadingOverlay label={profileLoading ? 'Loading profile…' : 'Saving profile…'} />}
      {pwSaving && <LoadingOverlay label="Updating password…" />}
      <Head>
        <title>Profile - Skyen Admin</title>
      </Head>
      <div className="max-w-lg">
        <h1 className="text-2xl font-bold text-slate-900">Profile</h1>
        <p className="mt-1 text-slate-600 text-sm">
          Update your personal details here. Your email is used to sign in and cannot be changed. Role and salary are
          set by your admin.
        </p>

        <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Profile photo</h2>
          <p className="mt-1 text-xs text-slate-500">Upload a photo or keep the default initials avatar.</p>
          <div className="mt-4">
            <ProfileAvatarField
              displayName={firstName.trim() || permissions.displayName || null}
              email={permissions.accountEmail ?? null}
              avatarUrl={avatarUrl}
              onAvatarChange={async (url) => {
                setAvatarUrl(url);
                setMessage(url ? 'Profile photo updated.' : 'Using initials avatar.');
                await refreshSession();
              }}
            />
          </div>
        </section>

        <form onSubmit={(e) => void save(e)} className="mt-6 space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Personal details</h2>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Email</span>
            <input
              type="email"
              value={permissions.accountEmail ?? ''}
              readOnly
              className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600"
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium text-slate-700">First name</span>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                maxLength={120}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Surname</span>
              <input
                type="text"
                value={surname}
                onChange={(e) => setSurname(e.target.value)}
                maxLength={120}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
          </div>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Qualification</span>
            <input
              type="text"
              value={qualification}
              onChange={(e) => setQualification(e.target.value)}
              maxLength={120}
              placeholder="e.g. BSc Computer Science"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Contact info</span>
            <input
              type="text"
              value={contactInfo}
              onChange={(e) => setContactInfo(e.target.value)}
              maxLength={200}
              placeholder="Phone number or other contact"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          {message && <p className="text-sm text-emerald-700">{message}</p>}
          <OutlineFillButtonAction type="submit" disabled={saving || profileLoading}>
            Save
          </OutlineFillButtonAction>
        </form>

        <form
          onSubmit={(e) => void changePassword(e)}
          className="mt-8 space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <h2 className="text-sm font-semibold text-slate-900">Change password</h2>
          <p className="text-xs text-slate-500">
            Enter your current password, then choose a new one (at least 8 characters).
          </p>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Current password</span>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              required
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">New password</span>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              minLength={8}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              required
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Confirm new password</span>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              minLength={8}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              required
            />
          </label>
          {pwError && <p className="text-sm text-red-600">{pwError}</p>}
          {pwMessage && <p className="text-sm text-emerald-700">{pwMessage}</p>}
          <OutlineFillButtonAction type="submit" disabled={pwSaving}>
            Update password
          </OutlineFillButtonAction>
        </form>
      </div>
    </AdminLayout>
  );
}
