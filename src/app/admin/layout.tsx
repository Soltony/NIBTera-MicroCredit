
import { AuthProvider } from '@/hooks/use-auth';
import { ProtectedLayout } from '@/components/admin/protected-layout';
import type { LoanProvider as LoanProviderType } from '@/lib/types';

export const dynamic = 'force-dynamic';

async function getProviders(): Promise<LoanProviderType[]> {
    // Database removed, returning empty array.
    return [];
}

export default async function AdminLayout({children}: {children: React.ReactNode}) {
  // User logic is now client-side only
  const providers = await getProviders();

  return (
    <AuthProvider>
      <ProtectedLayout providers={providers as LoanProviderType[]}>
        {children}
      </ProtectedLayout>
    </AuthProvider>
  );
}
