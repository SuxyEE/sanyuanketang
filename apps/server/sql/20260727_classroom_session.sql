-- Phase 2 Step 2：课堂会话与名单落库。
-- 列名用驼峰，与库内既有风格和 TypeORM 默认命名策略一致。
-- DB_SYNCHRONIZE=true 时 TypeORM 会自动建表，本脚本供 synchronize=false 的生产库使用。

CREATE TABLE IF NOT EXISTS classroom_sessions (
  id varchar(36) PRIMARY KEY,
  roomId varchar(64) NOT NULL COMMENT '网关房间码，不是 lessons.id',
  tenantId varchar(64) NULL,
  schoolId varchar(64) NULL,
  classId varchar(64) NULL,
  className varchar(100) NULL,
  subject varchar(100) NULL,
  courseName varchar(200) NULL,
  lessonTitle varchar(200) NULL,
  startedAt datetime NOT NULL,
  endedAt datetime NULL,
  status varchar(32) NOT NULL DEFAULT 'ongoing',
  memberPeak int NOT NULL DEFAULT 0 COMMENT '全场在线人数峰值，到课率的分母参考',
  studentPeak int NOT NULL DEFAULT 0,
  createdAt datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_session_room_status (roomId, status),
  KEY idx_session_school_time (tenantId, schoolId, startedAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='一次开课的运行实例';

CREATE TABLE IF NOT EXISTS classroom_session_members (
  id varchar(36) PRIMARY KEY,
  sessionId varchar(36) NOT NULL,
  userId varchar(64) NOT NULL,
  userName varchar(100) NULL,
  role varchar(20) NOT NULL,
  clientType varchar(40) NULL,
  tenantId varchar(64) NULL,
  schoolId varchar(64) NULL,
  classId varchar(64) NULL,
  externalUserId varchar(128) NULL,
  firstJoinedAt datetime NOT NULL,
  lastJoinedAt datetime NOT NULL,
  lastLeftAt datetime NULL,
  joinCount int NOT NULL DEFAULT 1 COMMENT '进入次数，大于 1 说明中途掉线过',
  createdAt datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  -- 断线重连、多端登录都只更新同一行，避免把到课率算高
  UNIQUE KEY uq_session_member (sessionId, userId),
  KEY idx_session_member_session (sessionId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='课堂名单与进出记录';
