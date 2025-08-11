
'use client';

import { useState, useEffect, useCallback } from 'react';
import { produce } from 'immer';
import type { ScoringParameter } from './use-scoring-rules';

export interface ScoringHistoryItem {
    id: string;
    savedAt: Date;
    parameters: ScoringParameter[];
}

const STORAGE_KEY = 'scoringHistoryByProvider';

type AllScoringHistory = Record<string, ScoringHistoryItem[]>;

export function useScoringHistory() {
    const [history, setHistory] = useState<AllScoringHistory>({});

    useEffect(() => {
        try {
            const item = window.localStorage.getItem(STORAGE_KEY);
            if (item) {
                const parsedHistory = JSON.parse(item);
                 // Deserialize dates
                for (const providerId in parsedHistory) {
                    parsedHistory[providerId].forEach((entry: ScoringHistoryItem) => {
                        entry.savedAt = new Date(entry.savedAt);
                    });
                }
                setHistory(parsedHistory);
            }
        } catch (error) {
            console.warn(`Error reading localStorage key “${STORAGE_KEY}”:`, error);
            setHistory({});
        }
    }, []);

    const saveHistory = useCallback((updatedHistory: AllScoringHistory) => {
        setHistory(updatedHistory);
        try {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedHistory));
        } catch (error) {
            console.warn(`Error setting localStorage key “${STORAGE_KEY}”:`, error);
        }
    }, []);

    const getHistoryForProvider = useCallback((providerId: string): ScoringHistoryItem[] => {
        return history[providerId] || [];
    }, [history]);

    const addHistoryItem = useCallback((providerId: string, parameters: ScoringParameter[]) => {
        const newItem: ScoringHistoryItem = {
            id: `hist-${Date.now()}`,
            savedAt: new Date(),
            parameters: JSON.parse(JSON.stringify(parameters)), // Deep copy
        };
        const updatedHistory = produce(history, draft => {
            if (!draft[providerId]) {
                draft[providerId] = [];
            }
            // Add to the beginning of the array and keep the last 5 items
            draft[providerId].unshift(newItem);
            draft[providerId] = draft[providerId].slice(0, 5);
        });
        saveHistory(updatedHistory);
    }, [history, saveHistory]);

    return { getHistoryForProvider, addHistoryItem };
}
