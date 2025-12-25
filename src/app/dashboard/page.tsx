
import { DashboardClient } from '@/components/dashboard/dashboard-client';
import type { LoanDetails, LoanProvider, FeeRule, PenaltyRule } from '@/lib/types';
import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import prisma from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { requireMiniAppAuthContext } from '@/lib/miniapp-auth';

const safeJsonParse = (jsonString: string | null | undefined, defaultValue: any) => {
    if (!jsonString) return defaultValue;
    try {
        return JSON.parse(jsonString);
    } catch (e) {
        return defaultValue;
    }
};

async function getProviders(): Promise<LoanProvider[]> {
    try {
        const providers = await prisma.loanProvider.findMany({
            include: {
                products: {
                    where: {
                        status: 'Active'
                    },
                    orderBy: {
                        name: 'asc'
                    }
                }
            },
            orderBy: {
                displayOrder: 'asc'
            }
        });

        return providers.map(p => ({
            ...p,
            products: p.products.map(prod => ({
                ...prod,
                serviceFee: safeJsonParse(prod.serviceFee, { type: 'percentage', value: 0 }) as FeeRule,
                dailyFee: safeJsonParse(prod.dailyFee, { type: 'percentage', value: 0 }) as FeeRule,
                penaltyRules: safeJsonParse(prod.penaltyRules, []) as PenaltyRule[],
            }))
        })) as LoanProvider[];
    } catch(e) {
        console.error(e);
        return [];
    }
}

async function getLoanHistory(borrowerId: string): Promise<LoanDetails[]> {
     try {
        if (!borrowerId) return [];

        const loans = await prisma.loan.findMany({
            where: { borrowerId },
            include: {
                product: {
                  include: {
                    provider: true
                  }
                },
                payments: {
                    orderBy: {
                        date: 'asc'
                    }
                }
            },
            orderBy: {
                disbursedDate: 'desc'
            }
        });

        return loans.map(loan => ({
            id: loan.id,
            borrowerId: loan.borrowerId,
            providerName: loan.product.provider.name,
            productName: loan.product.name,
            loanAmount: loan.loanAmount,
            serviceFee: loan.serviceFee,
            disbursedDate: loan.disbursedDate,
            dueDate: loan.dueDate,
            repaymentStatus: loan.repaymentStatus as 'Paid' | 'Unpaid',
            repaidAmount: loan.repaidAmount || 0,
            penaltyAmount: loan.penaltyAmount,
            product: {
              ...loan.product,
              serviceFee: safeJsonParse(loan.product.serviceFee, { type: 'percentage', value: 0 }),
              dailyFee: safeJsonParse(loan.product.dailyFee, { type: 'percentage', value: 0 }),
              penaltyRules: safeJsonParse(loan.product.penaltyRules, []),
            },
            payments: loan.payments.map(p => ({
                id: p.id,
                amount: p.amount,
                date: p.date,
                outstandingBalanceBeforePayment: p.outstandingBalanceBeforePayment,
            }))
        })) as LoanDetails[];
    } catch(e) {
        console.error(e);
        return [];
    }
}


export default async function DashboardPage({ searchParams }: { searchParams: { [key: string]: string | string[] | undefined }}) {
    const ctx = await requireMiniAppAuthContext().catch(() => null);
    if (!ctx) {
        redirect('/loan/connect');
    }

    const borrowerIdFromUrl = searchParams['borrowerId'] as string | undefined;
    if (!borrowerIdFromUrl || String(borrowerIdFromUrl) !== String(ctx.borrowerId)) {
        const sp = new URLSearchParams();
        for (const [k, v] of Object.entries(searchParams || {})) {
            if (v == null) continue;
            if (Array.isArray(v)) {
                for (const vv of v) sp.append(k, String(vv));
            } else {
                sp.set(k, String(v));
            }
        }
        sp.set('borrowerId', String(ctx.borrowerId));
        redirect(`/dashboard?${sp.toString()}`);
    }

    const borrowerId = String(ctx.borrowerId);
    const providers = await getProviders();
    const loanHistory = await getLoanHistory(borrowerId);
    
    return (
        <Suspense fallback={
            <div className="flex flex-col min-h-screen bg-background items-center justify-center">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        }>
            <DashboardClient providers={providers} initialLoanHistory={loanHistory} />
        </Suspense>
    );
}
