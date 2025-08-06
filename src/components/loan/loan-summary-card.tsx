
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
      <div className="absolute inset-0 z-0 opacity-10">
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="geometric-pattern" patternUnits="userSpaceOnUse" width="60" height="60" patternTransform="scale(1) rotate(0)">
              <path d="M 0 10 L 10 0 L 20 10 L 10 20 Z" strokeWidth="1.5" stroke="#ffffff" fill="none"></path>
              <path d="M 30 10 L 40 0 L 50 10 L 40 20 Z" strokeWidth="1.5" stroke="#ffffff" fill="none"></path>
              <path d="M 0 40 L 10 30 L 20 40 L 10 50 Z" strokeWidth="1.5" stroke="#ffffff" fill="none"></path>
              <path d="M 30 40 L 40 30 L 50 40 L 40 50 Z" strokeWidth="1.5" stroke="#ffffff" fill="none"></path>
              <path d="M 20 40 L 30 30 L 40 40 L 30 50 Z" strokeWidth="1.5" stroke="#ffffff" fill="none"></path>
              <path d="M 20 10 L 30 0 L 40 10 L 30 20 Z" strokeWidth="1.5" stroke="#ffffff" fill="none"></path>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#geometric-pattern)"/>
        </svg>
      </div>

      <div className="relative z-10">
        <div className="absolute -top-2 -right-2 h-12 w-12 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
          <div className="h-8 w-8 bg-white/30 rounded-full" />
        </div>

        <div>
          <h3 className="text-lg font-semibold">Loan Account</h3>
          <p className="text-sm opacity-80">Max Limit: {formatCurrency(maxLoanLimit)}</p>
        </div>
        
        <div className="mt-4">
          <p className="text-base opacity-80 mb-1">Available to Borrow</p>
          <p className="text-3xl font-bold tracking-tight">{formatCurrency(availableToBorrow)}</p>
        </div>
      </div>
    </div>
  );
}
