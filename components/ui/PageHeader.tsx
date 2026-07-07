import type { ReactNode } from 'react';
import { cn } from '@/lib/ui/cn';

type PageHeaderProps = {
  title?: string;
  description?: string;
  breadcrumbs?: { label: string; href?: string }[];
  actions?: ReactNode;
  className?: string;
};

export default function PageHeader({ title, description, breadcrumbs, actions, className }: PageHeaderProps) {
  return (
    <header className={cn('mb-6 sm:mb-8 animate-fade-in', className)}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav aria-label="Breadcrumb" className="mb-2 flex flex-wrap items-center gap-1.5 text-xs text-zinc-500">
          {breadcrumbs.map((crumb, i) => (
            <span key={`${crumb.label}-${i}`} className="inline-flex items-center gap-1.5">
              {i > 0 && <span aria-hidden className="text-zinc-300">/</span>}
              {crumb.href ? (
                <a href={crumb.href} className="hover:text-zinc-800 transition-colors">
                  {crumb.label}
                </a>
              ) : (
                <span className="text-zinc-700 font-medium">{crumb.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          {title && <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-zinc-900">{title}</h1>}
          {description && <p className="max-w-2xl text-sm text-zinc-500 leading-relaxed">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}
