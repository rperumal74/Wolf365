-- Correct CRM opportunities whose MONTHLY figures were imported from annual
-- values. Sales reps entered the Salesforce Amount inconsistently; anything
-- whose stored MRR (monthlyAmount) exceeds $10,000 was actually a yearly
-- figure, so the true monthly value is that amount / 12.
--
-- Every money field scales linearly with the monthly amount, so dividing them
-- all by 12 keeps TCV, margin and commission internally consistent.
-- marginPercentage is a ratio (monthlyMargin / monthlyAmount) and is therefore
-- unchanged — we deliberately leave it alone.
--
-- This is a one-time data correction. `prisma migrate deploy` applies each
-- migration exactly once (tracked in _prisma_migrations), so the division is
-- never re-applied to already-corrected rows.
UPDATE "CrmOpportunity"
SET
  "monthlyAmount"    = ROUND("monthlyAmount" / 12.0, 2),
  "monthlyMargin"    = CASE WHEN "monthlyMargin"    IS NOT NULL THEN ROUND("monthlyMargin" / 12.0, 2)    ELSE NULL END,
  "amount"           = CASE WHEN "amount"           IS NOT NULL THEN ROUND("amount" / 12.0, 2)           ELSE NULL END,
  "marginAmount"     = CASE WHEN "marginAmount"     IS NOT NULL THEN ROUND("marginAmount" / 12.0, 2)     ELSE NULL END,
  "commissionAmount" = CASE WHEN "commissionAmount" IS NOT NULL THEN ROUND("commissionAmount" / 12.0, 2) ELSE NULL END
WHERE "monthlyAmount" IS NOT NULL
  AND "monthlyAmount" > 10000;
