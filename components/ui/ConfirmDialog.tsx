'use client';

import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { OutlineFillButtonAction } from '@/components/ui/OutlineFillButton';
import { cn } from '@/lib/ui/cn';

type ConfirmDialogTone = 'danger' | 'primary';

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmDialogTone;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'primary',
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useLayoutEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open || !mounted) {
      return;
    }

    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !loading) {
        onCancel();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [loading, mounted, onCancel, open]);

  useEffect(() => {
    if (!open || !panelRef.current) {
      return;
    }
    panelRef.current.focus();
  }, [open]);

  if (!mounted || !open) {
    return null;
  }

  const icon =
    tone === 'danger' ? (
      <Trash2 className="h-5 w-5" aria-hidden />
    ) : (
      <AlertTriangle className="h-5 w-5" aria-hidden />
    );

  return createPortal(
    <div className="ui-confirm-overlay" role="presentation" onMouseDown={loading ? undefined : onCancel}>
      <div
        ref={panelRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn('ui-confirm-dialog', tone === 'danger' && 'ui-confirm-dialog--danger')}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div
          className={cn(
            'ui-confirm-icon',
            tone === 'danger' ? 'ui-confirm-icon--danger' : 'ui-confirm-icon--primary',
          )}
          aria-hidden
        >
          {icon}
        </div>

        <h2 id={titleId} className="ui-confirm-title">
          {title}
        </h2>
        <div className="ui-confirm-description">{description}</div>

        <div className="ui-confirm-actions">
          <OutlineFillButtonAction
            type="button"
            className="ui-outline-fill-btn--muted ui-outline-fill-btn--dialog"
            disabled={loading}
            onClick={onCancel}
          >
            {cancelLabel}
          </OutlineFillButtonAction>
          <OutlineFillButtonAction
            type="button"
            className={cn(
              'ui-outline-fill-btn--dialog',
              tone === 'danger' && 'ui-outline-fill-btn--danger',
            )}
            disabled={loading}
            onClick={onConfirm}
          >
            {loading ? 'Please wait…' : confirmLabel}
          </OutlineFillButtonAction>
        </div>
      </div>
    </div>,
    document.body,
  );
}
