import { assertLocalTestDatabaseUrl } from '../../src/utils/testDatabaseGuard.js';

const rawUrl = assertLocalTestDatabaseUrl(process.env.HOUSING_TEST_DATABASE_URL);

process.env.DATABASE_URL = rawUrl;
process.env.NODE_ENV = 'test';
