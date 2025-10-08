const requestIp = require("request-ip");
const { UAParser } = require("ua-parser-js");

let isbot = require("isbot");
if (isbot && typeof isbot !== "function") {
  isbot = isbot.default || isbot.isbot || Object.values(isbot)[0];
}

const logger = require("./logger.js");

function requestLogger() {
  return function (req, res, next) {
    const start = process.hrtime();

    res.on("finish", () => {
      const diff = process.hrtime(start);
      const responseTimeMs = diff[0] * 1e3 + diff[1] / 1e6;
      const ip = requestIp.getClientIp(req) || req.ip;
      const ua = req.headers["user-agent"] || "";
      const parser = new UAParser(ua);
      const uaRes = parser.getResult();

      const meta = {
        ip,
        method: req.method,
        url: req.originalUrl,
        status: res.statusCode,
        responseTimeMs: Number(responseTimeMs.toFixed(2)),
        browser: uaRes.browser.name,
        os: uaRes.os.name,
        device: uaRes.device.type || "desktop",
        isBot: isbot(ua),
      };

      const msg = `${req.method} ${req.originalUrl} ${res.statusCode} ${responseTimeMs.toFixed(2)}ms`;

      if (res.statusCode >= 500) {
        logger.error(msg, { meta });
      } else if (res.statusCode >= 400) {
        logger.warn(msg, { meta });
      } else {
        logger.info(msg, { meta });
      }
    });

    next();
  };
}

module.exports = requestLogger;
