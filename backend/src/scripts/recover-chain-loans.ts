import { prisma } from '../prisma/client.js';
import { serialize } from '../utils/serialize.js';
import { loansService } from '../modules/loans/loans.service.js';

const walletArg = process.argv.find((arg) => arg.startsWith('--wallet='));
const wallet = walletArg?.slice('--wallet='.length);

async function main(): Promise<void> {
  try {
    const report = await loansService.recoverChain(wallet ? { wallet } : undefined);
    console.log(JSON.stringify(serialize(report), null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Loan recovery failed');
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

void main();
