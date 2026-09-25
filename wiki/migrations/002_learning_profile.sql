-- 002_learning_profile.sql — 认证档案化 + 占位账号标识
-- 背景：三组差异化（管理/外部/内部）+ 档案化学习记录（见 docs/cert-design.md）

alter table users add column if not exists is_placeholder boolean not null default false;
alter table course_views add column if not exists has_completed boolean not null default false;
