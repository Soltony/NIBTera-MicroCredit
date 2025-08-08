
'use client';

import { useState, useEffect, useCallback } from 'react';
import type { LoanProvider, LoanProduct } from '@/lib/types';
import { Building2, Landmark, Briefcase, Home, PersonStanding, LucideIcon } from 'lucide-react';

const ICONS: Record<string, LucideIcon> = {
    Building2,
    Landmark,
    Briefcase,
    Home,
    PersonStanding,
};

// Function to serialize the icon component to its name
const getIconName = (iconComponent: LucideIcon): string | undefined => {
    for (const name in ICONS) {
        if (ICONS[name] === iconComponent) {
            return name;
        }
    }
    return undefined;
};


const MOCK_PROVIDERS_DATA: Omit<LoanProvider, 'icon' | 'products'> & { icon: string; products: (Omit<LoanProduct, 'icon'> & {icon: string})[] }[] = [
    {
    id: 'provider-3',
    name: 'NIb Bank',
    icon: 'Building2',
    color: 'text-yellow-500',
    colorHex: '#fdb913',
    products: [
      { id: 'prod-3a', name: 'Quick Cash Loan', description: 'Instant cash for emergencies.', icon: 'PersonStanding', minLoan: 500, maxLoan: 2500, serviceFee: '3%', dailyFee: '0.2%', penaltyFee: '0.11% daily', availableLimit: 0 },
      { id: 'prod-3b', name: 'Gadget Financing', description: 'Upgrade your devices with easy financing.', icon: 'Home', minLoan: 300, maxLoan: 1500, serviceFee: '3%', dailyFee: '0.2%', penaltyFee: '0.11% daily', availableLimit: 0 },
    ],
  },
  {
    id: 'provider-1',
    name: 'Capital Bank',
    icon: 'Building2',
    color: 'text-blue-600',
    colorHex: '#2563eb',
    products: [
      { id: 'prod-1a', name: 'Personal Loan', description: 'Flexible personal loans for your needs.', icon: 'PersonStanding', minLoan: 400, maxLoan: 2000, serviceFee: '3%', dailyFee: '0.2%', penaltyFee: '0.11% daily', availableLimit: 0 },
      { id: 'prod-1b', name: 'Home Improvement Loan', description: 'Finance your home renovation projects.', icon: 'Home', minLoan: 10000, maxLoan: 50000, serviceFee: '3%', dailyFee: '0.2%', penaltyFee: '0.11% daily', availableLimit: 0 },
    ],
  },
  {
    id: 'provider-2',
    name: 'Providus Financial',
    icon: 'Landmark',
    color: 'text-green-600',
    colorHex: '#16a34a',
    products: [
      { id: 'prod-2a', name: 'Startup Business Loan', description: 'Kickstart your new business venture.', icon: 'Briefcase', minLoan: 5000, maxLoan: 100000, serviceFee: '3%', dailyFee: '0.2%', penaltyFee: '0.11% daily', availableLimit: 0 },
      { id: 'prod-2b', name: 'Personal Auto Loan', description: 'Get behind the wheel of your new car.', icon: 'PersonStanding', minLoan: 2000, maxLoan: 30000, serviceFee: '3%', dailyFee: '0.2%', penaltyFee: '0.11% daily', availableLimit: 0 },
    ],
  },
];

const STORAGE_KEY = 'loanProviders';

// Helper to deserialize data from localStorage
const deserializeProviders = (data: any[]): LoanProvider[] => {
    return data.map(provider => ({
        ...provider,
        icon: ICONS[provider.icon as string] || Building2,
        products: provider.products.map((product: any) => ({
            ...product,
            icon: ICONS[product.icon as string] || PersonStanding,
        }))
    }));
};

// Helper to serialize data for localStorage
const serializeProviders = (providers: LoanProvider[]): any[] => {
    return providers.map(provider => ({
        ...provider,
        icon: getIconName(provider.icon),
        products: provider.products.map(product => ({
            ...product,
            icon: getIconName(product.icon)
        }))
    }));
}


export function useLoanProviders() {
  const [providers, setProviders] = useState<LoanProvider[]>([]);

  useEffect(() => {
    try {
      const item = window.localStorage.getItem(STORAGE_KEY);
      if (item) {
        const parsedProviders = JSON.parse(item);
        setProviders(deserializeProviders(parsedProviders));
      } else {
        // Initialize with mock data if no history exists
        const initialProviders = deserializeProviders(MOCK_PROVIDERS_DATA);
        setProviders(initialProviders);
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(MOCK_PROVIDERS_DATA));
      }
    } catch (error) {
      console.warn(`Error reading localStorage key “${STORAGE_KEY}”:`, error);
      setProviders(deserializeProviders(MOCK_PROVIDERS_DATA));
    }
  }, []);

  const saveProviders = useCallback((updatedProviders: LoanProvider[]) => {
      setProviders(updatedProviders);
      try {
          const serializableProviders = serializeProviders(updatedProviders);
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(serializableProviders));
      } catch (error) {
          console.warn(`Error setting localStorage key “${STORAGE_KEY}”:`, error);
      }
  }, []);

  const addProvider = useCallback((newProvider: Omit<LoanProvider, 'id' | 'products'>) => {
    const providerWithId: LoanProvider = {
        ...newProvider,
        id: `provider-${Date.now()}`,
        products: [],
    };
    saveProviders([...providers, providerWithId]);
  }, [providers, saveProviders]);

  const addProduct = useCallback((providerId: string, newProduct: Omit<LoanProduct, 'id' | 'availableLimit'>) => {
      const productWithId: LoanProduct = {
          ...newProduct,
          id: `prod-${Date.now()}`,
          availableLimit: 0,
      };

      const updatedProviders = providers.map(p => {
          if (p.id === providerId) {
              return {
                  ...p,
                  products: [...p.products, productWithId]
              };
          }
          return p;
      });
      saveProviders(updatedProviders);
  }, [providers, saveProviders]);

  const updateProduct = useCallback((providerId: string, updatedProduct: LoanProduct) => {
    const updatedProviders = providers.map(p => {
        if (p.id === providerId) {
            return {
                ...p,
                products: p.products.map(prod => prod.id === updatedProduct.id ? updatedProduct : prod)
            };
        }
        return p;
    });
    saveProviders(updatedProviders);
  }, [providers, saveProviders]);

  const deleteProduct = useCallback((providerId: string, productId: string) => {
    const updatedProviders = providers.map(p => {
        if (p.id === providerId) {
            return {
                ...p,
                products: p.products.filter(prod => prod.id !== productId)
            };
        }
        return p;
    });
    saveProviders(updatedProviders);
  }, [providers, saveProviders]);

  return { providers, addProvider, addProduct, updateProduct, deleteProduct };
}
