import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { Loan } from '@prisma/client';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const borrowerId = params.id;

  if (!borrowerId) {
    return NextResponse.json({ error: 'Borrower ID is required.' }, { status: 400 });
  }

  try {
    const loans = await prisma.loan.findMany({
      where: { borrowerId: borrowerId },
      include: {
        product: true,
      },
      orderBy: {
        disbursedDate: 'desc',
      },
    });

    const formattedLoans = loans.map(loan => ({
      id: loan.id,
      providerId: loan.product.providerId,
      productId: loan.productId,
      productName: loan.product.name,
      loanAmount: loan.loanAmount,
      repaidAmount: loan.repaidAmount || 0,
      penaltyAmount: loan.penaltyAmount,
      dueDate: loan.dueDate,
      repaymentStatus: loan.repaymentStatus,
    }));

    return NextResponse.json(formattedLoans);

  } catch (error) {
    console.error('Failed to fetch loans for borrower:', error);
    return NextResponse.json({ error: 'An internal server error occurred.' }, { status: 500 });
  }
}
