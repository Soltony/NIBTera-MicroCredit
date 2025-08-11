
'use client';

import { useState, useEffect, useCallback } from 'react';
import type { LoanDetails, Payment } from '@/lib/types';
import { differenceInDays, subDays } from 'date-fns';
import { calculateTotalRepayable } from '@/lib/types';

const MOCK_LOAN_HISTORY: LoanDetails[] = [
    {
        id: `loan-${Date.now()}-2`,
        providerName: 'NIb Bank',
        productName: 'Quick Cash Loan',
        loanAmount: 500,
        serviceFee: 15, // 3% of 500
        interestRate: 0.2,
        disbursedDate: subDays(new Date('2024-07-25'), 30),
        dueDate: new Date('2024-07-25'),
        penaltyAmount: 0.11,
        repaymentStatus: 'Paid',
        repaidAmount: 545.96, // Corrected to match the actual calculated total
        payments: [{ amount: 545.96, date: new Date('2024-07-20'), outstandingBalanceBeforePayment: 545.96 }],
    },
];


const STORAGE_KEY = 'loanHistory';

export function useLoanHistory() {
  const [loans, setLoans] = useState<LoanDetails[]>([]);

  useEffect(() => {
    try {
      const item = window.localStorage.getItem(STORAGE_KEY);
      if (item) {
        const parsedLoans = JSON.parse(item).map((loan: any) => ({
          ...loan,
          id: loan.id || `loan-${Date.now()}-${Math.random()}`, // Ensure old loans get an ID
          disbursedDate: loan.disbursedDate ? new Date(loan.disbursedDate) : subDays(new Date(loan.dueDate), 30),
          dueDate: new Date(loan.dueDate), // Deserialize date
          payments: loan.payments ? loan.payments.map((p: any) => ({...p, date: new Date(p.date)})) : [],
        }));
        setLoans(parsedLoans);
      } else {
        // Initialize with mock data if no history exists
        setLoans(MOCK_LOAN_HISTORY);
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(MOCK_LOAN_HISTORY));
      }
    } catch (error) {
      console.warn(`Error reading localStorage key “${STORAGE_KEY}”:`, error);
      setLoans(MOCK_LOAN_HISTORY);
    }
  }, []);

  const addLoan = useCallback((newLoan: Omit<LoanDetails, 'id' | 'repaidAmount' | 'payments'>) => {
    const loanWithId: LoanDetails = { 
        ...newLoan, 
        id: `loan-${Date.now()}-${Math.random()}`, 
        repaidAmount: 0, 
        payments: [] 
    };
    const updatedLoans = [...loans, loanWithId];
    setLoans(updatedLoans);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedLoans));
    } catch (error) {
      console.warn(`Error setting localStorage key “${STORAGE_KEY}”:`, error);
    }
  }, [loans]);

  const updateLoan = useCallback((updatedLoan: LoanDetails) => {
    const updatedLoans = loans.map(loan =>
      (loan.id === updatedLoan.id) ? updatedLoan : loan
    );
    setLoans(updatedLoans);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedLoans));
    } catch (error) {
      console.warn(`Error setting localStorage key “${STORAGE_KEY}”:`, error);
    }
  }, [loans]);
  
  const addPayment = useCallback((loanToUpdate: LoanDetails, paymentAmount: number) => {
    const paymentDate = new Date();
    const totalRepayableAtPaymentDate = calculateTotalRepayable(loanToUpdate, paymentDate);
    const outstandingBalanceBeforePayment = totalRepayableAtPaymentDate - (loanToUpdate.repaidAmount || 0);
    
    const newPayment: Payment = { amount: paymentAmount, date: paymentDate, outstandingBalanceBeforePayment };
    const totalRepaid = (loanToUpdate.repaidAmount || 0) + paymentAmount;
    
    // Check against total repayable today
    const totalRepayableToday = calculateTotalRepayable(loanToUpdate, new Date());
    // Use a small epsilon to handle floating point inaccuracies
    const isPaid = totalRepaid >= totalRepayableToday - 0.01;

    const updatedLoan: LoanDetails = {
      ...loanToUpdate,
      repaidAmount: totalRepaid,
      payments: [...(loanToUpdate.payments || []), newPayment],
      repaymentStatus: isPaid ? 'Paid' : 'Unpaid',
    };

    updateLoan(updatedLoan);

  }, [updateLoan]);

  return { loans, addLoan, updateLoan, addPayment };
}
