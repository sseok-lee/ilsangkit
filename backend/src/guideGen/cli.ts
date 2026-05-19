import { Command } from 'commander';
import Table from 'cli-table3';
import { fetchKoreaKrRss } from './ingest/sources/koreaKr.js';
import {
  fetchMinistryRss,
  MINISTRY_FEEDS,
} from './ingest/sources/ministryRss.js';
import { runIngest } from './ingest/ingestRunner.js';
import {
  approveCandidate,
  listCandidates,
  rejectCandidate,
  showCandidate,
} from './curate/candidateCli.js';
import { CANDIDATE_STATUS, type CandidateStatus } from './shared/config.js';
import { runPipeline } from './generate/pipeline.js';

const program = new Command();
program.name('guide').description('Guide generation pipeline CLI');

program
  .command('ingest')
  .option('--category <slug>')
  .option('--provider <name>')
  .option('--since <date>', 'ISO date (YYYY-MM-DD)')
  .action(async (opts) => {
    const since = opts.since ? new Date(opts.since) : undefined;
    const fetchers: Array<() => Promise<Awaited<ReturnType<typeof fetchKoreaKrRss>>>> = [];

    if (!opts.provider || opts.provider === 'korea.kr') {
      fetchers.push(() => fetchKoreaKrRss());
    }
    for (const feed of MINISTRY_FEEDS) {
      if (opts.provider && opts.provider !== feed.provider) continue;
      fetchers.push(() => fetchMinistryRss(feed));
    }

    const result = await runIngest({
      fetchers,
      category: opts.category,
      since,
    });
    for (const [provider, stats] of Object.entries(result.perProvider)) {
      console.log(
        `[ingest] ${provider.padEnd(14)} fetched=${stats.fetched} new=${stats.new} updated=${stats.updated}`
      );
    }
    console.log(
      `[ingest] total: new=${result.new} updated=${result.updated}  matched=${result.matched} unmatched=${result.unmatched}`
    );
  });

program
  .command('list')
  .option('--status <status>')
  .option('--limit <n>', '', '50')
  .action(async (opts) => {
    const rows = await listCandidates({
      status: opts.status as CandidateStatus | undefined,
      limit: Number(opts.limit),
    });
    const table = new Table({
      head: ['id', 'provider', 'category', 'status', 'title'],
      colWidths: [18, 14, 16, 12, 50],
      wordWrap: true,
    });
    for (const r of rows) {
      table.push([
        r.id.slice(0, 16),
        r.sourceProvider,
        r.matchedCategory ?? '(unmatched)',
        r.status,
        r.sourceTitle,
      ]);
    }
    console.log(table.toString());
    console.log(`total: ${rows.length}`);
  });

program
  .command('show <id>')
  .action(async (id) => {
    const row = await showCandidate({ id });
    if (!row) {
      console.error(`not found: ${id}`);
      process.exitCode = 1;
      return;
    }
    console.log(JSON.stringify(row, null, 2));
  });

program
  .command('approve <id>')
  .option('--category <slug>')
  .option('--note <text>')
  .action(async (id, opts) => {
    const row = await approveCandidate({
      id,
      category: opts.category,
      note: opts.note,
    });
    console.log(`approved ${row.id} (category=${row.matchedCategory})`);
  });

program
  .command('reject <id>')
  .requiredOption('--reason <text>')
  .action(async (id, opts) => {
    const row = await rejectCandidate({ id, reason: opts.reason });
    console.log(`rejected ${row.id}`);
  });

program
  .command('status')
  .action(async () => {
    const prisma = (await import('../lib/prisma.js')).default;
    const grouped = await prisma.guideCandidate.groupBy({
      by: ['status'],
      _count: { _all: true },
    });
    const counts = new Map<string, number>();
    for (const row of grouped) {
      counts.set(row.status, row._count._all);
    }
    const known = new Set<string>(Object.values(CANDIDATE_STATUS));
    for (const status of Object.values(CANDIDATE_STATUS)) {
      console.log(`${status.padEnd(10)} ${counts.get(status) ?? 0}`);
    }
    for (const [status, count] of counts) {
      if (!known.has(status)) {
        console.log(`${status.padEnd(10)} ${count}  (unknown status)`);
      }
    }
  });

program
  .command('generate <id>')
  .description('Run Extract → Plan → Draft → Check on an approved candidate')
  .action(async (id) => {
    try {
      const report = await runPipeline({ candidateId: id });
      console.log(`[generate] candidate=${id} passed=${report.passed} attempt=${report.attempt}`);
      if (!report.passed) {
        for (const [name, entry] of Object.entries(report.checks)) {
          if (!entry.passed) {
            console.log(`  - ${name}: ${JSON.stringify(entry)}`);
          }
        }
        process.exitCode = 1;
      }
    } catch (err) {
      console.error(`[generate] failed: ${(err as Error).message}`);
      process.exitCode = 1;
    }
  });

program.parseAsync(process.argv).catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
