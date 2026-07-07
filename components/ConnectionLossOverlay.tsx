'use client';

import { useEffect, useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { WifiOff } from 'lucide-react';
import { OutlineFillButtonAction } from '@/components/ui/OutlineFillButton';

type ConnectionLossOverlayProps = {
  retrying?: boolean;
  onRetry: () => void;
};

export default function ConnectionLossOverlay({ retrying, onRetry }: ConnectionLossOverlayProps) {
  const [mounted, setMounted] = useState(false);

  useLayoutEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) {
      return;
    }
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mounted]);

  if (!mounted) {
    return null;
  }

  return createPortal(
    <div className="conn-loss-overlay" role="alertdialog" aria-modal="true" aria-labelledby="conn-loss-title">
      <div className="conn-loss-card">
        <div className="conn-loss-icon-wrap" aria-hidden>
          <span className="conn-loss-ring conn-loss-ring--outer" />
          <span className="conn-loss-ring conn-loss-ring--inner" />
          <span className="conn-loss-icon">
            <WifiOff className="h-8 w-8" />
          </span>
        </div>

        <p className="conn-loss-eyebrow">Oh no!</p>
        <h2 id="conn-loss-title" className="conn-loss-title">
          Looks like you have lost your connection.
        </h2>
        <p className="conn-loss-copy">
          We couldn&apos;t reach the server. Check your Wi‑Fi or mobile data and try again.
        </p>

        <OutlineFillButtonAction
          type="button"
          className="conn-loss-retry"
          onClick={onRetry}
          disabled={retrying}
        >
          {retrying ? 'Reconnecting…' : 'Try again'}
        </OutlineFillButtonAction>
      </div>
    </div>,
    document.body,
  );
}
