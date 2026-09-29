import { spawnSync } from 'node:child_process';
import { assertLocalTestDatabaseUrl } from '../utils/testDatabaseGuard.js';

const rawUrl = assertLocalTestDatabaseUrl(process.env.HOUSING_TEST_DATABASE_URL);

process.env.DATABASE_URL = rawUrl;
process.env.NODE_ENV = 'test';

const modes: Record<string, string[]> = {
  validate: ['node_modules/.bin/prisma', 'validate'],
  integration: ['node_modules/.bin/vitest', 'run', '--config', 'vitest.waste-integration.config.ts'],
  'migration-proof': ['node_modules/.bin/tsx', 'src/scripts/runWasteMigrationProof.ts'],
  migrate: [
    'node_modules/.bin/prisma',
    'db',
    'execute',
    '--file',
    'prisma/migrations/202609280001_waste_area_discovery/migration.sql',
    '--schema',
    'prisma/schema.prisma',
  ],
};
const command = modes[process.argv[2] ?? ''];

if (!command) {
  throw new Error('Expected validate, integration, migration-proof or migrate');
}

const result = spawnSync(command[0], command.slice(1), { stdio: 'inherit', env: process.env });

if (result.error) {
  throw result.error;
}

process.exitCode = result.status ?? 1;
