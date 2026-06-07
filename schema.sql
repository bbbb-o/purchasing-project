-- 采购询价系统 - 数据库建表语句
-- 使用方法：wrangler d1 execute purchasing-db --file=./schema.sql

DROP TABLE IF EXISTS inquiries;

CREATE TABLE IF NOT EXISTS inquiries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  xj_no TEXT NOT NULL UNIQUE,
  supplier TEXT NOT NULL,
  goods TEXT NOT NULL,
  num REAL,
  price REAL,
  total_price REAL,
  ask_date TEXT NOT NULL,
  remark TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- 附件表（存储 Base64 编码的小文件，建议 < 1MB）
CREATE TABLE IF NOT EXISTS attachments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fid TEXT NOT NULL UNIQUE,
  inquiry_id INTEGER NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_data TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (inquiry_id) REFERENCES inquiries(id) ON DELETE CASCADE
);
