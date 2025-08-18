
import { NextResponse } from 'next/server';
import { deepClone } from 'fast-json-patch';
import type { ScoringParameters } from '@/lib/types';


const DEFAULT_PARAMETERS: ScoringParameters = {
  productIds: [],
  weights: {
    age: { enabled: true, value: 10 },
    transactionHistoryTotal: { enabled: true, value: 20 },
    transactionHistoryByProduct: { enabled: true, values: { 'tp-1': 5, 'tp-2': 5, 'tp-3': 5 } },
    loanHistoryCount: { enabled: true, value: 20 },
    onTimeRepayments: { enabled: true, value: 25 },
    salary: { enabled: true, value: 10 },
  },
  genderImpact: {
    enabled: false,
    male: 0,
    female: 0,
  },
  occupationRisk: {
    enabled: true,
    values: {
        'doctor': 'Low',
        'engineer': 'Low',
        'teacher': 'Low',
        'artist': 'Medium',
        'freelancer': 'Medium',
        'unemployed': 'High',
    },
  },
};

// In-memory store to simulate a database.
// In a real app, you would replace this with Prisma calls.
let scoringConfigs: Record<string, ScoringParameters> = {};

function getConfigForProvider(providerId: string) {
    if (!scoringConfigs[providerId]) {
        scoringConfigs[providerId] = deepClone(DEFAULT_PARAMETERS);
    }
    return scoringConfigs[providerId];
}

// GET all configs
export async function GET() {
    // In a real app, you'd fetch all configs from the DB
    return NextResponse.json(scoringConfigs);
}

// POST a new or updated config for a provider
export async function POST(req: Request) {
    try {
        const { providerId, config } = await req.json();

        if (!providerId || !config) {
            return NextResponse.json({ error: 'Missing providerId or config' }, { status: 400 });
        }
        
        // Save to our in-memory store
        scoringConfigs[providerId] = config;

        // In a real app:
        // await prisma.scoringConfiguration.upsert({
        //     where: { providerId },
        //     update: { config },
        //     create: { providerId, config },
        // });

        return NextResponse.json(config, { status: 200 });

    } catch (error) {
        console.error('Error saving scoring config:', error);
        return NextResponse.json({ error: 'Failed to save configuration' }, { status: 500 });
    }
}


// DELETE a config for a provider (reset to default)
export async function DELETE(req: Request) {
    try {
        const { providerId } = await req.json();
        if (!providerId) {
            return NextResponse.json({ error: 'Missing providerId' }, { status: 400 });
        }
        
        const defaultConfig = deepClone(DEFAULT_PARAMETERS);
        scoringConfigs[providerId] = defaultConfig;
        
        return NextResponse.json(defaultConfig, { status: 200 });

    } catch (error) {
        console.error('Error deleting scoring config:', error);
        return NextResponse.json({ error: 'Failed to reset configuration' }, { status: 500 });
    }
}
