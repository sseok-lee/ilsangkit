import { describe, expect, it } from 'vitest';
import { redactBackfillResultForLog } from '../../src/scripts/backfillWasteAreas.js';

describe('redactBackfillResultForLog', () => {
  it('removes reviewReport from CLI-safe backfill results', () => {
    expect(redactBackfillResultForLog({
      sourceRows: 1,
      generationId: 'generation-1',
      reportHash: 'a'.repeat(64),
      canPublish: true,
      reviewReport: { sourceChanges: [{ sourceId: 'source-1' }] },
    })).toEqual({
      sourceRows: 1,
      generationId: 'generation-1',
      reportHash: 'a'.repeat(64),
      canPublish: true,
    });
  });
});
