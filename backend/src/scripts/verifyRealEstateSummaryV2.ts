import { verifyRealEstateSummaryV2 } from '../services/realEstateSummaryValidation.js';
import { prisma } from '../lib/prisma.js';

export interface SummaryCliResult {
  exitCode: number;
  message: string;
}

function parseReportOut(args: string[]): string | undefined {
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg.startsWith('--report-out=')) return arg.slice('--report-out='.length);
    if (arg === '--report-out') return args[index + 1];
  }
  return undefined;
}

export async function runVerifyCli(args = process.argv.slice(2)): Promise<SummaryCliResult> {
  const report = await verifyRealEstateSummaryV2({ reportOut: parseReportOut(args) });
  console.info(JSON.stringify(report));
  return { exitCode: report.complete ? 0 : 4, message: report.complete ? 'summary V2 verified' : 'summary V2 validation incomplete' };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runVerifyCli()
    .then(async (result) => {
      if (result.message) console.info(result.message);
      await prisma.$disconnect();
      process.exit(result.exitCode);
    })
    .catch(async (error) => {
      console.error(error instanceof Error ? error.message : String(error));
      await prisma.$disconnect();
      process.exit(1);
    });
}
