const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: {
    rejectUnauthorized: false  // Supabase용
  }
});

// 연결 테스트 - Render에서 오류 잡기 위해 필요
pool.connect()
  .then(() => console.log("✅ PostgreSQL 연결 성공"))
  .catch(err => {
    console.error("❌ PostgreSQL 연결 실패:", err);
    process.exit(1);  // 실패하면 서버 실행 중단 (502 방지)
  });

module.exports = pool;
