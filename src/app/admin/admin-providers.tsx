'use client';

import { AuthProvider } from '@/hooks/use-auth';
import { ProtectedLayout } from '@/components/admin/protected-layout';
import type { AuthenticatedUser } from '@/hooks/use-auth';
import type { LoanProvider as LoanProviderType } from '@/lib/types';

interface AdminProvidersProps {
    children: React.ReactNode;
    initialUser: AuthenticatedUser | null;
    providers: LoanProviderType[];
}

export function AdminProviders({ children, initialUser, providers }: AdminProvidersProps) {
    return (
        <AuthProvider initialUser={initialUser}>
            <ProtectedLayout providers={providers}>
                {children}
            </ProtectedLayout>
        </AuthProvider>
    );
}
