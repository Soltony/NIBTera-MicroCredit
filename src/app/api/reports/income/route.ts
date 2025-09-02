
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';

const getDates = (timeframe: string) => {
    const now = new Date();
    switch (timeframe) {
        case 'daily':
            return { gte: startOfDay(now), lte: endOfDay(now) };
        case 'weekly':
            return { gte: startOfWeek(now, { weekStartsOn: 1 }), lte: endOfWeek(now, { weekStartsOn: 1 }) };
        case 'monthly':
            return { gte: startOfMonth(now), lte: endOfMonth(now) };
        case 'yearly':
            return { gte: startOfYear(now), lte: endOfYear(now) };
        case 'overall':
        default:
            return { gte: undefined, lte: undefined };
    }
};

async function getIncomeData(providerIdFilter: any, dateFilter: any) {
    const whereClause = {
        ...providerIdFilter,
        ...dateFilter,
        ledgerAccount: {
            type: { in: ['Income', 'Received'] },
            category: { in: ['Interest', 'ServiceFee', 'Penalty'] }
        }
    };
    
    const results = await prisma.ledgerEntry.groupBy({
        by: ['type', 'ledgerAccountId'],
        where: whereClause,
        _sum: {
            amount: true
        }
    });

    const accountIds = results.map(r => r.ledgerAccountId);
    const accounts = await prisma.ledgerAccount.findMany({ 
        where: { id: { in: accountIds } },
        select: { id: true, category: true, providerId: true }
    });
    const accountMap = new Map(accounts.map(acc => [acc.id, acc]));

    const income = {
        accruedInterest: 0, collectedInterest: 0,
        accruedServiceFee: 0, collectedServiceFee: 0,
        accruedPenalty: 0, collectedPenalty: 0,
    };

    for (const res of results) {
        const account = accountMap.get(res.ledgerAccountId);
        if (!account) continue;

        const amount = res._sum.amount || 0;
        const category = account.category;
        const type = res.type; // 'Credit' for accrued, 'Debit' for collected
        
        if (category === 'Interest') {
            if (type === 'Credit') income.accruedInterest += amount;
            else income.collectedInterest += amount;
        } else if (category === 'ServiceFee') {
            if (type === 'Credit') income.accruedServiceFee += amount;
            else income.collectedServiceFee += amount;
        } else if (category === 'Penalty') {
            if (type === 'Credit') income.accruedPenalty += amount;
            else income.collectedPenalty += amount;
        }
    }
    return income;
}


export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const providerId = searchParams.get('providerId');
    const timeframe = searchParams.get('timeframe') || 'overall';
    const dateRange = getDates(timeframe);

    try {
        const allProviders = await prisma.loanProvider.findMany({
            where: providerId && providerId !== 'all' ? { id: providerId } : {}
        });

        const reportData = [];

        for (const provider of allProviders) {
            const providerIdFilter = { journalEntry: { providerId: provider.id } };
            const dateFilter = {
                ...(dateRange.gte && { journalEntry: { date: { gte: dateRange.gte } } }),
                ...(dateRange.lte && { journalEntry: { date: { lte: dateRange.lte } } }),
            };
            
            const income = await getIncomeData(providerIdFilter, dateFilter);
            reportData.push({
                provider: provider.name,
                ...income
            });
        }
        
        return NextResponse.json(reportData);

    } catch (error) {
        console.error('Failed to fetch income report:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

    