const express = require("express");
const qrcode = require("qrcode-terminal");
const fs = require("fs");
const pino = require("pino");
const {
  default: makeWASocket,
  Browsers,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  PHONENUMBER_MCC,
} = require("@whiskeysockets/baileys");
const NodeCache = require("node-cache");
const chalk = require("chalk");
const readline = require("readline");

const app = express();
const port = process.env.PORT || 3000;

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

app.get("/pairing/getcode", async (req, res) => {
  const phoneNumber = req.query.phone;

  if (!phoneNumber) {
    return res.status(400).json({ error: "Phone number is required." });
  }

  try {
    const pairingCode = await generatePairingCode(phoneNumber);
    return res.status(200).json({ code: pairingCode });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

async function generatePairingCode(phoneNumber) {
  let { version } = await fetchLatestBaileysVersion();
  const { state, saveCreds } = await useMultiFileAuthState(`./sessions`);
  const msgRetryCounterCache = new NodeCache();

  const XeonBotInc = makeWASocket({
    logger: pino({ level: "silent" }),
    printQRInTerminal: false,
    browser: Browsers.windows("Firefox"),
    auth: {
      creds: state.creds,
      keys: state.keys,
    },
    msgRetryCounterCache,
  });

  return new Promise((resolve, reject) => {
    phoneNumber = phoneNumber.replace(/[^0-9]/g, "");
    if (!Object.keys(PHONENUMBER_MCC).some((v) => phoneNumber.startsWith(v))) {
      return reject("Invalid phone number format. Use country code, e.g., 93730285765.");
    }

    setTimeout(async () => {
      try {
        let code = await XeonBotInc.requestPairingCode(phoneNumber);
        code = code?.match(/.{1,4}/g)?.join("-") || code;
        resolve(code);
      } catch (error) {
        reject(error);
      }
    }, 3000);
  });
}

app.get("/pairing/session", async (req, res) => {
  try {
    const sessionFile = fs.readFileSync("./sessions/creds.json", "utf-8");
    return res.status(200).json({ sessionId: "SESSION ID GENERATED SUCCESSFULLY", creds: JSON.parse(sessionFile) });
  } catch (error) {
    return res.status(500).json({ error: "Failed to read session file." });
  }
});

// راه‌اندازی سرور Express
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

async function qr() {
  let { version, isLatest } = await fetchLatestBaileysVersion();
  const { state, saveCreds } = await useMultiFileAuthState(`./sessions`);
  const msgRetryCounterCache = new NodeCache();

  const XeonBotInc = makeWASocket({
    logger: pino({ level: "silent" }),
    printQRInTerminal: false,
    browser: Browsers.windows("Firefox"),
    auth: {
      creds: state.creds,
      keys: state.keys,
    },
    msgRetryCounterCache,
  });

  XeonBotInc.ev.on("connection.update", async (s) => {
    const { connection, lastDisconnect } = s;
    if (connection === "open") {
      await delay(1000 * 10);
      await XeonBotInc.sendMessage(XeonBotInc.user.id, {
        text: `*SESSION ID GENERATED SUCCESSFULLY* ✅\n`,
      });
      let sessionXeon = fs.readFileSync("./sessions/creds.json", "utf-8");
      await delay(1000 * 2);
      const xeonses = await XeonBotInc.sendMessage(XeonBotInc.user.id, {
        text: sessionXeon,
      });
      await XeonBotInc.sendMessage(XeonBotInc.user.id, {
        text: `*SESSION ID GENERATED SUCCESSFULLY* ✅\n
        *Gɪᴠᴇ ᴀ ꜱᴛᴀʀ ᴛᴏ ʀᴇᴘᴏ ꜰᴏʀ ᴄᴏᴜʀᴀɢᴇ* 🌟
        https://github.com/TraderAn-King/Ben-bot

        *Sᴜᴘᴘᴏʀᴛ Gʀᴏᴜᴘ ꜰᴏʀ ϙᴜᴇʀʏ* 💭
        https://t.me/Ronix_tech
        https://whatsapp.com/channel/0029Vasu3qP9RZAUkVkvSv32

        *Yᴏᴜ-ᴛᴜʙᴇ ᴛᴜᴛᴏʀɪᴀʟꜱ* 🪄 
        https://whatsapp.com/channel/0029Vasu3qP9RZAUkVkvSv32

        *BEN-WHATSAPP-BOT* 🥀`,
      }, { quoted: xeonses });
      await delay(1000 * 2);
      process.exit(0);
    }
    if (
      connection === "close" &&
      lastDisconnect &&
      lastDisconnect.error &&
      lastDisconnect.error.output.statusCode != 401
    ) {
      qr();
    }
  });
  XeonBotInc.ev.on("creds.update", saveCreds);
  XeonBotInc.ev.on("messages.upsert", () => {});
}

qr();

process.on("uncaughtException", function (err) {
  let e = String(err);
  if (
    e.includes("conflict") ||
    e.includes("not-authorized") ||
    e.includes("Socket connection timeout") ||
    e.includes("rate-overlimit") ||
    e.includes("Connection Closed") ||
    e.includes("Timed Out") ||
    e.includes("Value not found")
  )
    return;
  console.log("Caught exception: ", err);
});