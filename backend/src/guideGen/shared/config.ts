export const DRAFT_DIR =
  process.env.GUIDE_DRAFT_DIR ?? 'content/guides/drafts';

export const META_DIR =
  process.env.GUIDE_META_DIR ?? 'content/guides/meta';

export const MODEL_DEFAULT =
  process.env.GUIDE_MODEL_DEFAULT ?? 'gpt-4.1';

export const MODEL_EXTRACT =
  process.env.GUIDE_MODEL_EXTRACT ?? MODEL_DEFAULT;

export const MODEL_CHECK =
  process.env.GUIDE_MODEL_CHECK ?? MODEL_DEFAULT;

export const ARTICLE_LENGTH_RANGES: Record<string, [number, number]> = {
  'news-brief':       [1200, 1800],
  'policy-explainer': [1800, 2700],
  'living-impact':    [1500, 2300],
  'data-update':      [1200, 2000],
  'how-to-check':     [1500, 2500],
};

export const CANDIDATE_STATUS = {
  PENDING:   'pending',
  APPROVED:  'approved',
  REJECTED:  'rejected',
  DRAFTED:   'drafted',
  PUBLISHED: 'published',
  FAILED:    'failed',
} as const;

export type CandidateStatus =
  (typeof CANDIDATE_STATUS)[keyof typeof CANDIDATE_STATUS];
