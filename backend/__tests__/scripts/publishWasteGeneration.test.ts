import { beforeEach, describe, expect, it, vi } from 'vitest';

const publishWasteGeneration = vi.hoisted(() => vi.fn());

vi.mock('../../src/services/wastePublicationService.js', () => ({
  publishWasteGeneration,
}));

describe('publishWasteGeneration CLI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    publishWasteGeneration.mockResolvedValue(undefined);
  });

  it('publishes an existing prepared generation with explicit expected base', async () => {
    const { runPublishWasteGenerationCli } = await import('../../src/scripts/publishWasteGeneration.js');

    await runPublishWasteGenerationCli([
      '--generation-id=prepared-generation',
      `--approval-report-hash=${'a'.repeat(64)}`,
      '--expected-base=active-generation',
    ]);

    expect(publishWasteGeneration).toHaveBeenCalledWith(
      'prepared-generation',
      'active-generation',
      'a'.repeat(64)
    );
  });

  it('maps expected-base=none to the initial null base', async () => {
    const { runPublishWasteGenerationCli } = await import('../../src/scripts/publishWasteGeneration.js');

    await runPublishWasteGenerationCli([
      '--generation-id=prepared-generation',
      `--approval-report-hash=${'b'.repeat(64)}`,
      '--expected-base=none',
    ]);

    expect(publishWasteGeneration).toHaveBeenCalledWith(
      'prepared-generation',
      null,
      'b'.repeat(64)
    );
  });

  it('requires expected-base instead of assuming null', async () => {
    const { runPublishWasteGenerationCli } = await import('../../src/scripts/publishWasteGeneration.js');

    await expect(runPublishWasteGenerationCli([
      '--generation-id=prepared-generation',
      `--approval-report-hash=${'c'.repeat(64)}`,
    ])).rejects.toThrow(/--expected-base/);

    expect(publishWasteGeneration).not.toHaveBeenCalled();
  });

  it('rejects blank publication inputs', async () => {
    const { runPublishWasteGenerationCli } = await import('../../src/scripts/publishWasteGeneration.js');

    await expect(runPublishWasteGenerationCli([
      '--generation-id=',
      `--approval-report-hash=${'d'.repeat(64)}`,
      '--expected-base=none',
    ])).rejects.toThrow(/--generation-id/);

    expect(publishWasteGeneration).not.toHaveBeenCalled();
  });

  it('rejects unknown publication flags before publishing', async () => {
    const { runPublishWasteGenerationCli } = await import('../../src/scripts/publishWasteGeneration.js');

    await expect(runPublishWasteGenerationCli([
      '--generation-id=prepared-generation',
      `--approval-report-hash=${'e'.repeat(64)}`,
      '--expected-base=none',
      '--reference-path=/tmp/stale.json',
    ])).rejects.toThrow(/unknown/i);

    expect(publishWasteGeneration).not.toHaveBeenCalled();
  });

  it('rejects duplicate publication flags before publishing', async () => {
    const { runPublishWasteGenerationCli } = await import('../../src/scripts/publishWasteGeneration.js');

    await expect(runPublishWasteGenerationCli([
      '--generation-id=prepared-generation',
      '--generation-id=other-generation',
      `--approval-report-hash=${'f'.repeat(64)}`,
      '--expected-base=none',
    ])).rejects.toThrow(/duplicate/i);

    expect(publishWasteGeneration).not.toHaveBeenCalled();
  });

  it('rejects space separated publication flags before publishing', async () => {
    const { runPublishWasteGenerationCli } = await import('../../src/scripts/publishWasteGeneration.js');

    await expect(runPublishWasteGenerationCli([
      '--generation-id',
      'prepared-generation',
      `--approval-report-hash=${'1'.repeat(64)}`,
      '--expected-base=none',
    ])).rejects.toThrow(/--generation-id=/);

    expect(publishWasteGeneration).not.toHaveBeenCalled();
  });
});
