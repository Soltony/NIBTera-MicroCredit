
'use server';

import prisma from '@/lib/prisma';
import { TaxSettingsClient } from '@/components/admin/tax-settings-client';

async function getTaxConfigs() {
    return await prisma.tax.findMany({
        orderBy: { name: 'asc' },
    });
}

export default async function TaxPage() {
    const taxConfigs = await getTaxConfigs();
    return <TaxSettingsClient initialTaxes={taxConfigs} />;
}

    