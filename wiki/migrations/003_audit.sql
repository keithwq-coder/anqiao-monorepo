-- 003_audit.sql — 操作审计（建号 / 重置密码 / 改密留痕，T-F）
create table if not exists audit_log (
  id         serial primary key,
  admin_id   int references users(id), -- NULL = 用户自助操作（self_change）
  action     text not null,            -- create_user | reset_password | self_change
  target     text not null,            -- 目标用户名
  detail     text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_log_created on audit_log(created_at desc);
