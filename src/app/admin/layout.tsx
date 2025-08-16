
import { AuthProvider } from '@/hooks/use-auth';
import { getUserFromSession as getCurrentUser } from '@/lib/user';
import { ProtectedLayout } from '@/components/admin/protected-layout';
import { AppDataSource } from '@/data-source';
import { LoanProvider } from '@/entities/LoanProvider';
import type { LoanProvider as LoanProviderType, FeeRule, PenaltyRule } from '@/lib/types';
import type { DataSource } from 'typeorm';

export const dynamic = 'force-dynamic';

// Helper function to safely parse JSON from DB
const safeJsonParse = (jsonString: string | null | undefined, defaultValue: any) => {
    if (!jsonString) return defaultValue;
    try {
        return JSON.parse(jsonString);
    } catch (e) {
        return defaultValue;
    }
};

async function getConnectedDataSource(): Promise<DataSource> {
    if (AppDataSource.isInitialized) {
        return AppDataSource;
    } else {
        return await AppDataSource.initialize();
    }
}

async function getProviders() {
    let dataSource: DataSource | null = null;
    try {
        dataSource = await getConnectedDataSource();
        const providerRepo = dataSource.getRepository(LoanProvider);
        const providers = await providerRepo.find({
            relations: ['products'],
            order: {
                displayOrder: 'ASC'
            }
        });
        // Convert to plain objects
        return providers.map(p => ({
            id: String(p.id),
            name: p.name,
            icon: p.icon,
            colorHex: p.colorHex,
            displayOrder: p.displayOrder,
            products: p.products.map(prod => ({
                id: String(prod.id),
                name: prod.name,
                description: prod.description,
                icon: prod.icon,
                minLoan: prod.minLoan,
                maxLoan: prod.maxLoan,
                serviceFee: safeJsonParse(prod.serviceFee, { type: 'percentage', value: 0 }) as FeeRule,
                dailyFee: safeJsonParse(prod.dailyFee, { type: 'percentage', value: 0 }) as FeeRule,
                penaltyRules: safeJsonParse(prod.penaltyRules, []) as PenaltyRule[],
                status: prod.status as 'Active' | 'Disabled'
            }))
        }));
    } finally {
        // Do not destroy the connection here in a server component layout
    }
}

export default async function AdminLayout({children}: {children: React.ReactNode}) {
  const user = await getCurrentUser();
  const providers = await getProviders();

  return (
    <AuthProvider initialUser={user}>
      <ProtectedLayout providers={providers as LoanProviderType[]}>
        {children}
      </ProtectedLayout>
    </AuthProvider>
  );
}
