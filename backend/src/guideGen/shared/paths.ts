import path from 'node:path';
import { DRAFT_DIR, META_DIR } from './config.js';

export function metaDirFor(candidateId: string): string {
  return path.join(META_DIR, candidateId);
}

export function factsPath(candidateId: string): string {
  return path.join(metaDirFor(candidateId), 'facts.json');
}

export function planPath(candidateId: string): string {
  return path.join(metaDirFor(candidateId), 'plan.json');
}

export function checkPath(candidateId: string): string {
  return path.join(metaDirFor(candidateId), 'check.json');
}

export function draftPath(opts: { publishedAt: Date; slug: string }): string {
  const yyyymmdd = opts.publishedAt.toISOString().slice(0, 10);
  return path.join(DRAFT_DIR, `${yyyymmdd}-${opts.slug}.md`);
}
