
'use client';

interface LoanSummaryCardProps {
  maxLoanLimit: number;
  availableToBorrow: number;
  color?: string;
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
};

export function LoanSummaryCard({ maxLoanLimit, availableToBorrow, color = '#fdb913' }: LoanSummaryCardProps) {
  return (
    <div 
      className="relative p-6 rounded-2xl text-primary-foreground shadow-lg flex flex-col justify-between min-h-[180px] overflow-hidden"
      style={{ backgroundColor: color }}
    >
      <div className="absolute inset-0 z-0 opacity-20">
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="hex-pattern" patternUnits="userSpaceOnUse" width="40" height="69.28" patternTransform="scale(1) rotate(0)">
              <polygon points="20,0 40,17.32 40,51.96 20,69.28 0,51.96 0,17.32" stroke="#ffffff" strokeWidth="1.5" fill="none" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#hex-pattern)"/>
        </svg>
      </div>

      <div className="relative z-10 grid grid-cols-2 gap-4 items-center h-full">
        <div>
            <p className="text-lg opacity-80 mb-1">Available to Borrow</p>
            <p className="text-4xl font-bold tracking-tight">{formatCurrency(availableToBorrow)}</p>
        </div>
        <div className="text-right">
            <p className="text-sm opacity-80 mb-1">Maximum Loan Limit</p>
            <p className="text-2xl font-semibold tracking-tight">{formatCurrency(maxLoanLimit)}</p>
        </div>
      </div>
    </div>
  );
}
