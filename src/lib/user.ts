

'use server';

import { getSession, deleteSession } from './session';
import prisma from './prisma';
import type { User as AuthUser, Permissions } from '@/lib/types';
import { Prisma } from '@prisma/client';

export async function getUserFromSession(): Promise<AuthUser | null> {
  try {
    const session = await getSession();

    if (!session?.userId) {
      return null;
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      include: {
        role: true,
        loanProvider: true,
      },
    });

    if (!user) {
      return null;
    }
    
    if (user.status === 'Inactive') {
        await deleteSession();
        return null;
    }
    
    const { password, ...userWithoutPassword } = user;
    
    const authUser: AuthUser = {
      ...userWithoutPassword,
      role: user.role.name as AuthUser['role'],
      providerName: user.loanProvider?.name,
      permissions: JSON.parse(user.role.permissions as string) as Permissions,
    };

    return authUser;

  } catch (error) {
    // Avoid using `instanceof Prisma.PrismaClientKnownRequestError` because
    // `Prisma` may be undefined at runtime in some environments which causes
    // the `instanceof` check to throw: "Function has non-object prototype 'undefined'".
    // Detect Prisma errors by inspecting the error `name` or `code` instead.
    const e = error as any;
    if (e && (e.name === 'PrismaClientKnownRequestError' || typeof e.code === 'string')) {
        // Handle specific prisma errors if needed
    }
    console.error('Get User Error:', error);
    return null;
  }
}

// Re-export cookies from next/headers to be used in server components
import { cookies } from 'next/headers';
export { cookies };
