-- 001_init.sql — 中科安樵经销商赋能培训系统初始 schema（SPEC §5 权威 + D13 昵称扩展）

create extension if not exists pgcrypto;

-- 会话表先建（sessions 依赖 users，见下；此处仅先建 users 依赖无循环）

create table if not exists users (
  id                    serial primary key,
  username              text unique not null,
  nickname              text unique,            -- D13：昵称，可空，唯一；可用于登录
  password_hash         text not null,          -- argon2id
  role                  text not null,          -- admin|internal_sales|internal_tech|internal_ops|dealer|agent|reseller
  name                  text not null,
  realname              text not null default '',
  idcard                text not null default '',
  phone                 text not null default '',
  must_change_password  boolean not null default true,
  is_active             boolean not null default true,
  created_at            timestamptz not null default now(),
  last_active_at        timestamptz
);

create table if not exists modules (
  id      text primary key,        -- M01..M16
  title   text not null,
  layer   text,
  ordinal int  not null
);

create table if not exists module_access (
  module_id text not null references modules(id),
  role      text not null,
  access    text not null,         -- 'req' | 'opt' | 'na'
  primary key (module_id, role)
);

create table if not exists module_quiz_required (
  module_id text not null references modules(id),
  role      text not null,
  required  boolean not null,
  primary key (module_id, role)
);

create table if not exists quiz_questions (
  id        serial primary key,
  module_id text not null references modules(id),
  ordinal   int  not null,
  question  text not null,
  options   jsonb not null,
  answer    text not null          -- 'A'|'B'|'C'|'D'；绝不下发客户端
);

create table if not exists course_views (
  user_id         int  not null references users(id),
  module_id       text not null references modules(id),
  first_viewed_at timestamptz not null default now(),
  last_viewed_at  timestamptz not null default now(),
  primary key (user_id, module_id)
);

create table if not exists quiz_attempts (
  id         serial primary key,
  user_id    int  not null references users(id),
  module_id  text not null references modules(id),
  score      int  not null,         -- 0..100
  passed     boolean not null,      -- score >= 80
  answers    jsonb,
  created_at timestamptz not null default now()
);

create table if not exists sessions (
  id         uuid primary key default gen_random_uuid(),
  user_id    int not null references users(id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  ip         text
);

create table if not exists login_attempts (
  id         serial primary key,
  ip         text not null,
  username   text,
  created_at timestamptz not null default now()
);

-- 常用索引
create index if not exists idx_quiz_questions_module on quiz_questions(module_id, ordinal);
create index if not exists idx_course_views_user on course_views(user_id);
create index if not exists idx_quiz_attempts_user on quiz_attempts(user_id, module_id);
create index if not exists idx_sessions_user on sessions(user_id);
create index if not exists idx_sessions_expires on sessions(expires_at);
create index if not exists idx_login_attempts_ip_time on login_attempts(ip, created_at);
