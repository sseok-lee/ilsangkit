-- OBSOLETE / DO NOT RUN for the summary V2 transition.
-- The address-level summary transition must keep RealEstateBuildingSummary unchanged
-- and prepare RealEstateBuildingSummaryV2 via prisma/sql/20260929_summary_v2.sql.
-- This file intentionally fails closed so the legacy summary table is not altered
-- by the old in-place address identity experiment.

SIGNAL SQLSTATE '45000'
  SET MESSAGE_TEXT = 'Do not alter RealEstateBuildingSummary; use 20260929_summary_v2.sql for additive V2 preparation';
