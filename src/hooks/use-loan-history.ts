
'use client';

import { useState, useCallback } from 'react';
import type { LoanDetails, Payment } from '@/lib/types';
import { calculateTotalRepayable } from '@/lib/types';

// This hook is now simplified to only handle the client-side logic for repayment updates.
// The initial data load and new loan creation are handled by server components and API calls respectively.

export function useLoanHistory(initialLoans: LoanDetails[] = []) {
  const [loans, setLoans] = useState<LoanDetails[]>(initialLoans);

  const addPayment = useCallback((loanToUpdate: LoanDetails, paymentAmount: number): LoanDetails => {
    // This function can remain as it's useful for optimistic UI updates on repayment.
    // However, a real app would also make an API call here to persist the payment.
    const paymentDate = new Date();
    const totalRepayableAtPaymentDate = calculateTotalRepayable(loanToUpdate, paymentDate);
    const outstandingBalanceBeforePayment = totalRepayableAtPaymentDate - (loanToUpdate.repaidAmount || 0);
    
    const newPayment: Payment = { amount: paymentAmount, date: paymentDate, outstandingBalanceBeforePayment };
    const totalRepaid = (loanToUpdate.repaidAmount || 0) + paymentAmount;
    
    const totalRepayableToday = calculateTotalRepayable(loanToUpdate, new Date());
    const isPaid = totalRepaid >= totalRepayableToday - 0.01; // Using a small tolerance for floating point issues

    const updatedLoan: LoanDetails = {
      ...loanToUpdate,
      repaidAmount: totalRepaid,
      payments: [...(loanToUpdate.payments || []), newPayment],
      repaymentStatus: isPaid ? 'Paid' : 'Unpaid',
    };

    const updatedLoans = loans.map(loan =>
      (loan.id === updatedLoan.id) ? updatedLoan : loan
    );
    setLoans(updatedLoans);
    
    // In a real app, you would make an API call here:
    // fetch(`/api/loans/${loanToUpdate.id}/payments`, { method: 'POST', body: JSON.stringify(newPayment) });
    
    return updatedLoan;

  }, [loans]);

  // addLoan is removed as it's now handled directly via API call in ApplyClient.tsx
  // The state of the loan history will be updated on the next page load/server fetch.

  return { addPayment, loans, setLoans };
}
