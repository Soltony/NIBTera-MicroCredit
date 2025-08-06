
'use client';

import { useState, useEffect, useCallback } from 'react';
import type { LoanDetails } from '@/lib/types';

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

  const addLoan = useCallback((newLoan: LoanDetails) => {
    const updatedLoans = [...loans, newLoan];
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
  

  return { loans, addLoan, updateLoan };
}
