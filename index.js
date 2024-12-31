const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const pino = require('pino');
const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, Browsers } = require('@whiskeysockets/baileys');
const NodeCache = require('node-cache');
const readline = require('readline');
const chalk = require('chalk');

const app = express();
const port = 3000;
const msgRetryCounterCache = new NodeCache();
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

app.use(bodyParser.json());
app.use(express.static('public'));  // To serve the HTML file

let phoneNumber = ''; // Global phone number

// Function to get pairing code from Baileys
async function getPairingCode(number) {
  const { version, isLatest } = await fetchLatestBaileysVersion();
  const { state, saveCreds } = await useMultiFileAuthState('./sessions');
  
  const socket = makeWASocket({
    logger: pino({ level: 'silent' }),
    printQRInTerminal: true,
    browser: Browsers.windows('Firefox'),
    auth: {
      creds: state.creds,
      keys: state.keys,
    },
    msgRetryCounterCache,
  });

  phoneNumber = number;
  
  try {
    const code = await socket.requestPairingCode(phoneNumber);

    // After generating the pairing code, read the creds.json file and send it to the user
    const credsFile = './sessions/creds.json';
    if (fs.existsSync(credsFile)) {
      const credsContent = fs.readFileSync(credsFile, 'utf-8');
      return { code, credsContent };
    } else {
      return { code, credsContent: null };
    }
  } catch (error) {
    console.error(chalk.red('Error generating pairing code'), error);
    return { code: null, credsContent: null };
  }
}

// Endpoint to receive phone number and send pairing code along with creds.json content
app.post('/get-pairing-code', async (req, res) => {
  const { number } = req.body;
  if (!number) {
    return res.status(400).json({ error: 'Phone number is required' });
  }

  const { code, credsContent } = await getPairingCode(number);
  
  if (code) {
    const response = { code };
    if (credsContent) {
      response.credsContent = credsContent;
    }
    return res.json(response);
  } else {
    return res.status(500).json({ error: 'Failed to generate pairing code' });
  }
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
