import 'dotenv/config';
import { ensureLatestLocaldataCsvs } from '../services/localdataFileDownloader.js';

ensureLatestLocaldataCsvs()
  .then(({ results }) => {
    console.log('[localdata] 결과:', results);
    const failed = results.filter((r) => r.status === 'failed');
    process.exit(failed.length > 0 ? 1 : 0);
  })
  .catch((err) => {
    console.error('[localdata] 실패:', err);
    process.exit(1);
  });
