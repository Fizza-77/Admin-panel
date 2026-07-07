'use client';

import { useEffect, useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/ui/cn';
import { useRotatingLoadingLabel } from '@/lib/ui/useRotatingLoadingLabel';

export type SpinnerSize = 'xs' | 'sm' | 'md' | 'lg';

type SpinnerProps = {
  size?: SpinnerSize;
  className?: string;
  /** Accessible label for screen readers */
  label?: string;
};

const sizeClass: Record<SpinnerSize, string> = {
  xs: 'ui-cube-spinner--xs',
  sm: 'ui-cube-spinner--sm',
  md: 'ui-cube-spinner--md',
  lg: 'ui-cube-spinner--lg',
};

const stageClass: Record<SpinnerSize, string> = {
  xs: 'ui-cube-spinner-stage--xs',
  sm: 'ui-cube-spinner-stage--sm',
  md: 'ui-cube-spinner-stage--md',
  lg: 'ui-cube-spinner-stage--lg',
};

/** 3D cube loading spinner (Uiverse.io by bociKond). */
export default function Spinner({ size = 'md', className, label = 'Loading' }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-live="polite"
      aria-label={label}
      className={cn('ui-cube-spinner-wrap', sizeClass[size], className)}
    >
      <span className="ui-cube-spinner">
        <span />
        <span />
        <span />
        <span />
        <span />
        <span />
      </span>
    </span>
  );
}

type LoadingInlineProps = {
  label?: string;
  size?: SpinnerSize;
  className?: string;
  /** Caption styling when shown on the loading overlay */
  onOverlay?: boolean;
};

/** Spinner with optional caption — for upload areas and centered states. */
export function LoadingInline({ label, size = 'md', className, onOverlay }: LoadingInlineProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-4 text-center', className)}>
      <div className={cn('ui-cube-spinner-stage', stageClass[size])}>
        <Spinner size={size} label={label ?? 'Loading'} />
      </div>
      {label ? (
        <p
          key={label}
          className={cn(
            'text-sm font-medium leading-snug transition-opacity duration-300',
            onOverlay ? 'text-[#374151]' : 'text-[#6B7280]',
          )}
        >
          {label}
        </p>
      ) : null}
    </div>
  );
}

type LoadingOverlayProps = {
  label?: string;
  /** Cycle through messages — useful for long page loads and multi-step fetches */
  messages?: string[];
  rotateIntervalMs?: number;
  size?: SpinnerSize;
  /** `fixed` covers the viewport; `local` covers the nearest positioned parent */
  scope?: 'fixed' | 'local';
  className?: string;
};

/** Frosted white backdrop with centered spinner — blocks interaction while loading. */
export function LoadingOverlay({
  label,
  messages,
  rotateIntervalMs = 2800,
  size = 'lg',
  scope = 'fixed',
  className,
}: LoadingOverlayProps) {
  const [mounted, setMounted] = useState(false);
  const resolvedMessages =
    messages && messages.length > 0 ? messages : label ? [label] : ['Loading…'];
  const displayLabel = useRotatingLoadingLabel(true, resolvedMessages, rotateIntervalMs);

  useLayoutEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (scope !== 'fixed' || !mounted) {
      return;
    }
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [scope, mounted]);

  const overlay = (
    <div
      className={cn(
        scope === 'fixed' ? 'fixed inset-0 z-[9999]' : 'absolute inset-0 z-20',
        'flex items-center justify-center bg-white/75 backdrop-blur-md',
        className,
      )}
      aria-busy="true"
      aria-live="polite"
      aria-label={displayLabel}
    >
      <LoadingInline label={displayLabel} size={size} onOverlay />
    </div>
  );

  if (scope === 'fixed') {
    if (!mounted) {
      return null;
    }
    return createPortal(overlay, document.body);
  }

  return overlay;
}

type LoadingCenterProps = {
  label?: string;
  size?: SpinnerSize;
  className?: string;
};

/** Full-viewport loading with frosted white overlay. */
export function LoadingCenter({ label, size = 'lg', className }: LoadingCenterProps) {
  return <LoadingOverlay label={label} size={size} scope="fixed" className={className} />;
}
