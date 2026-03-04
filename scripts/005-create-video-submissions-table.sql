CREATE TABLE IF NOT EXISTS video_submissions (
  id SERIAL PRIMARY KEY,
  video_url TEXT NOT NULL,
  character_image_url TEXT,
  character_name TEXT,
  user_id TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW()
);
