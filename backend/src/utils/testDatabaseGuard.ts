export function assertLocalTestDatabaseUrl(rawUrl: string | undefined): string {
  if (!rawUrl) {
    throw new Error('HOUSING_TEST_DATABASE_URL is required for integration tests');
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error('HOUSING_TEST_DATABASE_URL must be a valid MySQL URL');
  }

  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
  const isLocalHost = parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost';
  const isLocalDockerPort = parsed.port === '3307';

  if (
    parsed.protocol !== 'mysql:'
    || !isLocalHost
    || !isLocalDockerPort
    || !databaseName.endsWith('_test')
    || databaseName.length <= '_test'.length
  ) {
    throw new Error('Dedicated localhost:3307 *_test MySQL database required');
  }

  return rawUrl;
}
