'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Globe2 } from 'lucide-react';
import { getSiteLogoPath } from '@/lib/sites/siteLogo';
import type { Site } from '@/types/site';
import { cn } from '@/lib/ui/cn';

type SiteLogoProps = {
  site: Pick<Site, 'site_key' | 'domain' | 'name'>;
  className?: string;
  imageClassName?: string;
  size?: 'md' | 'lg';
};

const sizeMap = {
  md: { box: 'h-14 w-14', px: 56 },
  lg: { box: 'h-16 w-16', px: 64 },
};

export default function SiteLogo({ site, className, imageClassName, size = 'md' }: SiteLogoProps) {
  const logoPath = getSiteLogoPath(site);
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(logoPath) && !failed;
  const dims = sizeMap[size];

  const label = site.name || site.domain || site.site_key || 'Site';

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center overflow-hidden',
        dims.box,
        !showImage && 'rounded-[18px] bg-[#F3F4F6] ring-1 ring-[#E5E7EB]',
        className,
      )}
    >
      {showImage ? (
        <Image
          src={logoPath!}
          alt={`${label} logo`}
          width={dims.px}
          height={dims.px}
          className={cn('h-full w-full object-contain', imageClassName)}
          onError={() => setFailed(true)}
        />
      ) : (
        <Globe2 className="h-6 w-6 text-[#9CA3AF]" strokeWidth={1.5} aria-hidden />
      )}
    </span>
  );
}
