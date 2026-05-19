export type ArticleType =
  | 'news-brief'
  | 'policy-explainer'
  | 'living-impact'
  | 'data-update'
  | 'how-to-check';

export interface Fact {
  id: string;
  statement: string;
  sourceQuote: string;
  confidence: 'high' | 'low';
}

export interface NumberFact {
  id: string;
  value: number;
  unit: string;
  context: string;
}

export interface DateFact {
  id: string;
  date: string;       // ISO YYYY-MM-DD
  eventType: string;
}

export interface TargetFact {
  id: string;
  who: string;
  condition: string;
}

export interface FactsJson {
  candidateId: string;
  sourceMeta: {
    url: string;
    provider: string;
    publishedAt: string;
    issuedBy: string;
  };
  facts: Fact[];
  numbers: NumberFact[];
  dates: DateFact[];
  targets: TargetFact[];
  unknowns: string[];
}

export interface PlanSection {
  heading: string;
  intent: string;
  factsRefs: string[];
}

export interface PlanJson {
  articleType: ArticleType;
  typeMix?: string;
  title: string;
  summary: string;
  angle: string;
  sections: PlanSection[];
  internalLinks: Array<{ path: string; reason: string }>;
  keywords: string[];
  slug: string;
}

export interface CheckResultEntry {
  passed: boolean;
  hits?: string[];
  value?: number;
  range?: [number, number];
  extra?: string[];
  missing?: string[];
  issues?: string[];
}

export interface CheckReport {
  passed: boolean;
  attempt: number;
  checks: {
    bannedPhrases: CheckResultEntry;
    lengthRange: CheckResultEntry;
    factsCoverage: CheckResultEntry;
    internalLinkValid: CheckResultEntry;
    referencesSection: CheckResultEntry;
    slugUnique: CheckResultEntry;
    modelReview: CheckResultEntry;
  };
}
