import { prisma } from '../../prisma/client';
import { ApiError } from '../../utils/apiError';
import type { CreateUserInput } from './users.schemas';

export const usersService = {
  async getByWallet(wallet: string) {
    const user = await prisma.user.findUnique({ where: { wallet } });
    if (!user) throw new ApiError(404, 'User not found');
    return user;
  },

  async create(input: CreateUserInput) {
    return prisma.user.upsert({
      where: { wallet: input.wallet },
      update: {
        role: input.role,
        displayName: input.displayName
      },
      create: input
    });
  }
};

