
'use client';

import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Skeleton } from '../ui/skeleton';

interface LoanSummaryCardProps {
  maxLoanLimit: number;
  availableToBorrow: number;
  color?: string;
  isLoading?: boolean;
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
};

export function LoanSummaryCard({ maxLoanLimit, availableToBorrow, color, isLoading = false }: LoanSummaryCardProps) {
    const [isMaxLimitVisible, setIsMaxLimitVisible] = useState(true);
    const [isAvailableVisible, setIsAvailableVisible] = useState(true);

    const toggleMaxLimitVisibility = () => {
        setIsMaxLimitVisible(!isMaxLimitVisible);
    }
    
    const toggleAvailableVisibility = () => {
        setIsAvailableVisible(!isAvailableVisible);
    }

    const renderAmount = (amount: number, isVisible: boolean) => {
        if (!isVisible) {
            return '******';
        }
        return formatCurrency(amount);
    }

  const displayColor = color || '#fdb913';

  return (
    <div 
      className="relative p-6 rounded-2xl text-primary-foreground shadow-lg flex flex-col justify-between min-h-[180px] overflow-hidden"
      style={{ backgroundColor: displayColor }}
    >
      <div className="absolute inset-0 z-0 opacity-10">
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="hex-pattern" patternUnits="userSpaceOnUse" width="40" height="69.28" patternTransform="scale(1) rotate(0)">
              <polygon points="20,0 40,17.32 40,51.96 20,69.28 0,51.96 0,17.32" stroke="currentColor" strokeWidth="1.5" fill="none" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#hex-pattern)"/>
        </svg>
      </div>
      
      <div className="relative z-10 flex flex-col justify-between h-full">
        <div>
            <div className="flex items-center gap-2">
                <p className="text-sm opacity-80 mb-1">Maximum Loan Limit</p>
                <button onClick={toggleMaxLimitVisibility} className="text-primary-foreground focus:outline-none">
                    {isMaxLimitVisible ? <Eye className="h-5 w-5 opacity-80" /> : <EyeOff className="h-5 w-5 opacity-80" />}
                </button>
            </div>
             {isLoading ? <Skeleton className="h-8 w-48 bg-white/20" /> : <p className="text-2xl font-semibold tracking-tight">{renderAmount(maxLoanLimit, isMaxLimitVisible)}</p>}
        </div>
        <div className="text-right">
            <div className="flex items-center gap-2 justify-end">
                <p className="text-lg opacity-80 mb-1">Available to Borrow</p>
                 <button onClick={toggleAvailableVisibility} className="text-primary-foreground focus:outline-none">
                    {isAvailableVisible ? <Eye className="h-5 w-5 opacity-80" /> : <EyeOff className="h-5 w-5 opacity-80" />}
                </button>
            </div>
             {isLoading ? <Skeleton className="h-10 w-56 bg-white/20 ml-auto" /> : <p className="text-4xl font-bold tracking-tight">{renderAmount(availableToBorrow, isAvailableVisible)}</p>}
        </div>
      </div>
    </div>
  );
}
