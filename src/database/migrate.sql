-- ===== AI CV Screening Assistant - Database Schema =====
-- Run this in Supabase SQL Editor (https://supabase.com/dashboard/project/tpnfnlgbmabrygboqmir/sql/new)

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. Candidates
-- ============================================
CREATE TABLE IF NOT EXISTS candidates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  cv_file_url TEXT,
  cv_raw_text TEXT,
  source TEXT NOT NULL DEFAULT 'upload'
    CHECK (source IN ('tally', 'upload', 'email', 'zalo', 'facebook', 'messenger', 'platform')),
  source_meta JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_candidates_email ON candidates(email);
CREATE INDEX IF NOT EXISTS idx_candidates_created_at ON candidates(created_at DESC);

-- ============================================
-- 2. Jobs (Job Descriptions)
-- ============================================
CREATE TABLE IF NOT EXISTS jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  department TEXT,
  description TEXT NOT NULL,
  requirements TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_jobs_active ON jobs(is_active) WHERE is_active = TRUE;

-- ============================================
-- 3. Applications
-- ============================================
DO $$ BEGIN
  CREATE TYPE application_status AS ENUM (
    'new', 'screening', 'screened', 'shortlisted',
    'interview', 'offered', 'hired', 'rejected', 'withdrawn'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS applications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  status application_status NOT NULL DEFAULT 'new',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(candidate_id, job_id)
);

CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status);
CREATE INDEX IF NOT EXISTS idx_applications_job ON applications(job_id);
CREATE INDEX IF NOT EXISTS idx_applications_candidate ON applications(candidate_id);

-- ============================================
-- 4. Screening Results
-- ============================================
CREATE TABLE IF NOT EXISTS screenings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  ai_provider TEXT NOT NULL DEFAULT 'gemini',
  recommendation TEXT NOT NULL
    CHECK (recommendation IN ('interview', 'shortlist', 'review', 'reject')),
  score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
  summary TEXT,
  strengths TEXT[] DEFAULT '{}',
  weaknesses TEXT[] DEFAULT '{}',
  risks TEXT[] DEFAULT '{}',
  skills_match JSONB DEFAULT '{}',
  raw_output TEXT,
  processing_time_ms INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_screenings_application ON screenings(application_id);
CREATE INDEX IF NOT EXISTS idx_screenings_score ON screenings(score DESC);

-- ============================================
-- 5. Notifications
-- ============================================
DO $$ BEGIN
  CREATE TYPE notification_channel AS ENUM ('telegram', 'email');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE notification_status AS ENUM ('pending', 'sent', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  channel notification_channel NOT NULL,
  to_address TEXT NOT NULL,
  subject TEXT,
  body TEXT NOT NULL,
  status notification_status NOT NULL DEFAULT 'pending',
  error TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(status);
CREATE INDEX IF NOT EXISTS idx_notifications_application ON notifications(application_id);

-- ============================================
-- 6. Users (HR staff)
-- ============================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'hr' CHECK (role IN ('admin', 'hr')),
  telegram_chat_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- Triggers: auto-update updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'candidates_updated_at') THEN
    CREATE TRIGGER candidates_updated_at BEFORE UPDATE ON candidates
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'jobs_updated_at') THEN
    CREATE TRIGGER jobs_updated_at BEFORE UPDATE ON jobs
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'applications_updated_at') THEN
    CREATE TRIGGER applications_updated_at BEFORE UPDATE ON applications
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END;
$$;

-- ============================================
-- Row Level Security (Open for MVP)
-- ============================================
ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE screenings ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Allow anon access for MVP (will tighten later)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'anon_read_candidates') THEN
    CREATE POLICY anon_read_candidates ON candidates FOR SELECT USING (true);
    CREATE POLICY anon_insert_candidates ON candidates FOR INSERT WITH CHECK (true);
    CREATE POLICY anon_update_candidates ON candidates FOR UPDATE USING (true);
    CREATE POLICY anon_read_jobs ON jobs FOR SELECT USING (true);
    CREATE POLICY anon_insert_jobs ON jobs FOR INSERT WITH CHECK (true);
    CREATE POLICY anon_read_applications ON applications FOR SELECT USING (true);
    CREATE POLICY anon_insert_applications ON applications FOR INSERT WITH CHECK (true);
    CREATE POLICY anon_update_applications ON applications FOR UPDATE USING (true);
    CREATE POLICY anon_read_screenings ON screenings FOR SELECT USING (true);
    CREATE POLICY anon_insert_screenings ON screenings FOR INSERT WITH CHECK (true);
    CREATE POLICY anon_read_notifications ON notifications FOR SELECT USING (true);
    CREATE POLICY anon_insert_notifications ON notifications FOR INSERT WITH CHECK (true);
  END IF;
END;
$$;

-- ============================================
-- Seed Demo Data
-- ============================================
INSERT INTO jobs (title, department, description, requirements) VALUES
(
  'Nhân viên pha chế (Barista)',
  'F&B',
  'Chúng tôi đang tìm kiếm một Barista có kinh nghiệm cho quán cà phê. Bạn sẽ phụ trách pha chế đồ uống, vệ sinh khu vực làm việc, và hỗ trợ quản lý nguyên liệu.',
  '- Có kinh nghiệm pha chế cà phê 1-2 năm\n- Kỹ năng giao tiếp tốt\n- Trung thực, chăm chỉ\n- Ưu tiên biết tiếng Anh cơ bản'
),
(
  'Nhân viên phục vụ',
  'F&B',
  'Chào đón và phục vụ khách hàng, nhận order, phối hợp với barista để đảm bảo trải nghiệm khách hàng tốt nhất.',
  '- Nhanh nhẹn, thân thiện\n- Kinh nghiệm phục vụ 6 tháng+\n- Có thể làm việc theo ca'
),
(
  'Quản lý cửa hàng',
  'F&B',
  'Quản lý vận hành hàng ngày, đào tạo nhân viên, kiểm soát chi phí, báo cáo doanh thu.',
  '- 2-3 năm kinh nghiệm quản lý F&B\n- Kỹ năng leadership\n- Biết sử dụng POS/Excel'
)
ON CONFLICT DO NOTHING;
