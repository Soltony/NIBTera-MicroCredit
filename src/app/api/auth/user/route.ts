
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import prisma from '@/lib/prisma';
import type { User as PrismaUser, Role as PrismaRole, LoanProvider as PrismaLoanProvider } from '@prisma/client';
import type { User as AuthUser } from '@/lib/types';


export async function GET(req: NextRequest) {
  try {
    const session = await getSession();

    if (!session?.userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      include: {
        role: {
          include: {
             _count: {
              select: {
                users: true,
              }
            }
          }
        },
        loanProvider: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { password, ...userWithoutPassword } = user;
    
    const authUser: AuthUser = {
      ...userWithoutPassword,
      role: user.role.name as AuthUser['role'],
      providerName: user.loanProvider?.name,
    };


    return NextResponse.json(authUser, { status: 200 });

  } catch (error) {
    console.error('Get User Error:', error);
    return NextResponse.json({ error: 'An internal server error occurred.' }, { status: 500 });
  }
}
