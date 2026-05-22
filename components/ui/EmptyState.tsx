import type { ReactNode } from 'react';
import { cn } from '@/lib/ui/cn';

type EmptyStateProps = {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
};

export default function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'ui-surface flex flex-col items-center justify-center px-6 py-14 text-center border-dashed',
        className,
      )}
      role="status"
    >
      {icon && <div className="mb-4 text-zinc-300">{icon}</div>}
      <h2 className="text-base font-semibold text-zinc-800">{title}</h2>
      {description && <p className="mt-2 max-w-md text-sm text-zinc-500 leading-relaxed">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
