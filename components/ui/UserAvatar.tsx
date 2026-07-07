'use client';

import { useState } from 'react';
import { avatarColorFromLabel, initialsFromLabel } from '@/lib/tasks/kanbanUtils';
import { cn } from '@/lib/ui/cn';

const sizeClass = {
  xs: 'h-6 w-6 text-[10px]',
  sm: 'h-9 w-9 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-20 w-20 text-xl',
} as const;

type UserAvatarProps = {
  label: string;
  avatarUrl?: string | null;
  size?: keyof typeof sizeClass;
  className?: string;
};

export default function UserAvatar({ label, avatarUrl, size = 'sm', className }: UserAvatarProps) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(avatarUrl?.trim()) && !failed;

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold',
        sizeClass[size],
        showImage ? 'bg-slate-100' : 'text-white',
        className,
      )}
      style={showImage ? undefined : { backgroundColor: avatarColorFromLabel(label) }}
      aria-hidden={!showImage}
    >
      {showImage ? (
        <img
          src={avatarUrl!}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        initialsFromLabel(label)
      )}
    </span>
  );
}
