
import { AuthProvider } from '@/hooks/use-auth';
import { getCurrentUser } from '@/lib/session';
import { ProtectedLayout } from '@/components/admin/protected-layout';

export default async function AdminLayout({children}: {children: React.ReactNode}) {
  const user = await getCurrentUser();

  return (
    <AuthProvider initialUser={user}>
      <ProtectedLayout>
        {children}
      </ProtectedLayout>
    </AuthProvider>
  );
}
