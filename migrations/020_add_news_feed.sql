-- Migration: Add News Feed Tables
-- Description: Company news feed - posts, likes, comments for employee engagement

-- Company Posts (Компанийн мэдээлэл)
CREATE TABLE IF NOT EXISTS company_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  post_type TEXT NOT NULL DEFAULT 'announcement', -- 'announcement', 'birthday', 'achievement', 'event'
  images TEXT[], -- Array of image URLs
  likes_count INTEGER NOT NULL DEFAULT 0,
  comments_count INTEGER NOT NULL DEFAULT 0,
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_company_posts_tenant ON company_posts(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_company_posts_author ON company_posts(tenant_id, author_id);
CREATE INDEX IF NOT EXISTS idx_company_posts_type ON company_posts(post_type);
CREATE INDEX IF NOT EXISTS idx_company_posts_pinned ON company_posts(tenant_id, is_pinned DESC, created_at DESC);

COMMENT ON TABLE company_posts IS 'Company news feed posts';
COMMENT ON COLUMN company_posts.post_type IS 'Type: announcement, birthday, achievement, event';
COMMENT ON COLUMN company_posts.images IS 'Array of image URLs attached to post';

-- Post Likes (Харилцан сэтгэл хөдлөл)
CREATE TABLE IF NOT EXISTS post_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES company_posts(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, post_id, employee_id)
);

CREATE INDEX IF NOT EXISTS idx_post_likes_post ON post_likes(post_id);
CREATE INDEX IF NOT EXISTS idx_post_likes_employee ON post_likes(employee_id);

COMMENT ON TABLE post_likes IS 'Post likes by employees';

-- Post Comments (Сэтгэгдэл)
CREATE TABLE IF NOT EXISTS post_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES company_posts(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_post_comments_post ON post_comments(post_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_post_comments_employee ON post_comments(employee_id);

COMMENT ON TABLE post_comments IS 'Comments on posts';
