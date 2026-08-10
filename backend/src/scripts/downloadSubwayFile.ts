import 'dotenv/config';
import { ensureLatestSubwayCsv } from '../services/kricSubwayFileDownloader.js';

ensureLatestSubwayCsv()
  .then((result) => {
    console.log('[kric] 결과:', result);
    process.exit(result.status === 'failed' ? 1 : 0);
  })
  .catch((err) => {
    console.error('[kric] 실패:', err);
    process.exit(1);
  });
