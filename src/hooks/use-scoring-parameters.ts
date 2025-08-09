

'use client';

import { useState, useEffect, useCallback } from 'react';
import { produce } from 'immer';
import { deepClone } from 'fast-json-patch';

export type GenderImpact = number;

export interface ScoringParameters {
  productIds: string[];
  weights: {
    age: { enabled: boolean; value: number };
    transactionHistoryTotal: { enabled: boolean; value: number };
    transactionHistoryByProduct: { 
        enabled: boolean; 
        values: Record<string, number> 
    };
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
  productIds: [],
  weights: {
    age: { enabled: true, value: 10 },
    transactionHistoryTotal: { enabled: true, value: 20 },
    transactionHistoryByProduct: { 
        enabled: true,
        values: {
            'Top-up': 10,
            'Other Bank Transfer': 5,
        }
    },
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

const STORAGE_KEY = 'scoringParametersByProvider';

type AllScoringParameters = Record<string, ScoringParameters>;


const migrateParameters = (data: any): ScoringParameters => {
    const newDefault = deepClone(DEFAULT_PARAMETERS);
    return produce(newDefault, draft => {
        if (typeof data !== 'object' || data === null) return;

        // This function now migrates a SINGLE parameter object
        if (data.weights) {
            for (const key in draft.weights) {
                const typedKey = key as keyof typeof draft.weights;
                if (data.weights[key] !== undefined) {
                    if (typedKey === 'transactionHistoryByProduct') {
                        if (typeof data.weights.transactionHistoryByProduct === 'object' && data.weights.transactionHistoryByProduct !== null) {
                            draft.weights.transactionHistoryByProduct.enabled = data.weights.transactionHistoryByProduct.enabled ?? true;
                            if (typeof data.weights.transactionHistoryByProduct.values === 'object') {
                                draft.weights.transactionHistoryByProduct.values = data.weights.transactionHistoryByProduct.values;
                            }
                        }
                    } else if (typeof data.weights[key] === 'number') {
                        (draft.weights[typedKey] as any) = { enabled: true, value: data.weights[key] };
                    } else if (typeof data.weights[key] === 'object' && 'value' in data.weights[key]) {
                        Object.assign(draft.weights[typedKey], data.weights[key]);
                    }
                }
            }
        }
        if (data.genderImpact) {
             if (typeof data.genderImpact.enabled === 'boolean') draft.genderImpact.enabled = data.genderImpact.enabled;
             if (typeof data.genderImpact.male === 'number') draft.genderImpact.male = data.genderImpact.male;
             if (typeof data.genderImpact.female === 'number') draft.genderImpact.female = data.genderImpact.female;
        }
        if (data.occupationRisk) {
             if (typeof data.occupationRisk.enabled === 'boolean') draft.occupationRisk.enabled = data.occupationRisk.enabled;
             if (typeof data.occupationRisk.values === 'object') draft.occupationRisk.values = data.occupationRisk.values;
             else if (typeof data.occupationRisk === 'object' && typeof data.occupationRisk.enabled === 'undefined') {
                draft.occupationRisk.values = data.occupationRisk;
            }
        }
    });
}


export function useScoringParameters() {
  const [parameters, setParameters] = useState<AllScoringParameters>({});

  useEffect(() => {
    try {
      const item = window.localStorage.getItem(STORAGE_KEY);
      if (item) {
        const parsedData = JSON.parse(item);
        // Simple migration check: if a provider's data is missing productIds, add it.
        const migratedData = produce(parsedData, draft => {
            for (const providerId in draft) {
                if (!draft[providerId].productIds) {
                    draft[providerId].productIds = [];
                }
            }
        });
        setParameters(migratedData);
      } else {
         // Migration from old single-object storage
        const oldItem = window.localStorage.getItem('scoringParameters');
        if (oldItem) {
            const parsedOld = JSON.parse(oldItem);
            const migrated = migrateParameters(parsedOld);
            // Assume migration applies to a default provider, or handle more gracefully
            const initialData = { 'provider-3': migrated }; // Defaulting to NIb Bank
            setParameters(initialData);
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(initialData));
            window.localStorage.removeItem('scoringParameters'); // Clean up old key
        } else {
            setParameters({});
        }
      }
    } catch (error) {
      console.warn(`Error reading localStorage key “${STORAGE_KEY}”:`, error);
      setParameters({});
    }
  }, []);

  const saveParameters = useCallback((updatedParameters: AllScoringParameters) => {
    setParameters(updatedParameters);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedParameters));
    } catch (error) {
      console.warn(`Error setting localStorage key “${STORAGE_KEY}”:`, error);
    }
  }, []);

  const getParametersForProvider = useCallback((providerId: string): ScoringParameters => {
      return parameters[providerId] || deepClone(DEFAULT_PARAMETERS);
  }, [parameters]);
  
  const updateParameter = useCallback((providerId: string, key: keyof Omit<ScoringParameters['weights'], 'transactionHistoryByProduct'>, value: number) => {
    const updated = produce(parameters, draft => {
        if (!draft[providerId]) draft[providerId] = deepClone(DEFAULT_PARAMETERS);
        (draft[providerId].weights[key] as { value: number }).value = value;
    });
    saveParameters(updated);
  }, [parameters, saveParameters]);

  const updateProductWeight = useCallback((providerId: string, productName: string, value: number) => {
    const updated = produce(parameters, draft => {
        if (!draft[providerId]) draft[providerId] = deepClone(DEFAULT_PARAMETERS);
        draft[providerId].weights.transactionHistoryByProduct.values[productName] = value;
    });
    saveParameters(updated);
  }, [parameters, saveParameters]);

  const addProduct = useCallback((providerId: string, productName: string) => {
    const updated = produce(parameters, draft => {
        if (!draft[providerId]) draft[providerId] = deepClone(DEFAULT_PARAMETERS);
        if (!draft[providerId].weights.transactionHistoryByProduct.values[productName]) {
            draft[providerId].weights.transactionHistoryByProduct.values[productName] = 0;
        }
    });
    saveParameters(updated);
  }, [parameters, saveParameters]);

  const removeProduct = useCallback((providerId: string, productName: string) => {
    const updated = produce(parameters, draft => {
        if (draft[providerId]) {
            delete draft[providerId].weights.transactionHistoryByProduct.values[productName];
        }
    });
    saveParameters(updated);
  }, [parameters, saveParameters]);

  const toggleParameterEnabled = useCallback((providerId: string, type: 'weights' | 'occupationRisk', key: keyof ScoringParameters['weights'] | 'values') => {
      const updated = produce(parameters, draft => {
          if (!draft[providerId]) draft[providerId] = deepClone(DEFAULT_PARAMETERS);
          if (type === 'weights') {
              const weightKey = key as keyof ScoringParameters['weights'];
              (draft[providerId].weights[weightKey] as { enabled: boolean }).enabled = !(draft[providerId].weights[weightKey] as { enabled: boolean }).enabled;
          } else if (type === 'occupationRisk') {
              draft[providerId].occupationRisk.enabled = !draft[providerId].occupationRisk.enabled;
          }
      });
      saveParameters(updated);
  }, [parameters, saveParameters]);


  const setGenderImpactEnabled = useCallback((providerId: string, enabled: boolean) => {
      const updated = produce(parameters, draft => {
          if (!draft[providerId]) draft[providerId] = deepClone(DEFAULT_PARAMETERS);
          draft[providerId].genderImpact.enabled = enabled;
      });
      saveParameters(updated);
  }, [parameters, saveParameters]);

  const setGenderImpact = useCallback((providerId: string, gender: 'male' | 'female', value: GenderImpact) => {
    const updated = produce(parameters, draft => {
        if (!draft[providerId]) draft[providerId] = deepClone(DEFAULT_PARAMETERS);
        draft[providerId].genderImpact[gender] = value;
    });
    saveParameters(updated);
  }, [parameters, saveParameters]);


  const setOccupationRisk = useCallback((providerId: string, occupation: string, risk: 'Low' | 'Medium' | 'High') => {
      const updated = produce(parameters, draft => {
          if (!draft[providerId]) draft[providerId] = deepClone(DEFAULT_PARAMETERS);
          draft[providerId].occupationRisk.values[occupation] = risk;
      });
      saveParameters(updated);
  }, [parameters, saveParameters]);

  const addOccupation = useCallback((providerId: string, occupation: string) => {
    const updated = produce(parameters, draft => {
      if (!draft[providerId]) draft[providerId] = deepClone(DEFAULT_PARAMETERS);
      if (!draft[providerId].occupationRisk.values[occupation]) {
        draft[providerId].occupationRisk.values[occupation] = 'Medium';
      }
    });
    saveParameters(updated);
  }, [parameters, saveParameters]);
  
  const removeOccupation = useCallback((providerId: string, occupation: string) => {
    const updated = produce(parameters, draft => {
      if (draft[providerId]) {
        delete draft[providerId].occupationRisk.values[occupation];
      }
    });
    saveParameters(updated);
  }, [parameters, saveParameters]);

  const resetParameters = useCallback((providerId: string) => {
    const updated = produce(parameters, draft => {
        draft[providerId] = deepClone(DEFAULT_PARAMETERS);
    });
    saveParameters(updated);
  }, [parameters, saveParameters]);

  const setAppliedProducts = useCallback((providerId: string, productIds: string[]) => {
    const updated = produce(parameters, draft => {
      if (!draft[providerId]) draft[providerId] = deepClone(DEFAULT_PARAMETERS);
      draft[providerId].productIds = productIds;
    });
    saveParameters(updated);
  }, [parameters, saveParameters]);

  return { parameters, getParametersForProvider, updateParameter, setGenderImpact, setGenderImpactEnabled, setOccupationRisk, addOccupation, removeOccupation, resetParameters, toggleParameterEnabled, updateProductWeight, addProduct, removeProduct, setAppliedProducts };
}

    
