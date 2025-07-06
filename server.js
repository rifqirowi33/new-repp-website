/* =========================================================
   server.js – geolocation ipwho.is + coords + Google Maps
   ========================================================= */
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";
import cors from "cors";
import { UAParser } from "ua-parser-js";

/* --- Bun & Node18 sudah punya fetch global --- */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app  = express();
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
  keyGenerator: req => req.ip        // trust‑proxy di bawah
}));

/* ---------- trust proxy (Cloudflare / vercel) ---------- */
app.set("trust proxy", true);

app.use((req, res, next) => {
  // Jangan cache file JavaScript dan HTML
  if (req.url.endsWith(".js") || req.url.endsWith(".html")) {
    res.setHeader("Cache-Control", "no-store");
  }
  next();
});

/* ---------- static ---------- */
app.use(express.static(path.join(__dirname, "public")));

/* ---------- helpers ---------- */
const DATA_DIR = path.join(__dirname, "data");
const VIS_PATH = path.join(DATA_DIR, "visitors.json");
if (!fs.existsSync(DATA_DIR))  fs.mkdirSync(DATA_DIR);
if (!fs.existsSync(VIS_PATH)) fs.writeFileSync(VIS_PATH, "[]", "utf-8");

const readVisitors  = () => JSON.parse(fs.readFileSync(VIS_PATH, "utf-8"));
const writeVisitors = data => fs.writeFileSync(VIS_PATH, JSON.stringify(data, null, 2));

/* =========================================================
   POST /api/visit
   ========================================================= */
app.post("/api/visit", async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: "name required" });

  const ip  = req.ip;                          // sudah “trust proxy”
  const ua  = req.headers["user-agent"] || "";
  const now = new Date().toISOString();

  /* --- user‑agent summary --- */
  const parser  = new UAParser(ua);
  const browser = parser.getBrowser().name  || "Unknown";
  const os      = parser.getOS().name       || "Unknown";
  const device  = parser.getDevice().type   || "desktop";

  /* --- geolocation via ipwho.is (tanpa API‑key) --- */
  let location = "Unknown", coords = "", maps = "";
  try {
    const geo = await fetch(`https://ipwho.is/${ip}`).then(r => r.json());
    if (geo && geo.success) {
      location = `${geo.city}, ${geo.region}, ${geo.country}`;
      coords   = `${geo.latitude},${geo.longitude}`;
      maps     = `https://www.google.com/maps?q=${coords}`;
    }
  } catch {
    console.warn("ipwho.is gagal:", ip);
  }

  /* --- simpan ke visitors.json --- */
  const visitors    = readVisitors();
const existingIdx = visitors.findIndex(v => v.ip === ip); // ✅ ini yang tadinya belum ada
const existing = visitors[existingIdx];

const visitorData = {
  ip,
  name,
  timestamp: now,
  seenIntro: existing?.seenIntro ?? false,
  location,
  coords,
  maps,
  browser,
  os,
  device
};

if (existingIdx >= 0) {
  visitors[existingIdx] = visitorData;
  console.log(`[REVISIT] ${ip} -> "${name}"`);
} else {
  visitors.push(visitorData);
  console.log(`[VISIT] ${ip} -> "${name}"`);
}
writeVisitors(visitors);

  res.json({ ok: true });
});

/* =========================================================
   GET /api/whoami
   ========================================================= */
app.get("/api/whoami", (req, res) => {
  const user = readVisitors().find(v => v.ip === req.ip);
  res.json({
  name: user?.name || null,
  seenIntro: user?.seenIntro || false
    });
});

app.post("/api/introDone",(req,res)=>{
  const ip=req.ip;
  const visitors=readVisitors();
  const v=visitors.find(v=>v.ip===ip);
  if(v){ v.seenIntro=true; writeVisitors(visitors); }
  res.json({ ok:true });
});

/* fallback */
app.post("/", (_, res) => res.json({ message: "POST request berhasil" }));

app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
