
import { AuthProvider } from '@/hooks/use-auth';
import { getUserFromSession as getCurrentUser } from '@/lib/user';
import { ProtectedLayout } from '@/components/admin/protected-layout';
import { AppDataSource } from '@/data-source';
import { LoanProvider } from '@/entities/LoanProvider';
import type { LoanProvider as LoanProviderType } from '@/lib/types';
import type { DataSource } from 'typeorm';

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
            ...p,
            id: String(p.id),
            products: p.products.map(prod => ({...prod, id: String(prod.id)}))
        }));
    } finally {
        if (dataSource && AppDataSource.options.type !== 'oracle') {
           // await dataSource.destroy();
        }
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
