
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
                window.localStorage.setItem(STORAGE_KEY, JSON.stringify(initialData));
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

    const addParameter = useCallback((providerId: string) => {
        const newParam: ScoringParameter = {
            id: `param-${Date.now()}`,
            name: 'New Parameter',
            weight: 10,
            rules: [{ id: `rule-${Date.now()}`, field: 'newField', condition: '>', value: '0', score: 10 }],
        };
        const currentParams = getParametersForProvider(providerId);
        saveParametersForProvider(providerId, [...currentParams, newParam]);
    }, [getParametersForProvider, saveParametersForProvider]);

    const updateParameter = useCallback((providerId: string, paramId: string, updatedParam: ScoringParameter) => {
         const currentParams = getParametersForProvider(providerId);
        const updated = produce(currentParams, draft => {
            const index = draft.findIndex(p => p.id === paramId);
            if (index !== -1) {
                draft[index] = updatedParam;
            }
        });
        saveParametersForProvider(providerId, updated);
    }, [getParametersForProvider, saveParametersForProvider]);

    const removeParameter = useCallback((providerId: string, paramId: string) => {
         const currentParams = getParametersForProvider(providerId);
        saveParametersForProvider(providerId, currentParams.filter(p => p.id !== paramId));
    }, [getParametersForProvider, saveParametersForProvider]);
    
    const addRule = useCallback((providerId: string, paramId: string) => {
        const newRule: Rule = {
            id: `rule-${Date.now()}`,
            field: '',
            condition: '',
            value: '',
            score: 0,
        };
        const currentParams = getParametersForProvider(providerId);
        const updated = produce(currentParams, draft => {
            const param = draft.find(p => p.id === paramId);
            if (param) {
                param.rules.push(newRule);
            }
        });
        saveParametersForProvider(providerId, updated);
    }, [getParametersForProvider, saveParametersForProvider]);

    const updateRule = useCallback((providerId: string, paramId: string, ruleId: string, updatedRule: Rule) => {
        const currentParams = getParametersForProvider(providerId);
        const updated = produce(currentParams, draft => {
            const param = draft.find(p => p.id === paramId);
            if (param) {
                const ruleIndex = param.rules.findIndex(r => r.id === ruleId);
                if (ruleIndex !== -1) {
                    param.rules[ruleIndex] = updatedRule;
                }
            }
        });
        saveParametersForProvider(providerId, updated);
    }, [getParametersForProvider, saveParametersForProvider]);

    const removeRule = useCallback((providerId: string, paramId: string, ruleId: string) => {
        const currentParams = getParametersForProvider(providerId);
        const updated = produce(currentParams, draft => {
            const param = draft.find(p => p.id === paramId);
            if (param) {
                param.rules = param.rules.filter(r => r.id !== ruleId);
            }
        });
        saveParametersForProvider(providerId, updated);
    }, [getParametersForProvider, saveParametersForProvider]);


    return { getParametersForProvider, addParameter, updateParameter, removeParameter, addRule, updateRule, removeRule, saveParametersForProvider };
}
