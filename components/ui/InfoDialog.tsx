'use client';

import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Sparkles } from 'lucide-react';
import { OutlineFillButtonAction } from '@/components/ui/OutlineFillButton';

type InfoDialogProps = {
  open: boolean;
  title: string;
  description?: React.ReactNode;
  closeLabel?: string;
  onClose: () => void;
};

/** Single-button informational dialog (e.g. "Coming soon!"). */
export default function InfoDialog({
  open,
  title,
  description,
  closeLabel = 'Got it',
  onClose,
}: InfoDialogProps) {
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
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [mounted, onClose, open]);

  useEffect(() => {
    if (!open || !panelRef.current) {
      return;
    }
    panelRef.current.focus();
  }, [open]);

  if (!mounted || !open) {
    return null;
  }

  return createPortal(
    <div className="ui-confirm-overlay" role="presentation" onMouseDown={onClose}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="ui-confirm-dialog"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="ui-confirm-icon ui-confirm-icon--primary" aria-hidden>
          <Sparkles className="h-5 w-5" aria-hidden />
        </div>

        <h2 id={titleId} className="ui-confirm-title">
          {title}
        </h2>
        {description && <div className="ui-confirm-description">{description}</div>}

        <div className="ui-confirm-actions">
          <OutlineFillButtonAction
            type="button"
            className="ui-outline-fill-btn--dialog"
            onClick={onClose}
          >
            {closeLabel}
          </OutlineFillButtonAction>
        </div>
      </div>
    </div>,
    document.body,
  );
}
