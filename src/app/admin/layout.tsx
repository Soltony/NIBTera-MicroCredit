
import { AuthProvider } from '@/hooks/use-auth';
import { ProtectedLayout } from '@/components/admin/protected-layout';
import type { LoanProvider as LoanProviderType } from '@/lib/types';
import { getSession, getUserFromSession } from '@/lib/session';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

async function getProviders(): Promise<LoanProviderType[]> {
    const providers = await prisma.loanProvider.findMany({
        orderBy: {
            displayOrder: 'asc'
        }
    });
    return providers as LoanProviderType[];
}

export default async function AdminLayout({children}: {children: React.ReactNode}) {
  const providers = await getProviders();
  const user = await getUserFromSession();
  
  return (
    <AuthProvider initialUser={user}>
      <ProtectedLayout providers={providers}>
        {children}
      </ProtectedLayout>
    </AuthProvider>
  );
}
