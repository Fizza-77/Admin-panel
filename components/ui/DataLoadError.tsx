import { AlertCircle } from 'lucide-react';
import { cn } from '@/lib/ui/cn';

type DataLoadErrorProps = {
  title?: string;
  message: string;
  detail?: string | null;
  className?: string;
};

export default function DataLoadError({
  title = 'Could not load data',
  message,
  detail,
  className,
}: DataLoadErrorProps) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900',
        className,
      )}
      role="alert"
    >
      <div className="flex items-start gap-2">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-hidden />
        <div className="min-w-0">
          <p className="font-semibold">{title}</p>
          <p className="mt-1 text-red-800">{message}</p>
          {detail && (
            <p className="mt-2 font-mono text-xs text-red-700/90 break-all">{detail}</p>
          )}
        </div>
      </div>
    </div>
  );
}
