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
    const rows = await listCandidates({ limit: 1000 });
    const counts = new Map<string, number>();
    for (const r of rows) {
      counts.set(r.status, (counts.get(r.status) ?? 0) + 1);
    }
    for (const status of Object.values(CANDIDATE_STATUS)) {
      console.log(`${status.padEnd(10)} ${counts.get(status) ?? 0}`);
    }
  });

program.parseAsync(process.argv).catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
