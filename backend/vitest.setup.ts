import path from 'node:path';
import os from 'node:os';
import { mkdirSync, mkdtempSync } from 'node:fs';

// Isolate generate-stage file writes from the repo so tests never produce
// stray drafts/meta files in `content/guides/`.
const root = mkdtempSync(path.join(os.tmpdir(), 'ilsangkit-test-'));
const draftDir = path.join(root, 'drafts');
const metaDir = path.join(root, 'meta');
mkdirSync(draftDir, { recursive: true });
mkdirSync(metaDir, { recursive: true });

process.env.GUIDE_DRAFT_DIR = draftDir;
process.env.GUIDE_META_DIR = metaDir;
