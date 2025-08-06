
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
            <pattern id="hexagons" patternUnits="userSpaceOnUse" width="100" height="86.6" patternTransform="scale(1.5) rotate(45)">
              <g id="hexagon">
                <polygon points="50,0 100,28.87 100,86.6 50,115.47 0,86.6 0,28.87" fill="#ffffff" />
                <polygon points="50,0 100,28.87 50,57.74 0,28.87" fill="#f2f2f2" />
                <polygon points="0,28.87 0,86.6 50,57.74" fill="#e6e6e6" />
                <polygon points="0,86.6 50,115.47 50,57.74" fill="#d9d9d9" />
              </g>
              <use href="#hexagon" x="100" y="0" />
              <use href="#hexagon" x="50" y="86.6" />
              <use href="#hexagon" x="-50" y="86.6" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#hexagons)"/>
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
