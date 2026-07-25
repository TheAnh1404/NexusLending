import { prisma } from '../prisma/client';
import { serialize } from '../utils/serialize';
import { loansService } from '../modules/loans/loans.service';

const loanIds = process.argv
  .filter((arg) => arg.startsWith('--id='))
  .map((arg) => arg.slice('--id='.length));

const reasonArg = process.argv.find((arg) => arg.startsWith('--reason='));
const reason = reasonArg?.slice('--reason='.length);

async function main(): Promise<void> {
  if (loanIds.length === 0) {
    console.error('Usage: npx ts-node src/scripts/admin-close-loans.ts --id=<loanId1> --id=<loanId2> [--reason="..."]');
    process.exitCode = 1;
    return;
  }

  console.log(`Admin closing ${loanIds.length} loan(s): ${loanIds.join(', ')}`);
  if (reason) console.log(`Reason: ${reason}`);

  try {
    const report = await loansService.adminClose(loanIds, reason);
    console.log(JSON.stringify(serialize(report), null, 2));

    if (report.failed > 0) {
      console.warn(`\n⚠️  ${report.failed} loan(s) failed to close.`);
      process.exitCode = 1;
    } else {
      console.log(`\n✅ All ${report.successful} loan(s) closed successfully.`);
      console.log('ℹ️  Associated offers reverted to Active status — lender can now cancel them via UI to release funds from Vault/Escrow.');
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Admin close failed');
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

void main();
