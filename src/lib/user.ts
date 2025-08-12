'use server';

import {prisma} from './prisma';
import {getSession} from './session';

export async function getUserFromSession() {
  const session = await getSession();
  if (!session?.userId) return null;

  try {
    const user = await prisma.user.findUnique({
      where: {id: session.userId},
      include: {
        role: true,
        provider: true,
      },
    });

    if (!user) return null;

    const {password, ...userWithoutPassword} = user;

    return {
      ...userWithoutPassword,
      role: user.role.name,
      providerName: user.provider?.name || '',
    };
  } catch (error) {
    console.error('Database error while fetching user:', error);
    return null;
  }
}
