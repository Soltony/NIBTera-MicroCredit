export interface LoanProvider {
  id: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  products: LoanProduct[];
}

export interface LoanProduct {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

export interface LoanDetails {
  providerName: string;
  productName: string;
  loanAmount: number;
  serviceFee: number;
  interestRate: number;
  dueDate: Date;
  penaltyAmount: number;
  repaymentStatus: 'Paid' | 'Unpaid';
}
