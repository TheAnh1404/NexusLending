import { prisma } from '../../prisma/client.js';
import { ApiError } from '../../utils/apiError.js';
import type { ConnectUserInput, CreateUserInput } from './users.schemas.js';

export const usersService = {
  async getByWallet(wallet: string) {
    const user = await prisma.user.findUnique({ where: { wallet } });
    if (!user) throw new ApiError(404, 'User not found');
    return user;
  },

  async findOrCreate(input: ConnectUserInput) {
    return prisma.user.upsert({
      where: { wallet: input.wallet },
      update: {},
      create: { wallet: input.wallet }
    });
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
