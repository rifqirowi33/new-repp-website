const fs = require("fs");
const path = require("path");

// Buat folder log kalau belum ada
const LOG_DIR = path.join(__dirname, "logs");
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR);

const LOG_FILE = path.join(LOG_DIR, "server.log");

// Fungsi waktu
function timestamp() {
  return new Date().toISOString().replace("T", " ").split(".")[0];
}

// Fungsi tulis ke file
function write(level, message, meta = {}) {
  const line = `${timestamp()} [${level.toUpperCase()}] ${message} ${
    Object.keys(meta).length ? JSON.stringify(meta) : ""
  }\n`;

  // Tulis ke file dan ke console
  fs.appendFileSync(LOG_FILE, line);
  console.log(line.trim());
}

const logger = {
  info: (msg, meta) => write("INFO", msg, meta),
  warn: (msg, meta) => write("WARN", msg, meta),
  error: (msg, meta) => write("ERROR", msg, meta),
};

module.exports = logger;