

'use client';

import { useState, useEffect, useCallback } from 'react';
import type { TransactionProduct } from '@/lib/types';

const MOCK_TRANSACTION_PRODUCTS: TransactionProduct[] = [
    { id: 'tp-1', name: 'Top-up' },
    { id: 'tp-2', name: 'Other Bank Transfer' },
    { id: 'tp-3', name: 'Bill Payment' },
];

const STORAGE_KEY = 'transactionProducts';

export function useTransactionProducts() {
    const [transactionProducts, setTransactionProducts] = useState<TransactionProduct[]>([]);

    useEffect(() => {
        try {
            const item = window.localStorage.getItem(STORAGE_KEY);
            if (item) {
                // Migration: remove weight property if it exists
                const parsed = JSON.parse(item).map((p: any) => {
                    delete p.weight;
                    return p;
                });
                setTransactionProducts(parsed);
            } else {
                setTransactionProducts(MOCK_TRANSACTION_PRODUCTS);
                window.localStorage.setItem(STORAGE_KEY, JSON.stringify(MOCK_TRANSACTION_PRODUCTS));
            }
        } catch (error) {
            console.warn(`Error reading localStorage key “${STORAGE_KEY}”:`, error);
            setTransactionProducts(MOCK_TRANSACTION_PRODUCTS);
        }
    }, []);

    const saveTransactionProducts = useCallback((updatedProducts: TransactionProduct[]) => {
        setTransactionProducts(updatedProducts);
        try {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedProducts));
        } catch (error) {
            console.warn(`Error setting localStorage key “${STORAGE_KEY}”:`, error);
        }
    }, []);

    const addTransactionProduct = useCallback((newProduct: Omit<TransactionProduct, 'id'>) => {
        const productWithId: TransactionProduct = {
            ...newProduct,
            id: `tp-${Date.now()}`,
        };
        saveTransactionProducts([...transactionProducts, productWithId]);
    }, [transactionProducts, saveTransactionProducts]);

    const updateTransactionProduct = useCallback((updatedProduct: TransactionProduct) => {
        const updatedProducts = transactionProducts.map(p => (p.id === updatedProduct.id ? updatedProduct : p));
        saveTransactionProducts(updatedProducts);
    }, [transactionProducts, saveTransactionProducts]);

    const removeTransactionProduct = useCallback((productId: string) => {
        const updatedProducts = transactionProducts.filter(p => p.id !== productId);
        saveTransactionProducts(updatedProducts);
    }, [transactionProducts, saveTransactionProducts]);

    return { transactionProducts, addTransactionProduct, updateTransactionProduct, removeTransactionProduct };
}
