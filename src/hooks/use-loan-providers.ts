
'use client';

import React, { useState, useEffect, useCallback, createContext, useContext, useMemo } from 'react';
import { produce } from 'immer';
import type { LoanProvider as LoanProviderType, LoanProduct as LoanProductType } from '@/lib/types';
import { Building2, Landmark, Briefcase, Home, PersonStanding, type LucideIcon } from 'lucide-react';
import { useToast } from './use-toast';

const iconMap: { [key: string]: LucideIcon } = {
  Building2,
  Landmark,
  Briefcase,
  Home,
  PersonStanding
};

const mapIcons = (providers: any[]): LoanProviderType[] => {
    return providers.map(p => ({
        ...p,
        icon: iconMap[p.icon] || Building2,
        products: p.products.map((prod: any) => ({
            ...prod,
            icon: iconMap[prod.icon] || PersonStanding,
        }))
    }));
}


interface LoanProviderContextType {
    providers: LoanProviderType[];
    addProvider: (newProvider: Omit<LoanProviderType, 'id' | 'products'>) => void;
    addProduct: (providerId: string, newProduct: Omit<LoanProductType, 'id'| 'status' | 'availableLimit'>) => void;
    updateProduct: (providerId: string, updatedProduct: LoanProductType) => void;
    isLoading: boolean;
}

const LoanProviderContext = createContext<LoanProviderContextType>({
    providers: [],
    addProvider: () => {},
    addProduct: () => {},
    updateProduct: () => {},
    isLoading: true,
});

export const useLoanProviders = () => useContext(LoanProviderContext);

export const LoanProvider = ({ children }: { children: React.ReactNode }) => {
    const [providers, setProviders] = useState<LoanProviderType[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { toast } = useToast();

    const fetchProviders = useCallback(async () => {
        setIsLoading(true);
        try {
            const response = await fetch('/api/providers');
            if (!response.ok) throw new Error('Failed to fetch');
            const data = await response.json();
            setProviders(mapIcons(data));
        } catch (error) {
            toast({
                title: 'Error Loading Data',
                description: 'Could not load provider information.',
                variant: 'destructive',
            });
        } finally {
            setIsLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        fetchProviders();
    }, [fetchProviders]);

    const addProvider = useCallback((newProvider: Omit<LoanProviderType, 'id' | 'products'>) => {
        const providerWithId = {
            ...newProvider,
            id: `provider-${Date.now()}`,
            products: [],
            icon: iconMap[newProvider.icon as any] || Building2,
        };
        setProviders(prev => [...prev, providerWithId]);
        // Note: This is a client-side addition. To persist, you'd need an API call.
    }, []);

    const addProduct = useCallback((providerId: string, newProductData: Omit<LoanProductType, 'id' | 'availableLimit' | 'status'>) => {
        const newProduct: LoanProductType = {
            ...newProductData,
            id: `product-${Date.now()}`,
            status: 'Active',
            icon: iconMap[newProductData.icon as any] || PersonStanding
        }

        const updatedProviders = produce(providers, draft => {
            const provider = draft.find(p => p.id === providerId);
            if (provider) {
                provider.products.push(newProduct);
            }
        });
        setProviders(updatedProviders);
    }, [providers]);

    const updateProduct = useCallback((providerId: string, updatedProduct: LoanProductType) => {
       const updatedProviders = produce(providers, draft => {
           const provider = draft.find(p => p.id === providerId);
           if (provider) {
               const productIndex = provider.products.findIndex(p => p.id === updatedProduct.id);
               if (productIndex !== -1) {
                   provider.products[productIndex] = {
                       ...updatedProduct,
                       icon: iconMap[updatedProduct.icon as any] || PersonStanding
                   };
               }
           }
       });
       setProviders(updatedProviders);
    }, [providers]);

    const value = useMemo(() => ({
        providers,
        addProvider,
        addProduct,
        updateProduct,
        isLoading,
    }), [providers, addProvider, addProduct, updateProduct, isLoading]);

    return <LoanProviderContext.Provider value={value}>{children}</LoanProviderContext.Provider>;
}
