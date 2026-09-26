-- mysql_schema.sql — 中科安樵经销商赋能培训系统 MySQL schema
-- 由 PG 迁移 001_init / 002_learning_profile / 003_audit / 004_exams / 005_scenario 等价转换
-- 执行目标：anqiao_wiki 库（MySQL 5.7，账号 anqiao_app）；可重复执行（IF NOT EXISTS / INSERT IGNORE）

CREATE TABLE IF NOT EXISTS users (
  id                   INT AUTO_INCREMENT PRIMARY KEY,
  username             VARCHAR(64)  NOT NULL UNIQUE,
  nickname             VARCHAR(64)  NULL UNIQUE,
  password_hash        VARCHAR(255) NOT NULL,
  role                 VARCHAR(32)  NOT NULL,
  name                 VARCHAR(64)  NOT NULL,
  realname             VARCHAR(64)  NOT NULL DEFAULT '',
  idcard               VARCHAR(32)  NOT NULL DEFAULT '',
  phone                VARCHAR(32)  NOT NULL DEFAULT '',
  must_change_password TINYINT(1)   NOT NULL DEFAULT 1,
  is_active            TINYINT(1)   NOT NULL DEFAULT 1,
  is_placeholder       TINYINT(1)   NOT NULL DEFAULT 0,
  created_at           DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_active_at       DATETIME     NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS modules (
  id      VARCHAR(8)   NOT NULL PRIMARY KEY,
  title   VARCHAR(128) NOT NULL,
  layer   VARCHAR(32)  NULL,
  ordinal INT          NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS module_access (
  module_id VARCHAR(8)  NOT NULL,
  role      VARCHAR(32) NOT NULL,
  access    VARCHAR(8)  NOT NULL,
  PRIMARY KEY (module_id, role),
  CONSTRAINT fk_ma_module FOREIGN KEY (module_id) REFERENCES modules(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS module_quiz_required (
  module_id VARCHAR(8)  NOT NULL,
  role      VARCHAR(32) NOT NULL,
  required  TINYINT(1)  NOT NULL,
  PRIMARY KEY (module_id, role),
  CONSTRAINT fk_mqr_module FOREIGN KEY (module_id) REFERENCES modules(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS quiz_questions (
  id        INT AUTO_INCREMENT PRIMARY KEY,
  module_id VARCHAR(8)  NOT NULL,
  ordinal   INT         NOT NULL,
  question  TEXT        NOT NULL,
  options   JSON        NOT NULL,
  answer    CHAR(1)     NOT NULL,
  KEY idx_quiz_questions_module (module_id, ordinal),
  CONSTRAINT fk_qq_module FOREIGN KEY (module_id) REFERENCES modules(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS course_views (
  user_id         INT        NOT NULL,
  module_id       VARCHAR(8) NOT NULL,
  first_viewed_at DATETIME   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_viewed_at  DATETIME   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  has_completed   TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, module_id),
  KEY idx_course_views_user (user_id),
  CONSTRAINT fk_cv_user FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS quiz_attempts (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  user_id    INT        NOT NULL,
  module_id  VARCHAR(8) NOT NULL,
  score      INT        NOT NULL,
  passed     TINYINT(1) NOT NULL,
  answers    JSON       NULL,
  created_at DATETIME   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_quiz_attempts_user (user_id, module_id),
  CONSTRAINT fk_qa_user FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sessions (
  id         CHAR(36)    NOT NULL PRIMARY KEY,
  user_id    INT         NOT NULL,
  created_at DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME    NOT NULL,
  ip         VARCHAR(64) NULL,
  KEY idx_sessions_user (user_id),
  KEY idx_sessions_expires (expires_at),
  CONSTRAINT fk_sess_user FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS login_attempts (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  ip         VARCHAR(64) NOT NULL,
  username   VARCHAR(64) NULL,
  created_at DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_login_attempts_ip_time (ip, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS audit_log (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  admin_id   INT         NULL,
  action     VARCHAR(32) NOT NULL,
  target     VARCHAR(64) NOT NULL,
  detail     TEXT        NOT NULL,
  created_at DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_audit_log_created (created_at),
  CONSTRAINT fk_audit_admin FOREIGN KEY (admin_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS exams (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  title            VARCHAR(128) NOT NULL,
  question_ids     JSON NOT NULL,
  duration_minutes INT  NOT NULL DEFAULT 30,
  passing_score    INT  NOT NULL DEFAULT 80,
  created_by       INT  NULL,
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  scenario_ids     JSON NULL,
  CONSTRAINT fk_exam_creator FOREIGN KEY (created_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS exam_attempts (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  exam_id          INT        NOT NULL,
  user_id          INT        NOT NULL,
  answers          JSON       NULL,
  correct_count    INT        NOT NULL DEFAULT 0,
  total_count      INT        NOT NULL DEFAULT 0,
  score            INT        NOT NULL DEFAULT 0,
  passed           TINYINT(1) NOT NULL DEFAULT 0,
  started_at       DATETIME   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  submitted_at     DATETIME   NULL,
  scenario_answers JSON       NULL,
  KEY idx_exam_attempts_exam (exam_id),
  KEY idx_exam_attempts_user (user_id),
  CONSTRAINT fk_ea_exam FOREIGN KEY (exam_id) REFERENCES exams(id),
  CONSTRAINT fk_ea_user FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS scenario_questions (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  scenario   VARCHAR(512) NOT NULL UNIQUE,
  hint       TEXT         NOT NULL,
  category   VARCHAR(32)  NOT NULL DEFAULT '客户挑战',
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 005 预置客户挑战性问答场景（可重复执行）
INSERT IGNORE INTO scenario_questions(scenario, hint, category) VALUES
  ('客户说“你们卖的太贵了，隔壁便宜一半。”你如何回应？',
   '回应要点：价值锚定（24 个月只换不修/9 项专利/二类器械/跌倒 99.8%）；对比人工看护成本；不贬低竞品；可申请价格审批但不擅自破价。', '客户挑战'),
  ('我是经销商，如果我不做你们代理了，我的货能退回来吗？',
   '回应要点：渠道政策以协议为准；退换货/库存处理按《经销协议》与退出清算流程执行；不承诺协议外事项，转交商务对接。', '客户挑战'),
  ('客户问“设备坏了怎么修？质保多久？会不会很久？”',
   '回应要点：24 个月质保只换不修（非人为）；换新流程 报障→登记→确认→寄回→换新；安全关键设备可申请备用机；质保内不收费。', '客户挑战'),
  ('客户担心“装了这个会不会泄露我爸的隐私？”',
   '回应要点：不成像不拍摄、零摄像头零麦克风；仅雷达点云；本地加密、传输加密；符合《个人信息保护法》；物业只收应急告警。', '客户挑战'),
  ('机构说“我们已经有监控了，为什么还要你们的设备？”',
   '回应要点：监控看画面、满足不了体征与跌倒识别；毫米波补充夜间/隐私区域；可叠加不冲突；输出照护数据与告警闭环。', '客户挑战'),
  ('客户问“买回去不会用怎么办？老人会用吗？”',
   '回应要点：无感免操作、开机即用；APP 由家属操作；提供安装指导与培训；7×24 热线；质保期内售后无忧。', '客户挑战'),
  ('客户质疑“你怎么证明你们的跌倒监测靠谱？”',
   '回应要点：跌倒识别准确率 99.8%；9 项专利二类器械；可现场演示/试点；告警链路多重（声光+APP+电话）不脱节。', '客户挑战'),
  ('客户问“设备离线了还能监测吗？断网怎么办？”',
   '回应要点：边缘计算本地判定不依赖网络；断网本地缓存、恢复后同步；双通道告警补漏；安装前确认网络与供电。', '客户挑战');
