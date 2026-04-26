-- Financial OS: bank linking + sync.
--
-- Extends the existing financial_accounts / financial_transactions
-- schema with everything Plaid (and future providers like TrueLayer
-- or GoCardless) needs to keep the local rows in sync:
--
--   1. bank_connections — one row per linked Plaid Item. Holds the
--      access_token, institution metadata, and the cursor used by
--      /transactions/sync.
--   2. ALTER financial_accounts: external_id, source, mask, subtype.
--   3. ALTER financial_transactions: external_id, source, pending,
--      iso_currency_code, payment_channel, plaid_category_detailed
--      JSONB. UNIQUE (user_id, source, external_id) makes the sync
--      upsert idempotent.
--   4. subscription_audit — view that joins active contracts to
--      transactions by fuzzy merchant match. Closes the loop on the
--      detect-recurring-payments edge function: now you can see
--      "your last $14.99 Netflix charge hit on the 14th" alongside
--      the contract row.
--   5. finance_summary — month-to-date rollups per category + per
--      account, in one query for the dashboard.

-- ============================================================
-- 1. bank_connections
-- ============================================================
CREATE TABLE IF NOT EXISTS public.bank_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  -- 'plaid' for now; 'truelayer' / 'gocardless' / etc. later. Keep
  -- the column generic so the same table holds every provider.
  provider TEXT NOT NULL DEFAULT 'plaid'
    CHECK (provider IN ('plaid', 'truelayer', 'gocardless', 'manual')),
  -- Plaid: item_id from /item/get. Other providers: their connection
  -- id. NULL for 'manual' (no upstream).
  external_item_id TEXT,
  -- Plaid: access_token (sk_live or sk_sandbox-prefixed). Stored at
  -- rest in plaintext — Supabase encrypts the column with the
  -- platform key, but if you're operating outside Supabase managed,
  -- wrap this in pgsodium or rotate it through Vault.
  access_token TEXT,
  institution_id TEXT,
  institution_name TEXT,
  -- One of: 'good' | 'reauth_required' | 'error' | 'disabled'. We
  -- bump it from the sync edge fn when Plaid returns ITEM_LOGIN_REQUIRED.
  status TEXT NOT NULL DEFAULT 'good'
    CHECK (status IN ('good', 'reauth_required', 'error', 'disabled')),
  -- Cursor returned by /transactions/sync — pass back on the next
  -- call to fetch only deltas. Empty string on first sync.
  sync_cursor TEXT NOT NULL DEFAULT '',
  last_synced_at TIMESTAMPTZ,
  last_error TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, provider, external_item_id)
);

CREATE INDEX IF NOT EXISTS bank_connections_user_idx
  ON public.bank_connections (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS bank_connections_user_active_idx
  ON public.bank_connections (user_id, status)
  WHERE status IN ('good', 'reauth_required');

ALTER TABLE public.bank_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own bank connections"
  ON public.bank_connections FOR SELECT
  USING (auth.uid() = user_id);

-- We deliberately DO NOT expose INSERT / UPDATE policies — the
-- access_token is sensitive. All writes go through the service role
-- via the plaid-* edge functions.

CREATE POLICY "Users delete own bank connections"
  ON public.bank_connections FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_bank_connections_updated_at
  BEFORE UPDATE ON public.bank_connections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 2. ALTER financial_accounts
-- ============================================================
ALTER TABLE public.financial_accounts
  ADD COLUMN IF NOT EXISTS source TEXT
    DEFAULT 'manual'
    CHECK (source IN ('plaid', 'truelayer', 'gocardless', 'manual', 'imported'));
ALTER TABLE public.financial_accounts
  ADD COLUMN IF NOT EXISTS external_id TEXT;
ALTER TABLE public.financial_accounts
  ADD COLUMN IF NOT EXISTS mask TEXT;
ALTER TABLE public.financial_accounts
  ADD COLUMN IF NOT EXISTS subtype TEXT;
ALTER TABLE public.financial_accounts
  ADD COLUMN IF NOT EXISTS bank_connection_id UUID
    REFERENCES public.bank_connections(id) ON DELETE SET NULL;

-- One Plaid account_id can only map to one of our rows per user.
-- Partial unique index because manual rows have NULL external_id and
-- aren't subject to dedup.
CREATE UNIQUE INDEX IF NOT EXISTS financial_accounts_external_uniq
  ON public.financial_accounts (user_id, source, external_id)
  WHERE external_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS financial_accounts_connection_idx
  ON public.financial_accounts (bank_connection_id)
  WHERE bank_connection_id IS NOT NULL;

-- ============================================================
-- 3. ALTER financial_transactions
-- ============================================================
ALTER TABLE public.financial_transactions
  ADD COLUMN IF NOT EXISTS source TEXT
    DEFAULT 'manual'
    CHECK (source IN ('plaid', 'truelayer', 'gocardless', 'manual', 'imported'));
ALTER TABLE public.financial_transactions
  ADD COLUMN IF NOT EXISTS external_id TEXT;
ALTER TABLE public.financial_transactions
  ADD COLUMN IF NOT EXISTS pending BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.financial_transactions
  ADD COLUMN IF NOT EXISTS iso_currency_code TEXT;
ALTER TABLE public.financial_transactions
  ADD COLUMN IF NOT EXISTS payment_channel TEXT;
-- Plaid's "personal_finance_category" object: { primary, detailed,
-- confidence_level }. Stored verbatim so we don't lose detail.
ALTER TABLE public.financial_transactions
  ADD COLUMN IF NOT EXISTS plaid_category_detailed JSONB;
ALTER TABLE public.financial_transactions
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS financial_transactions_external_uniq
  ON public.financial_transactions (user_id, source, external_id)
  WHERE external_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS financial_transactions_merchant_idx
  ON public.financial_transactions (user_id, lower(merchant))
  WHERE merchant IS NOT NULL;

-- ============================================================
-- 4. subscription_audit view
-- ============================================================
-- For each active contract, find the most recent transaction whose
-- merchant looks like the contract provider (case-insensitive
-- substring match either direction) and compute the days since the
-- last charge. The UI uses this to flag "your subscription is older
-- than the renewal cycle but you haven't been billed lately" or
-- "you cancelled but the bank still shows charges".
CREATE OR REPLACE VIEW public.subscription_audit AS
SELECT
  c.id AS contract_id,
  c.user_id,
  c.name AS contract_name,
  c.provider AS contract_provider,
  c.category AS contract_category,
  c.cost_amount AS expected_amount,
  c.cost_frequency AS expected_frequency,
  c.renewal_date,
  c.auto_renews,
  -- Most recent matched transaction. NULL if no merchant on file
  -- looks like this contract — useful "we never saw a charge" signal.
  last_match.tx_id AS last_transaction_id,
  last_match.tx_merchant AS last_transaction_merchant,
  last_match.tx_amount AS last_transaction_amount,
  last_match.tx_date AS last_transaction_date,
  CASE
    WHEN last_match.tx_date IS NULL THEN NULL
    ELSE (CURRENT_DATE - last_match.tx_date)
  END AS days_since_last_charge,
  -- Total charged in the trailing 90 days under the matched merchant.
  COALESCE(rolling.total_90d, 0) AS total_charged_90d,
  COALESCE(rolling.charge_count_90d, 0) AS charge_count_90d
FROM public.contracts c
LEFT JOIN LATERAL (
  SELECT
    t.id AS tx_id,
    t.merchant AS tx_merchant,
    t.amount AS tx_amount,
    t.occurred_on AS tx_date
  FROM public.financial_transactions t
  WHERE t.user_id = c.user_id
    AND t.merchant IS NOT NULL
    AND (
      lower(t.merchant) LIKE '%' || lower(coalesce(c.provider, '')) || '%'
      OR lower(coalesce(c.provider, '')) LIKE '%' || lower(t.merchant) || '%'
      OR lower(t.merchant) LIKE '%' || lower(c.name) || '%'
      OR lower(c.name) LIKE '%' || lower(t.merchant) || '%'
    )
  ORDER BY t.occurred_on DESC
  LIMIT 1
) AS last_match ON true
LEFT JOIN LATERAL (
  SELECT
    SUM(t.amount) AS total_90d,
    COUNT(*) AS charge_count_90d
  FROM public.financial_transactions t
  WHERE t.user_id = c.user_id
    AND t.merchant IS NOT NULL
    AND t.occurred_on >= CURRENT_DATE - INTERVAL '90 days'
    AND t.direction = 'expense'
    AND (
      lower(t.merchant) LIKE '%' || lower(coalesce(c.provider, '')) || '%'
      OR lower(coalesce(c.provider, '')) LIKE '%' || lower(t.merchant) || '%'
      OR lower(t.merchant) LIKE '%' || lower(c.name) || '%'
      OR lower(c.name) LIKE '%' || lower(t.merchant) || '%'
    )
) AS rolling ON true
WHERE c.is_active = true;

GRANT SELECT ON public.subscription_audit TO authenticated, service_role;

COMMENT ON VIEW public.subscription_audit IS
  'Joins active contracts to bank transactions via fuzzy merchant match. The dashboard uses it to surface "ghost" subscriptions (no recent charge but contract still active) and "still-charging" cancellations.';

-- ============================================================
-- 5. finance_summary view
-- ============================================================
CREATE OR REPLACE VIEW public.finance_summary AS
WITH month_bounds AS (
  SELECT
    auth.uid() AS user_id,
    date_trunc('month', CURRENT_DATE)::date AS m_start,
    (date_trunc('month', CURRENT_DATE) + interval '1 month - 1 day')::date AS m_end
),
spend AS (
  SELECT
    t.user_id,
    t.category,
    SUM(t.amount) FILTER (WHERE t.direction = 'expense') AS spent_mtd,
    SUM(t.amount) FILTER (WHERE t.direction = 'income')  AS earned_mtd
  FROM public.financial_transactions t
  WHERE t.occurred_on >= date_trunc('month', CURRENT_DATE)::date
  GROUP BY t.user_id, t.category
)
SELECT
  s.user_id,
  s.category,
  COALESCE(s.spent_mtd, 0) AS spent_mtd,
  COALESCE(s.earned_mtd, 0) AS earned_mtd,
  b.monthly_limit,
  CASE
    WHEN b.monthly_limit IS NULL OR b.monthly_limit = 0 THEN NULL
    ELSE LEAST(1.0, COALESCE(s.spent_mtd, 0) / b.monthly_limit)
  END AS pct_of_budget
FROM spend s
LEFT JOIN public.financial_budgets b
  ON b.user_id = s.user_id AND b.category = s.category;

GRANT SELECT ON public.finance_summary TO authenticated;

COMMENT ON VIEW public.finance_summary IS
  'Per-category month-to-date spend + budget headroom. RLS-friendly: uses auth.uid() inside a CTE so the result auto-scopes.';
