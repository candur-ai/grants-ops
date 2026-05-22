-- Grants-Ops Initial Schema
-- Run this in your Supabase SQL editor to set up the database

-- Organizations (one per user, expandable to teams later)
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  legal_name TEXT NOT NULL,
  ein TEXT DEFAULT '',
  uei TEXT DEFAULT '',
  entity_type TEXT NOT NULL DEFAULT 'nonprofit_501c3',
  address JSONB DEFAULT '{}',
  founded_year INT,
  staff_size INT DEFAULT 0,
  annual_budget NUMERIC DEFAULT 0,
  sam_registration JSONB DEFAULT '{"status": "not_registered"}',
  contacts JSONB DEFAULT '{}',
  target_grants JSONB DEFAULT '{"focus_areas": [], "eligible_categories": [], "preferred_agencies": []}',
  compliance JSONB DEFAULT '{}',
  budget_defaults JSONB DEFAULT '{"escalation_rate": 3, "equipment_threshold": 5000, "fringe_rate": 30, "travel_per_diem": {"domestic": 200, "lodging": 150}}',
  narrative JSONB DEFAULT '{"mission": "", "differentiator": ""}',
  past_performance JSONB DEFAULT '[]',
  discovery JSONB DEFAULT '{"scan_interval_days": 7}',
  profile_md TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Applications tracker
CREATE TABLE applications (
  id SERIAL PRIMARY KEY,
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  entry_num INT NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  agency TEXT NOT NULL,
  program TEXT NOT NULL,
  opportunity_id TEXT NOT NULL,
  score NUMERIC(3,1),
  status TEXT NOT NULL DEFAULT 'Discovered',
  deadline DATE,
  report_id INT,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, opportunity_id)
);

-- Pipeline
CREATE TABLE pipeline (
  id SERIAL PRIMARY KEY,
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  url TEXT NOT NULL,
  opportunity_id TEXT NOT NULL,
  agency TEXT DEFAULT '',
  title TEXT DEFAULT '',
  deadline DATE,
  award_ceiling NUMERIC,
  status TEXT DEFAULT 'pending',
  added_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, opportunity_id)
);

-- Scan history
CREATE TABLE scan_history (
  id SERIAL PRIMARY KEY,
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  opportunity_id TEXT NOT NULL,
  scanned_at DATE DEFAULT CURRENT_DATE,
  agency TEXT DEFAULT '',
  title TEXT DEFAULT '',
  deadline DATE,
  award_ceiling NUMERIC,
  status TEXT DEFAULT 'new',
  UNIQUE(org_id, opportunity_id)
);

-- Evaluation reports
CREATE TABLE reports (
  id SERIAL PRIMARY KEY,
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  entry_num INT NOT NULL,
  agency TEXT NOT NULL,
  program TEXT NOT NULL,
  opportunity_id TEXT NOT NULL,
  score NUMERIC(3,1),
  url TEXT DEFAULT '',
  category TEXT DEFAULT '',
  deadline DATE,
  funding_floor NUMERIC,
  funding_ceiling NUMERIC,
  status TEXT NOT NULL DEFAULT 'Evaluated',
  body_md TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, opportunity_id)
);

-- Add FK from applications to reports
ALTER TABLE applications
  ADD CONSTRAINT fk_applications_report
  FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE SET NULL;

-- Row Level Security
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE scan_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "users_own_org" ON organizations
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "users_own_applications" ON applications
  FOR ALL USING (org_id IN (SELECT id FROM organizations WHERE user_id = auth.uid()));

CREATE POLICY "users_own_pipeline" ON pipeline
  FOR ALL USING (org_id IN (SELECT id FROM organizations WHERE user_id = auth.uid()));

CREATE POLICY "users_own_scan_history" ON scan_history
  FOR ALL USING (org_id IN (SELECT id FROM organizations WHERE user_id = auth.uid()));

CREATE POLICY "users_own_reports" ON reports
  FOR ALL USING (org_id IN (SELECT id FROM organizations WHERE user_id = auth.uid()));

-- Helper: auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER applications_updated_at
  BEFORE UPDATE ON applications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
