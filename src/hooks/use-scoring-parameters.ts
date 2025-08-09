
'use client';

import { useState, useEffect, useCallback } from 'react';
import { produce } from 'immer';

export type GenderImpact = number;

export interface ScoringParameters {
  weights: {
    age: { enabled: boolean; value: number };
    transactionHistoryTotal: { enabled: boolean; value: number };
    transactionHistoryByProduct: { enabled: boolean; value: number };
    loanHistoryCount: { enabled: boolean; value: number };
    onTimeRepayments: { enabled: boolean; value: number };
    salary: { enabled: boolean; value: number };
  };
  genderImpact: {
    enabled: boolean;
    male: GenderImpact;
    female: GenderImpact;
  };
  occupationRisk: {
    enabled: boolean;
    values: Record<string, 'Low' | 'Medium' | 'High'>;
  };
}

const DEFAULT_PARAMETERS: ScoringParameters = {
  weights: {
    age: { enabled: true, value: 10 },
    transactionHistoryTotal: { enabled: true, value: 20 },
    transactionHistoryByProduct: { enabled: true, value: 15 },
    loanHistoryCount: { enabled: true, value: 20 },
    onTimeRepayments: { enabled: true, value: 25 },
    salary: { enabled: true, value: 10 },
  },
  genderImpact: {
    enabled: false,
    male: 0,
    female: 0,
  },
  occupationRisk: {
    enabled: true,
    values: {
        'doctor': 'Low',
        'engineer': 'Low',
        'teacher': 'Low',
        'artist': 'Medium',
        'freelancer': 'Medium',
        'unemployed': 'High',
    },
  },
};

const STORAGE_KEY = 'scoringParameters';

const migrateParameters = (data: any): ScoringParameters => {
    let migratedData = produce(DEFAULT_PARAMETERS, draft => {
        if (typeof data !== 'object' || data === null) return;

        // Migrate weights
        if (data.weights) {
            for (const key in draft.weights) {
                const typedKey = key as keyof typeof draft.weights;
                if (data.weights[key] !== undefined) {
                    if (typeof data.weights[key] === 'number') {
                        // Old format: weights: { transactionHistoryTotal: 25 }
                        draft.weights[typedKey] = { enabled: true, value: data.weights[key] };
                    } else if (typeof data.weights[key] === 'object' && 'value' in data.weights[key]) {
                        // New format might be present, merge it
                        Object.assign(draft.weights[typedKey], data.weights[key]);
                    }
                }
            }
        }

        // Migrate genderImpact
        if (data.genderImpact) {
            if (typeof data.genderImpact.enabled === 'boolean') {
                 draft.genderImpact.enabled = data.genderImpact.enabled;
            }
             if (typeof data.genderImpact.male === 'number') {
                 draft.genderImpact.male = data.genderImpact.male;
            }
             if (typeof data.genderImpact.female === 'number') {
                 draft.genderImpact.female = data.genderImpact.female;
            }
        }
        
        // Migrate occupationRisk
        if (data.occupationRisk) {
             if (typeof data.occupationRisk.enabled === 'boolean') {
                draft.occupationRisk.enabled = data.occupationRisk.enabled;
            }
            if (typeof data.occupationRisk.values === 'object') {
                draft.occupationRisk.values = data.occupationRisk.values;
            } else if (typeof data.occupationRisk === 'object' && typeof data.occupationRisk.enabled === 'undefined') {
                // Oldest format: occupationRisk: { 'doctor': 'Low' }
                draft.occupationRisk.values = data.occupationRisk;
            }
        }
    });
    
    return migratedData;
}


export function useScoringParameters() {
  const [parameters, setParameters] = useState<ScoringParameters>(DEFAULT_PARAMETERS);

  useEffect(() => {
    try {
      const item = window.localStorage.getItem(STORAGE_KEY);
      if (item) {
        const parsed = JSON.parse(item);
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
        draft.weights[key as keyof typeof draft.weights].value = value;
    });
    saveParameters(updated);
  }, [parameters, saveParameters]);

  const toggleParameterEnabled = useCallback((type: 'weights' | 'occupationRisk', key: keyof ScoringParameters['weights'] | 'values') => {
      const updated = produce(parameters, draft => {
          if (type === 'weights') {
              const weightKey = key as keyof ScoringParameters['weights'];
              draft.weights[weightKey].enabled = !draft.weights[weightKey].enabled;
          } else if (type === 'occupationRisk') {
              draft.occupationRisk.enabled = !draft.occupationRisk.enabled;
          }
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
          draft.occupationRisk.values[occupation] = risk;
      });
      saveParameters(updated);
  }, [parameters, saveParameters]);

  const addOccupation = useCallback((occupation: string) => {
    const updated = produce(parameters, draft => {
      if (!draft.occupationRisk.values[occupation]) {
        draft.occupationRisk.values[occupation] = 'Medium';
      }
    });
    saveParameters(updated);
  }, [parameters, saveParameters]);
  
  const removeOccupation = useCallback((occupation: string) => {
    const updated = produce(parameters, draft => {
      delete draft.occupationRisk.values[occupation];
    });
    saveParameters(updated);
  }, [parameters, saveParameters]);

  const resetParameters = useCallback(() => {
    saveParameters(DEFAULT_PARAMETERS);
  }, [saveParameters]);

  return { parameters, updateParameter, setGenderImpact, setGenderImpactEnabled, setOccupationRisk, addOccupation, removeOccupation, resetParameters, toggleParameterEnabled };
}
