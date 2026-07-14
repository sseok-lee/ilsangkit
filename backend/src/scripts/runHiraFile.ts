import 'dotenv/config';
import { ensureLatestHiraFiles } from '../services/hiraFileDownloader.js';

ensureLatestHiraFiles()
  .then((r) => {
    console.log('[HIRA] 결과:', r);
    process.exit(0);
  })
  .catch((err) => {
    console.error('[HIRA] 실패:', err);
    process.exit(1);
  });
