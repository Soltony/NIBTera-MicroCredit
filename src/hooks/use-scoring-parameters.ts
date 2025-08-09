
'use client';

import { useState, useEffect, useCallback } from 'react';
import { produce } from 'immer';

export type GenderImpact = number;

export interface ScoringParameters {
  weights: {
    transactionHistoryTotal: number;
    transactionHistoryByProduct: number;
    loanHistoryCount: number;
    onTimeRepayments: number;
    salary: number;
  };
  genderImpact: {
    enabled: boolean;
    male: GenderImpact;
    female: GenderImpact;
  };
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
  genderImpact: {
    enabled: false,
    male: 0,
    female: 0,
  },
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

// Helper for migrating old data structure
const migrateParameters = (data: any): ScoringParameters => {
    // Check for old structure without 'enabled' flag
    if (data.genderImpact && typeof data.genderImpact.enabled === 'undefined') {
        return {
            ...data,
            genderImpact: {
                enabled: false, // Default to disabled for old structures
                male: 0,
                female: 0,
            }
        };
    }
    // Check for even older structure where impact was a string
    if (data.genderImpact && typeof data.genderImpact.male === 'string') {
        return {
             ...data,
            genderImpact: {
                enabled: data.genderImpact.enabled,
                male: 0,
                female: 0,
            }
        }
    }
    return data;
}


export function useScoringParameters() {
  const [parameters, setParameters] = useState<ScoringParameters>(DEFAULT_PARAMETERS);

  useEffect(() => {
    try {
      const item = window.localStorage.getItem(STORAGE_KEY);
      if (item) {
        const parsed = JSON.parse(item);
        if (parsed?.weights?.age) {
            delete parsed.weights.age;
        }
        const migrated = migrateParameters(parsed);
        setParameters(migrated);
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

  const updateParameter = useCallback((key: keyof ScoringParameters['weights'], value: number) => {
    const updated = produce(parameters, draft => {
        draft.weights[key as keyof typeof draft.weights] = value;
    });
    saveParameters(updated);
  }, [parameters, saveParameters]);

  const setGenderImpactEnabled = useCallback((enabled: boolean) => {
      const updated = produce(parameters, draft => {
          draft.genderImpact.enabled = enabled;
      });
      saveParameters(updated);
  }, [parameters, saveParameters]);

  const setGenderImpact = useCallback((gender: 'male' | 'female', value: GenderImpact) => {
    const updated = produce(parameters, draft => {
        draft.genderImpact[gender] = value;
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

  return { parameters, updateParameter, setGenderImpact, setGenderImpactEnabled, setOccupationRisk, addOccupation, removeOccupation, resetParameters };
}
