
import { AuthProvider } from '@/hooks/use-auth';
import { getUserFromSession as getCurrentUser } from '@/lib/user';
import { ProtectedLayout } from '@/components/admin/protected-layout';
import { prisma } from '@/lib/prisma';

async function getProviders() {
    const providers = await prisma.loanProvider.findMany({
        include: {
            products: true,
        }
    });
    return providers.map(p => ({
        ...p,
    }));
}

export default async function AdminLayout({children}: {children: React.ReactNode}) {
  const user = await getCurrentUser();
  const providers = await getProviders();

  return (
    <AuthProvider initialUser={user}>
      <ProtectedLayout providers={providers}>
        {children}
      </ProtectedLayout>
    </AuthProvider>
  );
}
