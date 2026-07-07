import React, { useCallback, useState } from 'react';
import { UploadCloud, X } from 'lucide-react';
import { uploadImageToServer } from '@/services/cloudinary';
import { LoadingOverlay } from '@/components/ui/Spinner';

interface ImageUploaderProps {
  value: string;
  onChange: (url: string) => void;
  label?: string;
}

export default function ImageUploader({ value, onChange, label = 'Cover Image' }: ImageUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState('');

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please upload a valid image file (JPG, PNG, WEBP)');
      return;
    }

    setIsUploading(true);
    setError('');

    try {
      const url = await uploadImageToServer(file);
      onChange(url);
    } catch (err) {
      const message = err instanceof Error && err.message ? err.message : 'Failed to upload image. Please try again.';
      setError(message);
    } finally {
      setIsUploading(false);
    }
  };

  const onDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  }, []);

  const onDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const onDragLeave = () => {
    setIsDragOver(false);
  };

  return (
    <div className="w-full">
      <label className="blog-editor-upload-label">{label}</label>

      {value ? (
        <div className="blog-editor-upload-preview group">
          <img src={value} alt="Uploaded preview" />
          <div className="blog-editor-upload-preview-overlay">
            <button
              type="button"
              onClick={() => onChange('')}
              className="blog-editor-upload-remove"
            >
              <X className="w-4 h-4" aria-hidden /> Remove image
            </button>
          </div>
        </div>
      ) : (
        <div
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          className={`blog-editor-upload-zone ${isDragOver ? 'blog-editor-upload-zone--active' : ''}`}
        >
          {isUploading && (
            <LoadingOverlay scope="local" label="Uploading to Cloudinary…" size="lg" className="rounded-[10px]" />
          )}
          {!isUploading && (
            <>
              <UploadCloud className="blog-editor-upload-icon" aria-hidden />
              <p className="blog-editor-upload-text">
                Drag & drop an image here, or
              </p>
              <label className="blog-editor-upload-browse">
                <span>Browse files</span>
                <input
                  type="file"
                  className="hidden"
                  accept="image/jpeg, image/png, image/webp"
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      handleFile(e.target.files[0]);
                    }
                  }}
                />
              </label>
              <p className="blog-editor-upload-hint">Supports JPG, PNG, WEBP</p>
            </>
          )}
        </div>
      )}

      {error && <p className="blog-editor-upload-error">{error}</p>}
    </div>
  );
}
