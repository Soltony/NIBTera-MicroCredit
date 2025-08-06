
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
      className="relative p-6 rounded-2xl text-yellow-900 shadow-lg flex flex-col justify-between min-h-[180px] overflow-hidden"
      style={{ backgroundColor: color }}
    >
      <div className="absolute inset-0 z-0 opacity-10">
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="honeycomb" patternUnits="userSpaceOnUse" width="40" height="23" patternTransform="scale(3) rotate(30)">
              <polygon points="20,0 40,11.5 20,23 0,11.5" fill="none" stroke="white" strokeWidth="0.5"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#honeycomb)"/>
        </svg>
      </div>
      <div className="relative z-10">
        <div className="absolute top-0 right-0 h-8 w-8 bg-white/30 rounded-full flex items-center justify-center backdrop-blur-sm">
          <div className="h-6 w-6 bg-white/40 rounded-full" />
        </div>

        <div>
          <h3 className="text-lg font-semibold">Loan Account</h3>
          <p className="text-sm opacity-80">Max Limit: {formatCurrency(maxLoanLimit)}</p>
        </div>
        
        <div className="mt-4">
          <p className="text-base opacity-80 mb-1">Available to Borrow</p>
          <p className="text-2xl font-bold tracking-tight">{formatCurrency(availableToBorrow)}</p>
        </div>
      </div>
    </div>
  );
}
