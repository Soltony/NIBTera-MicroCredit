
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
    
    // Ensure userId is a valid number before querying
    const userId = Number(session.userId);
    if (isNaN(userId)) {
      console.error('Invalid user ID in session:', session.userId);
      return null;
    }
    
    const user = await userRepo.findOne({
      where: {id: userId},
      relations: ['role', 'provider'],
    });

    if (!user) return null;

    // Destructure and create a plain object to pass to client components
    const {password, ...userWithoutPassword} = user;

    return {
      id: String(userWithoutPassword.id),
      fullName: userWithoutPassword.fullName,
      email: userWithoutPassword.email,
      phoneNumber: userWithoutPassword.phoneNumber,
      status: userWithoutPassword.status,
      role: userWithoutPassword.role.name,
      providerId: userWithoutPassword.providerId ? String(userWithoutPassword.providerId) : undefined,
      providerName: userWithoutPassword.provider?.name || '',
    };
  } catch (error) {
    console.error('Database error while fetching user:', error);
    return null;
  }
}
