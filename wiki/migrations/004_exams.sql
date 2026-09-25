-- 004_exams.sql — 新人培训考试（管理员随机组卷 + 成绩单；完整版考试功能）
create table if not exists exams (
  id               serial primary key,
  title            text not null,                 -- 如：新人第 3 天正式考试
  question_ids     jsonb not null,                -- 随机抽取的题目 id 数组（服务端仅存 id）
  duration_minutes int  not null default 30,
  passing_score    int  not null default 80,
  created_by       int  references users(id),
  created_at       timestamptz not null default now()
);

create table if not exists exam_attempts (
  id             serial primary key,
  exam_id        int  not null references exams(id),
  user_id        int  not null references users(id),
  answers        jsonb,                            -- {qid: "A"}，判分后留存（仅服务端）
  correct_count  int  not null default 0,
  total_count    int  not null default 0,
  score          int  not null default 0,          -- 0..100
  passed         boolean not null default false,   -- score >= passing_score
  started_at     timestamptz not null default now(),
  submitted_at   timestamptz
);

create index if not exists idx_exam_attempts_exam on exam_attempts(exam_id);
create index if not exists idx_exam_attempts_user on exam_attempts(user_id);
