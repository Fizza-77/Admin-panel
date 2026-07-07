import axios from 'axios';
import type { PendingTaskAttachment } from '@/lib/tasks/taskAttachments';
import { CLIENT_UPLOAD_TIMEOUT_MS } from '@/lib/upload/timeouts';
export async function uploadTaskAttachment(file: File): Promise<PendingTaskAttachment> {
  const formData = new FormData();
  formData.append('file', file);

  try {
    const response = await axios.post('/api/tasks/upload', formData, {
      withCredentials: true,
      timeout: CLIENT_UPLOAD_TIMEOUT_MS,
    });

    const data = response?.data;
    if (!data?.file_url || !data?.file_name) {
      throw new Error('Upload succeeded but response is incomplete');
    }

    return {
      file_name: String(data.file_name),
      file_url: String(data.file_url),
      file_type: typeof data.file_type === 'string' ? data.file_type : file.type || null,
      file_size: typeof data.file_size === 'number' ? data.file_size : file.size,
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const serverMessage = error.response?.data?.error;
      if (typeof serverMessage === 'string' && serverMessage.trim()) {
        throw new Error(serverMessage);
      }
      if (error.code === 'ECONNABORTED') {
        throw new Error('Upload timed out. Try a smaller file or check your internet connection.');
      }
    }
    throw error instanceof Error ? error : new Error('Failed to upload file');
  }
}
