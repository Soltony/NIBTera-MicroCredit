
'use client';

import { useState, useEffect, useCallback } from 'react';
import type { LoanDetails, Payment } from '@/lib/types';
import { differenceInDays, subDays } from 'date-fns';
import { calculateTotalRepayable } from '@/lib/types';

// The hook now primarily manages optimistic UI updates and local state modifications after backend interactions.
// The initial data load is handled by the server component.

const STORAGE_KEY = 'loanHistory'; // Still useful for persisting new loans immediately on client-side

export function useLoanHistory(initialLoans: LoanDetails[] = []) {
  const [loans, setLoans] = useState<LoanDetails[]>(initialLoans);

  useEffect(() => {
    // We still read from local storage to immediately reflect any loans added on the client-side
    // before a full server refresh. This helps with optimistic UI updates.
    try {
      const item = window.localStorage.getItem(STORAGE_KEY);
      if (item) {
        const parsedLoans = JSON.parse(item).map((loan: any) => ({
          ...loan,
          id: loan.id || `loan-${Date.now()}-${Math.random()}`,
          disbursedDate: loan.disbursedDate ? new Date(loan.disbursedDate) : subDays(new Date(loan.dueDate), 30),
          dueDate: new Date(loan.dueDate),
          payments: loan.payments ? loan.payments.map((p: any) => ({...p, date: new Date(p.date)})) : [],
        }));
        // We can decide how to merge server data and local data.
        // For now, let's assume server data is the source of truth on initial load.
        // This effect will mainly help capture client-side additions between page loads.
      } else {
         window.localStorage.setItem(STORAGE_KEY, JSON.stringify(initialLoans));
      }
    } catch (error) {
      console.warn(`Error interacting with localStorage key “${STORAGE_KEY}”:`, error);
    }
  }, [initialLoans]);


  const addLoan = useCallback((newLoan: Omit<LoanDetails, 'id' | 'repaidAmount' | 'payments'>) => {
    const loanWithId: LoanDetails = { 
        ...newLoan, 
        id: `loan-${Date.now()}-${Math.random()}`, 
        repaidAmount: 0, 
        payments: [] 
    };
    const updatedLoans = [...loans, loanWithId];
    setLoans(updatedLoans);
    // Persist to local storage for immediate feedback on subsequent client-side navigations
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedLoans));
      // In a real app, you would also make an API call here to save the loan to the database.
      // fetch('/api/loans', { method: 'POST', body: JSON.stringify(loanWithId) });
    } catch (error) {
      console.warn(`Error setting localStorage key “${STORAGE_KEY}”:`, error);
    }
  }, [loans]);

  const addPayment = useCallback((loanToUpdate: LoanDetails, paymentAmount: number): LoanDetails => {
    const paymentDate = new Date();
    const totalRepayableAtPaymentDate = calculateTotalRepayable(loanToUpdate, paymentDate);
    const outstandingBalanceBeforePayment = totalRepayableAtPaymentDate - (loanToUpdate.repaidAmount || 0);
    
    const newPayment: Payment = { amount: paymentAmount, date: paymentDate, outstandingBalanceBeforePayment };
    const totalRepaid = (loanToUpdate.repaidAmount || 0) + paymentAmount;
    
    const totalRepayableToday = calculateTotalRepayable(loanToUpdate, new Date());
    const isPaid = totalRepaid >= totalRepayableToday - 0.01;

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
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedLoans));
    } catch (error) {
      console.warn(`Error setting localStorage key “${STORAGE_KEY}”:`, error);
    }
    
    return updatedLoan;

  }, [loans]);

  return { addLoan, addPayment };
}
