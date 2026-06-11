import axios from 'axios';

// The upload preset is necessary if doing unauthenticated uploads directly from the client.
// However, typically in admin panels with secure URLs, we might upload to an API route first.
// Here we are implementing a direct-to-cloudinary approach for simplicity.
// To use unsigned uploads directly from client: A preset must be created in Cloudinary named 'ml_default'.
// Alternatively, if we need it highly secure, we make a Next.js API route that consumes the file and uploads using the API key/secret.
// The user asked for an uploader and gave API_KEY/SECRET env vars which implies Server-Side uploading.

export const uploadImageToServer = async (file: File): Promise<string> => {
  const formData = new FormData();
  formData.append('file', file);

  try {
    // Do not set Content-Type: the browser must send multipart/form-data with a boundary.
    // A bare "multipart/form-data" header breaks parsing on the server (formidable gets no file).
    const response = await axios.post('/api/upload', formData);
    const uploadedUrl = response?.data?.url;
    if (typeof uploadedUrl !== 'string' || uploadedUrl.trim().length === 0) {
      throw new Error('Upload succeeded but response URL is missing');
    }

    return uploadedUrl;
  } catch (error) {
    console.error('Error uploading image:', error);
    if (axios.isAxiosError(error)) {
      const serverMessage = error.response?.data?.error;
      if (typeof serverMessage === 'string' && serverMessage.trim()) {
        throw new Error(serverMessage);
      }
      if (error.response?.status === 503) {
        throw new Error('Permission system unavailable. Try signing out and back in, or contact an admin.');
      }
    }
    throw new Error('Failed to upload image');
  }
};
