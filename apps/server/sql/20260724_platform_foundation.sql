-- 三元课堂 SaaS 化第一阶段：平台配置、用户关联字段、学情回流 outbox。
-- 当前代码优先使用 apps/server/config/platform-config.json 兜底；生产库启用持久化时再执行本脚本。

-- users 表的列名沿用既有驼峰风格（studentNo / classId / isActive），与 TypeORM 默认命名策略一致，
-- 否则 DB_SYNCHRONIZE=true 时会再建一份驼峰列。
ALTER TABLE users
  ADD COLUMN tenantId varchar(64) NULL COMMENT '租户/集团 ID',
  ADD COLUMN schoolId varchar(64) NULL COMMENT '学校 ID',
  ADD COLUMN authIssuer varchar(255) NULL COMMENT '签发中央身份的认证中心',
  ADD COLUMN membershipId varchar(128) NULL COMMENT 'iam_membership.membership_id，用户在某租户/学校下的身份',
  ADD COLUMN externalUserId varchar(128) NULL COMMENT '中央统一身份 ID（令牌的 sub），跨校时相同，只作追溯参考',
  ADD COLUMN phone varchar(32) NULL COMMENT '手机号，统一登录首次归并时的辅助匹配字段',
  ADD COLUMN email varchar(128) NULL COMMENT '邮箱';

-- 永久登录身份是 (issuer, membershipId)，不是 sub：同一自然人跨校任课会有多个 membership，
-- 按 sub 建唯一约束会把两个学校身份并成一个账号。MySQL 唯一索引允许多行 NULL，不影响本地账号。
CREATE UNIQUE INDEX uk_users_membership ON users (authIssuer, membershipId);
CREATE INDEX idx_users_external_user ON users (externalUserId);
CREATE INDEX idx_users_school_phone ON users (tenantId, schoolId, phone);

CREATE TABLE IF NOT EXISTS platform_school_config (
  id bigint PRIMARY KEY AUTO_INCREMENT,
  tenant_id varchar(64) NOT NULL,
  school_id varchar(64) NOT NULL,
  school_name varchar(128) NOT NULL,
  product_code varchar(64) NOT NULL DEFAULT 'sanyuan-classroom',
  product_name varchar(128) NOT NULL DEFAULT '三元课堂',
  branding_json json NULL,
  features_json json NULL,
  model_json json NULL,
  data_sources_json json NULL,
  question_bank_json json NULL,
  learning_record_sink_json json NULL,
  enabled tinyint(1) NOT NULL DEFAULT 1,
  created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_platform_school_config (tenant_id, school_id, product_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='学校级产品运行配置';

CREATE TABLE IF NOT EXISTS platform_learning_record_outbox (
  id varchar(64) PRIMARY KEY,
  tenant_id varchar(64) NOT NULL,
  school_id varchar(64) NOT NULL,
  product_code varchar(64) NOT NULL DEFAULT 'sanyuan-classroom',
  event_type varchar(64) NOT NULL,
  occurred_at datetime NOT NULL,
  status varchar(32) NOT NULL DEFAULT 'queued',
  attempts int NOT NULL DEFAULT 0,
  last_error varchar(1000) NULL,
  payload_json json NOT NULL,
  created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_learning_record_school_status (tenant_id, school_id, status, occurred_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='学情回流 outbox';
