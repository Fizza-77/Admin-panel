import Link from 'next/link';
import { cn } from '@/lib/ui/cn';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

type OutlineFillButtonSharedProps = {
  className?: string;
  children: ReactNode;
  icon?: ReactNode;
};

type OutlineFillButtonLinkProps = OutlineFillButtonSharedProps & {
  href: string;
  /** false = content width (headers/toolbars). true = full width (dashboard cards). */
  fullWidth?: boolean;
};

type OutlineFillButtonActionProps = OutlineFillButtonSharedProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'>;

function OutlineFillButtonContent({ icon, children }: { icon?: ReactNode; children: ReactNode }) {
  return (
    <span>
      {icon}
      {children}
    </span>
  );
}

/** Link CTA — full width by default (blog dashboard cards). */
export default function OutlineFillButton({
  href,
  className,
  children,
  icon,
  fullWidth = true,
}: OutlineFillButtonLinkProps) {
  return (
    <Link
      href={href}
      className={cn('ui-outline-fill-btn', !fullWidth && 'ui-outline-fill-btn--auto', className)}
    >
      <OutlineFillButtonContent icon={icon}>{children}</OutlineFillButtonContent>
    </Link>
  );
}

/** Button CTA — inline width by default; pass `className="!w-full"` for full-width forms. */
export function OutlineFillButtonAction({
  className,
  children,
  icon,
  type = 'button',
  ...rest
}: OutlineFillButtonActionProps) {
  return (
    <button type={type} className={cn('ui-outline-fill-btn', 'ui-outline-fill-btn--auto', className)} {...rest}>
      <OutlineFillButtonContent icon={icon}>{children}</OutlineFillButtonContent>
    </button>
  );
}

export function BlogsListIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z" />
    </svg>
  );
}

export function SetupIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.488.488 0 0 0-.59-.22l-2.39.96c-.5-.38-1.05-.7-1.65-.94l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.6.24-1.15.57-1.65.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.05.7 1.65.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.6-.24 1.15-.57 1.65-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
    </svg>
  );
}

export function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
    </svg>
  );
}
