-- Add all new profile columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS business_email text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS country text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS service_areas text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS availability text DEFAULT 'available';
ALTER TABLE users ADD COLUMN IF NOT EXISTS portfolio jsonb DEFAULT '[]'::jsonb;
ALTER TABLE users ADD COLUMN IF NOT EXISTS verified boolean DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_status text DEFAULT 'unverified';
ALTER TABLE users ADD COLUMN IF NOT EXISTS company_name text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS license_number text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS years_experience integer;
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS logo_url text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS website text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avg_rating numeric(3,2) DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS review_count integer DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS services jsonb DEFAULT '[]'::jsonb;

-- Confirm columns exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'users' 
AND column_name IN (
  'business_email','address','country','service_areas',
  'availability','portfolio','verified','verification_status',
  'company_name','license_number','years_experience','bio',
  'logo_url','website','avg_rating','review_count','services'
)
ORDER BY column_name;
