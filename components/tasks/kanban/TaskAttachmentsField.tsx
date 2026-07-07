'use client';

import { useRef, useState } from 'react';
import { FileText, Paperclip, Upload, X } from 'lucide-react';
import { formatFileSize, taskAttachmentOpenHref, type PendingTaskAttachment, type TaskAttachment } from '@/lib/tasks/taskAttachments';
import { uploadTaskAttachment } from '@/services/taskAttachments';
import { cn } from '@/lib/ui/cn';

type TaskAttachmentsFieldProps = {
  existing: TaskAttachment[];
  pending: PendingTaskAttachment[];
  keptIds: string[];
  disabled?: boolean;
  onPendingAdd: (attachment: PendingTaskAttachment) => void;
  onPendingRemove: (index: number) => void;
  onExistingRemove: (id: string) => void;
};

export default function TaskAttachmentsField({
  existing,
  pending,
  keptIds,
  disabled,
  onPendingAdd,
  onPendingRemove,
  onExistingRemove,
}: TaskAttachmentsFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const visibleExisting = existing.filter((a) => keptIds.includes(a.id));
  const hasFiles = visibleExisting.length > 0 || pending.length > 0;

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0 || disabled) {
      return;
    }
    setError(null);
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const uploaded = await uploadTaskAttachment(file);
        onPendingAdd(uploaded);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to upload file';
      setError(msg);
    } finally {
      setUploading(false);
      if (inputRef.current) {
        inputRef.current.value = '';
      }
    }
  };

  return (
    <div className="kanban-modal-field">
      <span className="kanban-modal-label">Documents</span>
      <p className="kanban-modal-hint kanban-modal-hint--inline">
        Attach PDFs, Word, Excel, images, or text files (max 10 MB each).
      </p>

      <div
        className={cn(
          'kanban-attach-drop',
          disabled && 'kanban-attach-drop--disabled',
          uploading && 'kanban-attach-drop--busy',
        )}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          disabled={disabled || uploading}
          className="sr-only"
          accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,image/*"
          onChange={(e) => void handleFiles(e.target.files)}
        />
        <button
          type="button"
          disabled={disabled || uploading}
          className="kanban-attach-drop-btn"
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="h-4 w-4" aria-hidden />
          {uploading ? 'Uploading…' : 'Add documents'}
        </button>
      </div>

      {error && <p className="kanban-modal-error kanban-modal-error--inline">{error}</p>}

      {hasFiles && (
        <ul className="kanban-attach-list" aria-label="Attached documents">
          {visibleExisting.map((file) => (
            <li key={file.id} className="kanban-attach-item">
              <a
                href={taskAttachmentOpenHref(file)}
                target="_blank"
                rel="noopener noreferrer"
                className="kanban-attach-link"
              >
                <FileText className="h-4 w-4 shrink-0" aria-hidden />
                <span className="kanban-attach-name">{file.file_name}</span>
                {file.file_size != null && (
                  <span className="kanban-attach-size">{formatFileSize(file.file_size)}</span>
                )}
              </a>
              {!disabled && (
                <button
                  type="button"
                  className="kanban-attach-remove"
                  aria-label={`Remove ${file.file_name}`}
                  onClick={() => onExistingRemove(file.id)}
                >
                  <X className="h-3.5 w-3.5" aria-hidden />
                </button>
              )}
            </li>
          ))}
          {pending.map((file, index) => (
            <li key={`${file.file_url}-${index}`} className="kanban-attach-item kanban-attach-item--pending">
              <a
                href={taskAttachmentOpenHref(file)}
                target="_blank"
                rel="noopener noreferrer"
                className="kanban-attach-link"
              >
                <Paperclip className="h-4 w-4 shrink-0" aria-hidden />
                <span className="kanban-attach-name">{file.file_name}</span>
                {file.file_size != null && (
                  <span className="kanban-attach-size">{formatFileSize(file.file_size)}</span>
                )}
                <span className="kanban-attach-badge">New</span>
              </a>
              {!disabled && (
                <button
                  type="button"
                  className="kanban-attach-remove"
                  aria-label={`Remove ${file.file_name}`}
                  onClick={() => onPendingRemove(index)}
                >
                  <X className="h-3.5 w-3.5" aria-hidden />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
