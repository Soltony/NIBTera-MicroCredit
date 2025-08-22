
import { SettingsClient } from '@/components/admin/settings-client';
import type { LoanProvider as LoanProviderType, DataProvisioningConfig } from '@/lib/types';

async function getProviders(): Promise<LoanProviderType[]> {
    // Database removed, returning empty array.
    return [];
}


export default async function AdminSettingsPage() {
    const providers = await getProviders();

    return <SettingsClient initialProviders={providers} />;
}
