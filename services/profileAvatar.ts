import axios from 'axios';

export async function uploadProfileAvatar(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await axios.post('/api/profile/avatar', formData, {
    withCredentials: true,
  });

  const url = response?.data?.avatar_url;
  if (typeof url !== 'string' || !url.trim()) {
    throw new Error('Upload succeeded but response is incomplete');
  }

  return url;
}

export async function removeProfileAvatar(): Promise<void> {
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
