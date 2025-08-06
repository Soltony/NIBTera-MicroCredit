
'use client';

import { useState, useEffect, useCallback } from 'react';
import type { LoanDetails, Payment } from '@/lib/types';

const MOCK_LOAN_HISTORY: LoanDetails[] = [
    {
        providerName: 'Capital Bank',
        productName: 'Personal Loan',
        loanAmount: 100,
        serviceFee: 1.5,
        interestRate: 5.0,
        dueDate: new Date('2024-08-15'),
        penaltyAmount: 10,
        repaymentStatus: 'Unpaid',
        repaidAmount: 0,
        payments: [],
    },
    {
        providerName: 'NIb Bank',
        productName: 'Quick Cash Loan',
        loanAmount: 500,
        serviceFee: 7.5,
        interestRate: 5.0,
        dueDate: new Date('2024-07-25'),
        penaltyAmount: 50,
        repaymentStatus: 'Paid',
        repaidAmount: 557.5,
        payments: [{ amount: 557.5, date: new Date('2024-07-20') }],
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

  const addLoan = useCallback((newLoan: Omit<LoanDetails, 'repaidAmount' | 'payments'>) => {
    const loanWithRepayment: LoanDetails = { ...newLoan, repaidAmount: 0, payments: [] };
    const updatedLoans = [...loans, loanWithRepayment];
    setLoans(updatedLoans);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedLoans));
    } catch (error) {
      console.warn(`Error setting localStorage key “${STORAGE_KEY}”:`, error);
    }
  }, [loans]);

  const updateLoan = useCallback((updatedLoan: LoanDetails) => {
    const updatedLoans = loans.map(loan =>
      (loan.productName === updatedLoan.productName && loan.providerName === updatedLoan.providerName) ? updatedLoan : loan
    );
    setLoans(updatedLoans);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedLoans));
    } catch (error) {
      console.warn(`Error setting localStorage key “${STORAGE_KEY}”:`, error);
    }
  }, [loans]);
  
  const addPayment = useCallback((loanToUpdate: LoanDetails, paymentAmount: number) => {
    const newPayment: Payment = { amount: paymentAmount, date: new Date() };
    const totalRepaid = (loanToUpdate.repaidAmount || 0) + paymentAmount;
    
    // This calculation should ideally be in a shared utility
    const principal = loanToUpdate.loanAmount;
    const serviceFee = loanToUpdate.serviceFee;
    const now = new Date();
    const dueDate = new Date(loanToUpdate.dueDate);
    const dailyFeeRate = 0.002;
    const loanStartDate = new Date(dueDate.getTime() - 30 * 24 * 60 * 60 * 1000);
    const daysSinceLoan = differenceInDays(now, loanStartDate);
    const dailyFees = principal * dailyFeeRate * Math.max(0, daysSinceLoan);
    const penalty = now > dueDate ? loanToUpdate.penaltyAmount : 0;
    const totalRepayable = principal + serviceFee + dailyFees + penalty;
    
    const isPaid = totalRepaid >= totalRepayable;

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
