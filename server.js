import { Elysia } from "elysia";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import { cors } from "@elysiajs/cors";
import { staticPlugin } from "@elysiajs/static";
import { UAParser } from "ua-parser-js";
import { randomUUID } from "crypto";
import logger from "./logger/logger.js";


const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 3333;

const DATA_DIR = path.join(__dirname, "data");
const VIS_PATH = path.join(DATA_DIR, "visitors.json");

// Pastikan direktori dan file ada saat startup
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
if (!fs.existsSync(VIS_PATH)) fs.writeFileSync(VIS_PATH, "{}", "utf-8");

logger.info(`[FS DEBUG] Path visitors.json: ${VIS_PATH}`);

// --- UTILITY: Read/Write Visitors ---

// Penanganan yang lebih tangguh untuk JSON yang kosong atau rusak
const readVisitors = () => {
    try {
        const content = fs.readFileSync(VIS_PATH, "utf-8");
        if (!content.trim()) return {}; // Mengatasi file kosong
        return JSON.parse(content);
    } catch (e) {
        logger.error(`[FATAL READ ERROR] Gagal membaca atau mem-parsing ${VIS_PATH}.`, e);
        console.error(`[CRITICAL FALLBACK] Gagal membaca file: ${e.message}`);
        return {}; 
    }
};

// ✨ CUSTOM JSON FORMATTER untuk hasil yang lebih rapi
const formatVisitorsJSON = (data) => {
    const entries = Object.entries(data);
    
    if (entries.length === 0) {
        return '{}';
    }
    
    const formattedEntries = entries.map(([sessionId, visitorData]) => {
        // Format setiap visitor data dengan indentasi 4 spasi
        const visitorJSON = JSON.stringify(visitorData, null, 4)
            .split('\n')
            .map(line => '    ' + line) // Tambah 4 spasi di depan setiap baris
            .join('\n');
        
        return `  "${sessionId}": ${visitorJSON.trim()}`;
    });
    
    // Gabungkan dengan newline di antara setiap entry
    return '{\n' + formattedEntries.join(',\n\n') + '\n}';
};

// Write diubah menjadi SYNC untuk memaksa disk flush dengan formatting yang rapi
const writeVisitors = async (data) => {
    try {
        logger.info(`[FS ACTION] Mencoba menulis ${Object.keys(data).length} sesi ke visitors.json (FORCE SYNC WRITE)...`);
        
        // Gunakan custom formatter untuk hasil yang lebih rapi
        const jsonString = formatVisitorsJSON(data);
        
        fs.writeFileSync(VIS_PATH, jsonString, "utf-8"); 
        
        const confirmationRead = fs.readFileSync(VIS_PATH, "utf-8");
        const writtenLength = confirmationRead.length;

        logger.info(`[FS SUCCESS] visitors.json berhasil diupdate. (Panjang file SYNC terkonfirmasi: ${writtenLength} byte)`);
        
        if (writtenLength <= 2) {
             console.error(`[CRITICAL DIAGNOSTIC] Meskipun log sukses, panjang file hanya ${writtenLength} byte. Ada masalah izin atau path tersembunyi.`);
        }
        
    } catch (e) {
        logger.error(`[FATAL SYNC WRITE ERROR] Gagal menulis ke ${VIS_PATH}. Cek izin file.`, e);
        console.error(`[CRITICAL - PERMISSION/PATH ISSUE] File system write failed for ${VIS_PATH}:`, e.message);
    }
};


// --- SIMPLE RATE LIMITER ---
const rateLimitStore = new Map();
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX = 100;

function checkRateLimit(ip) {
    const now = Date.now();
    const record = rateLimitStore.get(ip);
    
    if (!record) {
        rateLimitStore.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
        return { allowed: true, remaining: RATE_LIMIT_MAX - 1 };
    }
    
    if (now > record.resetTime) {
        rateLimitStore.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
        return { allowed: true, remaining: RATE_LIMIT_MAX - 1 };
    }
    
    if (record.count >= RATE_LIMIT_MAX) {
        return { allowed: false, remaining: 0, resetTime: record.resetTime };
    }
    
    record.count++;
    return { allowed: true, remaining: RATE_LIMIT_MAX - record.count };
}

// --- INITIALIZE ELYSIA APP ---
const app = new Elysia()
    // Decorator to get real IP
    .derive(({ request }) => {
        const forwarded = request.headers.get('x-forwarded-for');
        const ip = forwarded 
            ? forwarded.split(',')[0].trim() 
            : request.headers.get('x-real-ip') || '127.0.0.1';
        return { ip };
    })
    
    // Fungsi derive untuk mengambil Session ID dari Query Parameter, Header, atau Cookie
    .derive(({ request, cookie }) => {
        let sessionId = null;
        const url = new URL(request.url);

        // 1. Prioritas Utama: Query Parameter
        sessionId = url.searchParams.get('sessionId');

        // 2. Fallback: Authorization Header
        if (!sessionId) {
            const authHeader = request.headers.get('Authorization');
            if (authHeader && authHeader.startsWith('Bearer ')) {
                sessionId = authHeader.substring(7).trim();
            }
        }
        
        // 3. Fallback Terakhir: Cookie lama (Hanya untuk backward compatibility)
        if (!sessionId) {
            sessionId = cookie.sessionId?.value;
        }
        
        return { extractedSessionId: sessionId };
    })


    // CORS
    .use(cors({ 
        origin: true,
        credentials: true 
    }))

    // Rate Limiter Hook
    .onBeforeHandle(({ ip, set }) => {
        const result = checkRateLimit(ip);
        
        set.headers['X-RateLimit-Limit'] = RATE_LIMIT_MAX.toString();
        set.headers['X-RateLimit-Remaining'] = result.remaining.toString();
        
        if (!result.allowed) {
            set.status = 429;
            const retryAfter = Math.ceil((result.resetTime - Date.now()) / 1000);
            set.headers['Retry-After'] = retryAfter.toString();
            return { error: 'Too many requests' };
        }
    })

    // Request Logger
    .onRequest(({ request }) => {
        logger.info(`[${request.method}] ${new URL(request.url).pathname}`);
    })

    // Cache Control for JS and HTML
    .onBeforeHandle(({ request, set }) => {
        const url = new URL(request.url);
        // Penting: Pastikan browser selalu mengambil versi JS terbaru
        if (url.pathname.endsWith(".js") || url.pathname.endsWith(".html")) {
            set.headers["Cache-Control"] = "no-store";
        }
    })

    // Static Files
    .use(staticPlugin({
        assets: path.join(__dirname, "public"),
        prefix: "/"
    }))

    // POST /api/visit
    .post("/api/visit", async ({ body, cookie, set, ip, request, extractedSessionId }) => {
        const name = body?.name; 
        
        if (!name) {
            set.status = 400;
            return { error: "name required" };
        }
        
        let sessionId = extractedSessionId;
        const visitors = readVisitors();
        const isExistingSession = !!visitors[sessionId];

        if (!sessionId || !isExistingSession) {
            sessionId = randomUUID();
        }

        const ua = request.headers.get('user-agent') || "";
        const now = new Date().toISOString();

        const parser = new UAParser(ua);
        const browser = parser.getBrowser().name || "Unknown";
        const os = parser.getOS().name || "Unknown";
        const device = parser.getDevice().type || "desktop";

        let location = "Unknown", coords = "", maps = "";
        try {
            const geo = await fetch(`https://ipwho.is/${ip}`).then(r => r.json());
            if (geo && geo.success) {
                location = `${geo.city}, ${geo.region}, ${geo.country}`;
                coords = `${geo.latitude},${geo.longitude}`;
                maps = `https://www.google.com/maps?q=${coords}`;
            }
        } catch (err) {
            logger.warn("ipwho.is failed", { ip });
        }

        const visitorData = {
            ip, 
            name, 
            timestamp: now,
            seenIntro: visitors[sessionId]?.seenIntro ?? true, 
            location, 
            coords, 
            maps, 
            browser, 
            os, 
            device
        };
        
        visitors[sessionId] = visitorData; 
        
        await writeVisitors(visitors); 

        if (isExistingSession) {
            logger.info(`[REVISIT - Session] ${sessionId} -> "${name}"`);
        } else {
            logger.info(`[VISIT - Session] ${sessionId} -> "${name}"`);
        }

        // Hapus Cookie lama (Hanya untuk cleanup)
        if (cookie.sessionId) cookie.sessionId.maxAge = -1;
        if (cookie.name) cookie.name.maxAge = -1;
        if (cookie.seenIntro) cookie.seenIntro.maxAge = -1;

        return { ok: true, sessionId: sessionId };
    })

    // GET /api/whoami
    .get("/api/whoami", ({ ip, extractedSessionId, cookie, request }) => {
        
        const url = new URL(request.url);
        logger.info(`[WHOAMI CHECK] Received sessionId: ${extractedSessionId ? extractedSessionId : 'NO - Session will reset'}. Source: ${url.searchParams.has('sessionId') ? 'QUERY_PARAM' : 'OTHER'}`);
        
        if (!extractedSessionId) {
            return { name: null, seenIntro: false };
        }

        const visitors = readVisitors();
        const user = visitors[extractedSessionId];

        if (!user) {
            // Hapus cookie yang "buntu" jika ID berasal dari cookie
            if (cookie.sessionId?.value === extractedSessionId) {
                 cookie.sessionId = { maxAge: -1 }; 
                 logger.warn(`[STALE COOKIE] Session ID ${extractedSessionId} tidak ditemukan di server. Cookie dihapus.`);
            }
            return { name: null, seenIntro: false };
        }
        
        return {
            name: user.name,
            seenIntro: user.seenIntro,
            location: user.location
        };
    })

    // POST /api/introDone
    .post("/api/introDone", async ({ extractedSessionId }) => {
        const sessionId = extractedSessionId;
        
        if (!sessionId) {
            return { ok: false, error: "No session ID found" };
        }

        const visitors = readVisitors();
        const v = visitors[sessionId];
        
        if (v) {
            v.seenIntro = true;
            await writeVisitors(visitors);
            logger.info(`[INTRO DONE] Session ${sessionId}`);
        }
        
        return { ok: true };
    })

    // POST /
    .post("/", () => {
        return { message: "POST request berhasil" };
    })

    // Start Server
    .listen(PORT);

console.log(`Server berjalan pada http://localhost:${PORT}`);