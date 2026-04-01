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

    return response.data.url;
  } catch (error) {
    console.error('Error uploading image:', error);
    throw new Error('Failed to upload image');
  }
};
