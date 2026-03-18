import React, { useCallback, useState } from 'react';
import { UploadCloud, X, Loader2 } from 'lucide-react';
import { uploadImageToServer } from '@/services/cloudinary';

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
      setError('Failed to upload image. Please try again.');
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
      <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
      
      {value ? (
        <div className="relative rounded-xl overflow-hidden border border-gray-200 group">
          <img src={value} alt="Uploaded preview" className="w-full h-48 object-cover" />
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <button 
              type="button"
              onClick={() => onChange('')}
              className="bg-white text-red-600 px-4 py-2 rounded-lg font-medium shadow flex items-center gap-2 hover:bg-gray-50 transition"
            >
              <X className="w-4 h-4" /> Remove Image
            </button>
          </div>
        </div>
      ) : (
        <div
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center transition-colors ${
            isDragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-gray-50 hover:bg-gray-100'
          }`}
        >
          {isUploading ? (
            <div className="flex flex-col items-center text-blue-600">
              <Loader2 className="w-10 h-10 animate-spin mb-3" />
              <p className="text-sm font-medium">Uploading to Cloudinary...</p>
            </div>
          ) : (
            <>
              <UploadCloud className={`w-12 h-12 mb-3 ${isDragOver ? 'text-blue-500' : 'text-gray-400'}`} />
              <p className="text-sm font-medium text-gray-700">
                Drag & drop an image here, or
              </p>
              <label className="mt-2 cursor-pointer bg-white border border-gray-300 px-4 py-2 rounded-lg shadow-sm font-medium text-sm text-gray-700 hover:bg-gray-50 transition">
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
              <p className="text-xs text-gray-500 mt-3">Supports JPG, PNG, WEBP</p>
            </>
          )}
        </div>
      )}
      
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
