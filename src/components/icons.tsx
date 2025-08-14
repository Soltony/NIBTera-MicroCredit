
'use client';

import { SVGProps, useEffect, useState } from 'react';
import { getCustomIcon } from '@/lib/types';
import { Building2, Landmark, Briefcase, Home, PersonStanding, CreditCard, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';


export function Logo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M12 2L2 7l10 5 10-5-10-5z" fill="hsl(var(--primary))" />
      <path d="M2 17l10 5 10-5" />
      <path d="M2 12l10 5 10-5" />
    </svg>
  );
}

// A helper to map string names to actual icon components
const iconMap: { [key: string]: React.ElementType } = {
  Building2,
  Landmark,
  Briefcase,
  Home,
  PersonStanding,
  CreditCard,
  Wallet,
};

export const IconDisplay = ({ iconName, className }: { iconName: string; className?: string }) => {
    const isCustom = typeof iconName === 'string' && iconName.startsWith('custom-icon-');
    const [customIconSrc, setCustomIconSrc] = useState<string | null>(null);

    useEffect(() => {
        if (isCustom) {
            const src = getCustomIcon(iconName);
            setCustomIconSrc(src);
        }
    }, [iconName, isCustom]);

    if (isCustom) {
        return customIconSrc ? <img src={customIconSrc} alt="Custom Icon" className={cn("h-6 w-6", className)} /> : <div className={cn("h-6 w-6", className)} />;
    }

    const IconComponent = iconMap[iconName] || Building2;
    return <IconComponent className={cn("h-6 w-6", className)} />;
};
