
'use server';

import { AppDataSource } from '@/data-source';
import { User } from '@/entities/User';
import { getSession } from './session';

export async function getUserFromSession() {
  const session = await getSession();
  if (!session?.userId) return null;

  try {
    if (!AppDataSource.isInitialized) {
        await AppDataSource.initialize();
    }
    const userRepo = AppDataSource.getRepository(User);
    
    const user = await userRepo.findOne({
      where: {id: Number(session.userId)},
      relations: ['role', 'provider'],
    });

    if (!user) return null;

    const {password, ...userWithoutPassword} = user;

    return {
      ...userWithoutPassword,
      id: String(user.id),
      providerId: user.providerId ? String(user.providerId) : undefined,
      role: user.role.name,
      providerName: user.provider?.name || '',
    };
  } catch (error) {
    console.error('Database error while fetching user:', error);
    return null;
  }
}
