import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";
import cors from "cors";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = 3333;

/* ---------- security & perf ---------- */
app.use(helmet());
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({ origin: "*" }));
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Gunakan IP asli dari req.ip yang sudah diperiksa express
    return req.ip;
  }
}));

/* ---------- trust proxy (CDN / vercel) ---------- */
app.set("trust proxy", true);
if (process.env.TRUST_PROXY === "true") {
  app.set("trust proxy", true);
}


/* ---------- static ---------- */
app.use(express.static(path.join(__dirname, "public")));

/* ---------- helpers ---------- */
const DATA_DIR = path.join(__dirname, "data");
const VIS_PATH = path.join(DATA_DIR, "visitors.json");

/* pastikan data dir & file ada */
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
if (!fs.existsSync(VIS_PATH)) fs.writeFileSync(VIS_PATH, "[]", "utf-8");

function readVisitors() {
  return JSON.parse(fs.readFileSync(VIS_PATH, "utf-8"));
}
function writeVisitors(data) {
  fs.writeFileSync(VIS_PATH, JSON.stringify(data, null, 2));
}

/* ---------- POST /api/visit ---------- */
app.post("/api/visit", (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: "name required" });

  const ip = req.ip; // sudah trust proxy
  const now = new Date().toISOString();

  let visitors = readVisitors();
  const existing = visitors.find(v => v.ip === ip);

  if (existing) {
    const wasSameName = existing.name === name;
    existing.name = name;
    existing.timestamp = now;
    writeVisitors(visitors);

    if (wasSameName) {
      console.log(`[Berkunjung Kembali] ${ip} → "${name}"`);
    } else {
      console.log(`[VISIT] ${ip} → "${name}"`);
    }
  } else {
    visitors.push({ ip, name, timestamp: now });
    writeVisitors(visitors);
    console.log(`[VISIT] ${ip} → "${name}"`);
  }

  res.json({ ok: true });
});

/* ---------- GET /api/whoami ---------- */
app.get("/api/whoami", (req, res) => {
  const ip = req.ip;
  const visitors = readVisitors();
  const user = visitors.find(v => v.ip === ip);
  res.json({ name: user?.name || null });
});

/* ---------- fallback ---------- */
app.post("/", (_, res) => res.json({ message: "POST request berhasil" }));

app.listen(PORT, () =>
  console.log(`Server berjalan di http://localhost:${PORT}`)
);