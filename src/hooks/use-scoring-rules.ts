
'use client';

import { useState, useEffect, useCallback } from 'react';
import { produce } from 'immer';

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

const MOCK_SCORING_PARAMETERS: ScoringParameter[] = [
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
];

const STORAGE_KEY = 'creditScoringRules';

export function useScoringRules() {
    const [parameters, setParameters] = useState<ScoringParameter[]>([]);

    useEffect(() => {
        try {
            const item = window.localStorage.getItem(STORAGE_KEY);
            if (item) {
                setParameters(JSON.parse(item));
            } else {
                setParameters(MOCK_SCORING_PARAMETERS);
                window.localStorage.setItem(STORAGE_KEY, JSON.stringify(MOCK_SCORING_PARAMETERS));
            }
        } catch (error) {
            console.warn(`Error reading localStorage key “${STORAGE_KEY}”:`, error);
            setParameters(MOCK_SCORING_PARAMETERS);
        }
    }, []);

    const saveParameters = useCallback((updatedParameters: ScoringParameter[]) => {
        setParameters(updatedParameters);
        try {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedParameters));
        } catch (error) {
            console.warn(`Error setting localStorage key “${STORAGE_KEY}”:`, error);
        }
    }, []);

    const addParameter = useCallback(() => {
        const newParam: ScoringParameter = {
            id: `param-${Date.now()}`,
            name: 'New Parameter',
            weight: 10,
            rules: [],
        };
        saveParameters([...parameters, newParam]);
    }, [parameters, saveParameters]);

    const updateParameter = useCallback((paramId: string, updatedParam: ScoringParameter) => {
        const updated = produce(parameters, draft => {
            const index = draft.findIndex(p => p.id === paramId);
            if (index !== -1) {
                draft[index] = updatedParam;
            }
        });
        saveParameters(updated);
    }, [parameters, saveParameters]);

    const removeParameter = useCallback((paramId: string) => {
        saveParameters(parameters.filter(p => p.id !== paramId));
    }, [parameters, saveParameters]);
    
    const addRule = useCallback((paramId: string) => {
        const newRule: Rule = {
            id: `rule-${Date.now()}`,
            field: '',
            condition: '',
            value: '',
            score: 0,
        };
        const updated = produce(parameters, draft => {
            const param = draft.find(p => p.id === paramId);
            if (param) {
                param.rules.push(newRule);
            }
        });
        saveParameters(updated);
    }, [parameters, saveParameters]);

    const updateRule = useCallback((paramId: string, ruleId: string, updatedRule: Rule) => {
        const updated = produce(parameters, draft => {
            const param = draft.find(p => p.id === paramId);
            if (param) {
                const ruleIndex = param.rules.findIndex(r => r.id === ruleId);
                if (ruleIndex !== -1) {
                    param.rules[ruleIndex] = updatedRule;
                }
            }
        });
        saveParameters(updated);
    }, [parameters, saveParameters]);

    const removeRule = useCallback((paramId: string, ruleId: string) => {
        const updated = produce(parameters, draft => {
            const param = draft.find(p => p.id === paramId);
            if (param) {
                param.rules = param.rules.filter(r => r.id !== ruleId);
            }
        });
        saveParameters(updated);
    }, [parameters, saveParameters]);


    return { parameters, addParameter, updateParameter, removeParameter, addRule, updateRule, removeRule, saveParameters };
}
