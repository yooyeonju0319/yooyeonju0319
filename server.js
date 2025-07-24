// .env 파일의 환경 변수를 로드합니다. (이 코드가 반드시 맨 위에 있어야 합니다)
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const mysql = require("mysql2/promise");

const app = express();
const PORT = process.env.PORT || 4000;

// --- MySQL 연결 ---
let db;
async function connectDB() {
  try {
    db = await mysql.createConnection({
      host: process.env.MYSQL_HOST || 'localhost',
      user: process.env.MYSQL_USER || 'root',
      password: process.env.MYSQL_PASSWORD || '',
      database: process.env.MYSQL_DB || 'photoGallery',
    });
    console.log("✅ MySQL에 성공적으로 연결되었습니다.");
  } catch (error) {
    console.error("MySQL 연결 실패:", error);
    process.exit(1);
  }
}
connectDB();

// --- 미들웨어 설정 ---
app.use(cors());
app.use(express.json());

const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);
app.use("/uploads", express.static(uploadsDir));

// --- 파일 업로드 설정 ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dest = path.join(uploadsDir, file.fieldname);
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    cb(null, dest);
  },
  filename: (req, file, cb) => {
    const name = Date.now() + '-' + file.originalname.toLowerCase();
    cb(null, name);
  },
});
const upload = multer({ storage: storage });

// --- API 라우트 ---

// 회원가입
app.post("/api/signup", async (req, res) => {
  try {
    const { username, password, question, answer } = req.body;
    const [rows] = await db.execute("SELECT * FROM users WHERE username = ?", [username]);
    if (rows.length > 0) {
      return res.status(400).json({ message: "이미 존재하는 아이디입니다." });
    }
    const profilePic = `https://placehold.co/192x192/EFEFEF/3A3A3A?text=${username.charAt(0)}`;
    await db.execute(
      "INSERT INTO users (username, password, question, answer, profilePic) VALUES (?, ?, ?, ?, ?)",
      [username, password, question, answer, profilePic]
    );
    res.status(201).json({ message: "회원가입 성공!" });
  } catch (error) {
    res.status(500).json({ message: "서버 오류가 발생했습니다." });
  }
});

// 로그인
app.post("/api/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    const [rows] = await db.execute("SELECT * FROM users WHERE username = ?", [username]);
    const user = rows[0];
    if (!user || user.password !== password) {
      if (user) {
        return res.status(401).json({
          needsRecovery: true,
          question: user.question,
          message: "비밀번호가 틀렸습니다.",
        });
      }
      return res.status(401).json({ message: "아이디 또는 비밀번호가 올바르지 않습니다." });
    }
    const { password: _, question, answer, ...userData } = user;
    res.status(200).json({ message: "로그인 성공!", user: userData });
  } catch (error) {
    res.status(500).json({ message: "서버 오류" });
  }
});

// 비밀번호 찾기
app.post("/api/login/recover", async (req, res) => {
  try {
    const { username, answer } = req.body;
    const [rows] = await db.execute("SELECT * FROM users WHERE username = ? AND answer = ?", [username, answer]);
    const user = rows[0];
    if (!user) return res.status(401).json({ message: "답변이 올바르지 않습니다." });
    const { password, question, answer: ans, ...userData } = user;
    res.status(200).json({ message: "로그인 성공!", user: userData });
  } catch (error) {
    res.status(500).json({ message: "서버 오류" });
  }
});

// 모든 사진 가져오기
app.get("/api/photos", async (req, res) => {
  try {
    const [photos] = await db.execute("SELECT * FROM photos ORDER BY id DESC");
    res.status(200).json(photos);
  } catch (error) {
    res.status(500).json({ message: "사진을 불러오지 못했습니다." });
  }
});

// 사진 업로드
app.post("/api/photos/upload", upload.single("photo"), async (req, res) => {
  try {
    console.log("🔥 파일 정보:", req.file);
    console.log("🔥 업로드 요청 body:", req.body);

    const { uploader, title, tags, description } = req.body;
    if (!req.file) return res.status(400).json({ message: "사진 파일이 필요합니다." });

    const url = `/uploads/photo/${req.file.filename}`;
    console.log("🔥 저장할 URL:", url);

    await db.execute(
      "INSERT INTO photos (uploader, url, title, tags, description, likes) VALUES (?, ?, ?, ?, ?, ?)",
      [uploader, url, title, tags, description, JSON.stringify([])]
    );

    const [photoRow] = await db.execute("SELECT * FROM photos WHERE url = ?", [url]);
    console.log("✅ DB 저장 완료!");

    res.status(201).json({ message: "사진이 업로드되었습니다.", photo: photoRow[0] });
  } catch (error) {
    console.error("❌ 업로드 실패:", error);
    res.status(500).json({ message: "업로드 실패" });
  }
});

app.listen(PORT, () => {
  console.log(`✅ 백엔드 서버가 포트 ${PORT}에서 실행 중입니다.`);
});
