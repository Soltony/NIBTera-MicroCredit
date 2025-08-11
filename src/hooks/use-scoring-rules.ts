
'use client';

import { useState, useEffect, useCallback } from 'react';
import { produce } from 'immer';
import { useLoanProviders } from './use-loan-providers';

export interface Rule {
    id: string;
    field: string;
    condition: string;
    value: string;
    score: number;
}

export interface ScoringParameter {
    id: string;
    name: string;
    weight: number;
    rules: Rule[];
}

const DEFAULT_SCORING_PARAMETERS: ScoringParameter[] = [
    {
        id: 'param-1',
        name: 'Age',
        weight: 20,
        rules: [
            { id: 'rule-1a', field: 'age', condition: '>=', value: '35', score: 20 },
            { id: 'rule-1b', field: 'age', condition: '<', value: '25', score: 5 },
        ]
    },
    {
        id: 'param-2',
        name: 'Loan History',
        weight: 30,
        rules: [
            { id: 'rule-2a', field: 'onTimeRepayments', condition: '>', value: '5', score: 30 },
            { id: 'rule-2b', field: 'loanHistoryCount', condition: '<', value: '1', score: 10 },
        ]
    },
    {
        id: 'param-3',
        name: 'Income Level',
        weight: 50,
        rules: [
            { id: 'rule-3a', field: 'monthlyIncome', condition: '>', value: '5000', score: 40 },
             { id: 'rule-3b', field: 'monthlyIncome', condition: '<=', value: '2000', score: 15 },
        ]
    },
];

const STORAGE_KEY = 'creditScoringRulesByProvider';

type AllScoringRules = Record<string, ScoringParameter[]>;

export function useScoringRules() {
    const [allParameters, setAllParameters] = useState<AllScoringRules>({});
    const [parameters, setParameters] = useState<ScoringParameter[] | null>(null);
    const { providers } = useLoanProviders();

    useEffect(() => {
        try {
            const item = window.localStorage.getItem(STORAGE_KEY);
            if (item) {
                setAllParameters(JSON.parse(item));
            } else {
                // Initialize for all existing providers if nothing is in storage
                const initialData = providers.reduce((acc, provider) => {
                    acc[provider.id] = JSON.parse(JSON.stringify(DEFAULT_SCORING_PARAMETERS));
                    return acc;
                }, {} as AllScoringRules);
                setAllParameters(initialData);
                if (Object.keys(initialData).length > 0) {
                    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(initialData));
                }
            }
        } catch (error) {
            console.warn(`Error reading localStorage key “${STORAGE_KEY}”:`, error);
             setAllParameters({});
        }
    }, [providers]);

    const getParametersForProvider = useCallback((providerId: string): ScoringParameter[] => {
        return allParameters[providerId] || JSON.parse(JSON.stringify(DEFAULT_SCORING_PARAMETERS));
    }, [allParameters]);

    const saveParametersForProvider = useCallback((providerId: string, updatedParameters: ScoringParameter[]) => {
        const updatedAllParameters = produce(allParameters, draft => {
            draft[providerId] = updatedParameters;
        });
        setAllParameters(updatedAllParameters);
        try {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedAllParameters));
        } catch (error) {
            console.warn(`Error setting localStorage key “${STORAGE_KEY}”:`, error);
        }
    }, [allParameters]);

    return { 
        parameters, 
        setParameters,
        getParametersForProvider, 
        saveParametersForProvider,
    };
}
