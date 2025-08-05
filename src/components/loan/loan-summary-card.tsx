
'use client';

interface LoanSummaryCardProps {
  maxLoanLimit: number;
  availableToBorrow: number;
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
};

export function LoanSummaryCard({ maxLoanLimit, availableToBorrow }: LoanSummaryCardProps) {
  return (
    <div className="relative p-6 rounded-2xl text-yellow-900 bg-gradient-to-br from-yellow-300 to-yellow-400 shadow-lg flex flex-col justify-between min-h-[180px]">
      <div className="absolute top-4 right-4 h-8 w-8 bg-white/30 rounded-full flex items-center justify-center backdrop-blur-sm">
        <div className="h-6 w-6 bg-white/40 rounded-full" />
      </div>

      <div>
        <h3 className="text-lg font-semibold">Loan Account</h3>
        <p className="text-sm opacity-80">Max Limit: {formatCurrency(maxLoanLimit)}</p>
      </div>
      
      <div>
        <p className="text-xs opacity-80 mb-1">Available to Borrow</p>
        <p className="text-4xl font-bold tracking-tight">{formatCurrency(availableToBorrow)}</p>
      </div>
    </div>
  );
}
