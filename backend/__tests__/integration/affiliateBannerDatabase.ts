export function assertAffiliateTestDatabase(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('AFFILIATE_TEST_DATABASE_URL must be a valid MySQL URL');
  }

  const hostname = parsed.hostname.replace(/^\[|\]$/g, '');
  const loopbackHosts = new Set(['127.0.0.1', 'localhost', '::1']);
  const database = decodeURIComponent(parsed.pathname.replace(/^\//, ''));

  if (parsed.protocol !== 'mysql:') {
    throw new Error('AFFILIATE_TEST_DATABASE_URL must use the mysql protocol');
  }
  if (!loopbackHosts.has(hostname)) {
    throw new Error('AFFILIATE_TEST_DATABASE_URL must use a loopback host');
  }
  if (parsed.port !== '3307') {
    throw new Error('AFFILIATE_TEST_DATABASE_URL must use the local Docker MySQL port 3307');
  }
  if (database !== 'ilsangkit_affiliate_test') {
    throw new Error('AFFILIATE_TEST_DATABASE_URL must target ilsangkit_affiliate_test');
  }
}
