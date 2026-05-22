-- Persist generated application packets so the Apply page can reload drafts

CREATE TABLE IF NOT EXISTS application_packets (
  id SERIAL PRIMARY KEY,
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  report_id INT REFERENCES reports(id) ON DELETE CASCADE,
  opportunity_id TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  sections JSONB NOT NULL DEFAULT '[]',
  budget JSONB,
  markdown TEXT NOT NULL DEFAULT '',
  html TEXT NOT NULL DEFAULT '',
  bucket TEXT NOT NULL DEFAULT 'application-packets',
  markdown_path TEXT NOT NULL DEFAULT '',
  google_docs_path TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_application_packets_org_report
  ON application_packets(org_id, report_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_application_packets_org_opportunity
  ON application_packets(org_id, opportunity_id, created_at DESC);

ALTER TABLE application_packets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_own_application_packets" ON application_packets;
CREATE POLICY "users_own_application_packets" ON application_packets
  FOR ALL USING (org_id IN (SELECT id FROM organizations WHERE user_id = auth.uid()));

DROP TRIGGER IF EXISTS application_packets_updated_at ON application_packets;
CREATE TRIGGER application_packets_updated_at
  BEFORE UPDATE ON application_packets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
