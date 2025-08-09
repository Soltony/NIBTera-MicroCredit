
'use client';

import { useState, useEffect, useCallback } from 'react';
import { produce } from 'immer';

export interface ScoringParameters {
  weights: {
    transactionHistoryTotal: number;
    transactionHistoryByProduct: number;
    loanHistoryCount: number;
    onTimeRepayments: number;
    salary: number;
  };
  genderImpact: 'no_impact' | 'positive';
  occupationRisk: Record<string, 'Low' | 'Medium' | 'High'>;
}

const DEFAULT_PARAMETERS: ScoringParameters = {
  weights: {
    transactionHistoryTotal: 25,
    transactionHistoryByProduct: 20,
    loanHistoryCount: 20,
    onTimeRepayments: 25,
    salary: 10,
  },
  genderImpact: 'no_impact',
  occupationRisk: {
    'doctor': 'Low',
    'engineer': 'Low',
    'teacher': 'Low',
    'artist': 'Medium',
    'freelancer': 'Medium',
    'unemployed': 'High',
  },
};

const STORAGE_KEY = 'scoringParameters';

export function useScoringParameters() {
  const [parameters, setParameters] = useState<ScoringParameters>(DEFAULT_PARAMETERS);

  useEffect(() => {
    try {
      const item = window.localStorage.getItem(STORAGE_KEY);
      if (item) {
        // Basic migration for removing 'age'
        const parsed = JSON.parse(item);
        if (parsed?.weights?.age) {
            delete parsed.weights.age;
        }
        setParameters(parsed);
      } else {
        setParameters(DEFAULT_PARAMETERS);
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_PARAMETERS));
      }
    } catch (error) {
      console.warn(`Error reading localStorage key “${STORAGE_KEY}”:`, error);
      setParameters(DEFAULT_PARAMETERS);
    }
  }, []);

  const saveParameters = useCallback((updatedParameters: ScoringParameters) => {
    setParameters(updatedParameters);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedParameters));
    } catch (error) {
      console.warn(`Error setting localStorage key “${STORAGE_KEY}”:`, error);
    }
  }, []);

  const updateParameter = useCallback((key: keyof ScoringParameters['weights'] | 'genderImpact', value: number | string) => {
    const updated = produce(parameters, draft => {
        if (key in draft.weights) {
            draft.weights[key as keyof typeof draft.weights] = value as number;
        } else {
            draft[key as 'genderImpact'] = value as 'no_impact' | 'positive';
        }
    });
    saveParameters(updated);
  }, [parameters, saveParameters]);

  const setOccupationRisk = useCallback((occupation: string, risk: 'Low' | 'Medium' | 'High') => {
      const updated = produce(parameters, draft => {
          draft.occupationRisk[occupation] = risk;
      });
      saveParameters(updated);
  }, [parameters, saveParameters]);

  const addOccupation = useCallback((occupation: string) => {
    const updated = produce(parameters, draft => {
      if (!draft.occupationRisk[occupation]) {
        draft.occupationRisk[occupation] = 'Medium';
      }
    });
    saveParameters(updated);
  }, [parameters, saveParameters]);
  
  const removeOccupation = useCallback((occupation: string) => {
    const updated = produce(parameters, draft => {
      delete draft.occupationRisk[occupation];
    });
    saveParameters(updated);
  }, [parameters, saveParameters]);

  const resetParameters = useCallback(() => {
    saveParameters(DEFAULT_PARAMETERS);
  }, [saveParameters]);

  return { parameters, updateParameter, setOccupationRisk, addOccupation, removeOccupation, resetParameters };
}
