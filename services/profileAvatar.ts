import axios from 'axios';

export async function uploadProfileAvatar(file: File, targetUserId?: string): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);

  const url = targetUserId
    ? `/api/employees/${encodeURIComponent(targetUserId)}/avatar`
    : '/api/profile/avatar';

  const response = await axios.post(url, formData, {
    withCredentials: true,
  });

  const avatarUrl = response?.data?.avatar_url;
  if (typeof avatarUrl !== 'string' || !avatarUrl.trim()) {
    throw new Error('Upload succeeded but response is incomplete');
  }

  return avatarUrl;
}

export async function removeProfileAvatar(targetUserId?: string): Promise<void> {
  if (targetUserId) {
    const response = await fetch(`/api/employees/${encodeURIComponent(targetUserId)}/avatar`, {
      method: 'DELETE',
      credentials: 'include',
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(body?.message || 'Could not remove profile photo');
    }
    return;
  }

  const response = await fetch('/api/profile', {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ avatar_url: null }),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body?.message || 'Could not remove profile photo');
  }
}
