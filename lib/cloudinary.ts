import { v2 as cloudinary, UploadApiOptions, UploadApiResponse } from 'cloudinary';
import { env } from './env/server';

cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
  secure: true,
});

export { cloudinary };

export async function uploadImage(file: Buffer | string, options: UploadApiOptions = {}): Promise<string> {
  const uploadOptions: UploadApiOptions = {
    folder: options.folder,
    overwrite: options.overwrite,
    transformation: options.transformation,
  };

  let result: UploadApiResponse;

  if (typeof file === 'string') {
    result = await cloudinary.uploader.upload(file, uploadOptions);
  } else {
    result = await new Promise<UploadApiResponse>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(uploadOptions, (error, uploadResult) => {
        if (error || !uploadResult) {
          return reject(error);
        }
        resolve(uploadResult);
      });

      uploadStream.end(file);
    });
  }

  return result.secure_url;
}

