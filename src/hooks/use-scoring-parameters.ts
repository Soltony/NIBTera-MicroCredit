

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
    transactionHistoryByProduct: { enabled: boolean; values: Record<string, number> };
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
    transactionHistoryByProduct: { enabled: true, values: { 'tp-1': 5, 'tp-2': 5, 'tp-3': 5 } },
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

export function useScoringParameters() {
  const [parameters, setParameters] = useState<AllScoringParameters>({});

  useEffect(() => {
    try {
      const item = window.localStorage.getItem(STORAGE_KEY);
      if (item) {
        const parsedData = JSON.parse(item);
        // Migration logic can be added here if the data structure changes in the future
        const migratedData = produce(parsedData, draft => {
             for (const providerId in draft) {
                const providerParams = draft[providerId];
                if (providerParams.weights && providerParams.weights.transactionHistoryByProduct && typeof providerParams.weights.transactionHistoryByProduct.values === 'undefined') {
                    providerParams.weights.transactionHistoryByProduct.values = deepClone(DEFAULT_PARAMETERS.weights.transactionHistoryByProduct.values);
                }
             }
        });
        setParameters(migratedData);
      } else {
        setParameters({});
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
    const providerParams = parameters[providerId];
    // Use a deep clone of default parameters to prevent mutation issues.
    const defaults = deepClone(DEFAULT_PARAMETERS);
    
    if (providerParams) {
        // Merge defaults with existing params to ensure all keys are present.
        return produce(defaults, draft => {
            if (providerParams.productIds) draft.productIds = providerParams.productIds;
            Object.assign(draft.weights, providerParams.weights);
            Object.assign(draft.genderImpact, providerParams.genderImpact);
            Object.assign(draft.occupationRisk, providerParams.occupationRisk);
        });
    }
    return defaults;
  }, [parameters]);
  
  const updateParameter = useCallback((providerId: string, key: keyof Omit<ScoringParameters['weights'], 'transactionHistoryByProduct'>, value: number) => {
    const updated = produce(parameters, draft => {
        if (!draft[providerId]) draft[providerId] = deepClone(DEFAULT_PARAMETERS);
        (draft[providerId].weights[key] as { value: number }).value = value;
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
  
  const setTransactionProductWeight = useCallback((providerId: string, productId: string, weight: number) => {
    const updated = produce(parameters, draft => {
        if (!draft[providerId]) draft[providerId] = deepClone(DEFAULT_PARAMETERS);
        if (!draft[providerId].weights.transactionHistoryByProduct.values) {
            draft[providerId].weights.transactionHistoryByProduct.values = {};
        }
        draft[providerId].weights.transactionHistoryByProduct.values[productId] = weight;
    });
    saveParameters(updated);
  }, [parameters, saveParameters]);

  return { parameters, getParametersForProvider, updateParameter, setGenderImpact, setGenderImpactEnabled, setOccupationRisk, addOccupation, removeOccupation, resetParameters, toggleParameterEnabled, setAppliedProducts, setTransactionProductWeight };
}

    