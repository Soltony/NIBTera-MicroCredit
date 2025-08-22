
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// This route fetches all columns from all data provisioning configs for a given provider.
// These columns can be used as custom parameters in the credit scoring engine.
export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const providerId = searchParams.get('providerId');

    if (!providerId) {
        return NextResponse.json({ error: 'Provider ID is required' }, { status: 400 });
    }

    try {
        const configs = await prisma.dataProvisioningConfig.findMany({
            where: { providerId },
        });

        // Flatten all columns from all configs into a single array
        const customParameters = configs.flatMap(config => {
            try {
                const columns = JSON.parse(config.columns as string);
                // We only care about the name/value for the dropdown
                return columns.map((col: { name: string }) => ({ value: col.name, label: col.name }));
            } catch (e) {
                return [];
            }
        });

        // Remove duplicates in case multiple configs have the same column name
        const uniqueParameters = Array.from(new Map(customParameters.map(item => [item['value'], item])).values());


        return NextResponse.json(uniqueParameters);
    } catch (error) {
        console.error('Error fetching custom parameters:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
