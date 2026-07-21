'use client';

import { useRef, useState } from 'react';
import { Camera, Trash2 } from 'lucide-react';
import UserAvatar from '@/components/ui/UserAvatar';
import { LoadingOverlay } from '@/components/ui/Spinner';
import { removeProfileAvatar, uploadProfileAvatar } from '@/services/profileAvatar';
import { userDisplayLabel } from '@/lib/users/display';

type ProfileAvatarFieldProps = {
  displayName: string | null;
  email: string | null;
  avatarUrl: string | null;
  onAvatarChange: (url: string | null) => void;
  /** When set, upload/remove targets this employee (set-profiles permission). */
  targetUserId?: string;
};

export default function ProfileAvatarField({
  displayName,
  email,
  avatarUrl,
  onAvatarChange,
  targetUserId,
}: ProfileAvatarFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const label = userDisplayLabel(displayName, email);
  const busy = uploading || removing;

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please choose a JPG, PNG, or WEBP image.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be 5 MB or smaller.');
      return;
    }

    setError(null);
    setUploading(true);
    try {
      const url = await uploadProfileAvatar(file, targetUserId);
      onAvatarChange(url);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to upload photo');
    } finally {
      setUploading(false);
      if (inputRef.current) {
        inputRef.current.value = '';
      }
    }
  };

  const handleRemove = async () => {
    setError(null);
    setRemoving(true);
    try {
      await removeProfileAvatar(targetUserId);
      onAvatarChange(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to remove photo');
    } finally {
      setRemoving(false);
    }
  };

  return (
    <div className="profile-avatar-field">
      <div className="profile-avatar-preview-wrap">
        <UserAvatar label={label} avatarUrl={avatarUrl} size="lg" />
        {busy && <LoadingOverlay scope="local" label={uploading ? 'Uploading…' : 'Removing…'} size="md" className="rounded-full" />}
      </div>

      <div className="profile-avatar-actions">
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          disabled={busy}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              void handleFile(file);
            }
          }}
        />
        <button
          type="button"
          className="profile-avatar-btn"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          <Camera className="h-4 w-4" aria-hidden />
          {avatarUrl ? 'Change photo' : 'Upload photo'}
        </button>
        {avatarUrl && (
          <button
            type="button"
            className="profile-avatar-btn profile-avatar-btn--muted"
            disabled={busy}
            onClick={() => void handleRemove()}
          >
            <Trash2 className="h-4 w-4" aria-hidden />
            Use initials
          </button>
        )}
      </div>

      <p className="profile-avatar-hint">JPG, PNG, or WEBP · max 5 MB. Without a photo we show your initials.</p>
      {error && <p className="profile-avatar-error">{error}</p>}
    </div>
  );
}
