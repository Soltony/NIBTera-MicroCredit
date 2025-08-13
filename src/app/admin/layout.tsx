
import { AuthProvider } from '@/hooks/use-auth';
import { getUserFromSession as getCurrentUser } from '@/lib/user';
import { ProtectedLayout } from '@/components/admin/protected-layout';
import { AppDataSource } from '@/data-source';
import { LoanProvider } from '@/entities/LoanProvider';

async function getProviders() {
    if (!AppDataSource.isInitialized) await AppDataSource.initialize();
    const providerRepo = AppDataSource.getRepository(LoanProvider);
    const providers = await providerRepo.find({
        relations: ['products'],
        order: {
            displayOrder: 'ASC'
        }
    });
    return providers.map(p => ({
        ...p,
        id: String(p.id)
    }));
}

export default async function AdminLayout({children}: {children: React.ReactNode}) {
  const user = await getCurrentUser();
  const providers = await getProviders();

  return (
    <AuthProvider initialUser={user}>
      <ProtectedLayout providers={providers as any}>
        {children}
      </ProtectedLayout>
    </AuthProvider>
  );
}
