import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function getImageRoot(): string {
  return path.resolve(process.env.UPLOAD_DIR || fileURLToPath(new URL('../../../assets/images/', import.meta.url)));
}
