/**
 * Master Runner: Starts the WhatsApp AI Agent, Global Research Dashboard,
 * and automatic Cloudflare Tunnel for secure live internet access.
 */
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import './src/dashboard/server.js';
import './index.js';
import { startDailyResearchScheduler } from './src/scheduler/researchScheduler.js';

// 1. Start the daily automatic gym research scheduler (7:00 AM - 10:00 AM IST)
startDailyResearchScheduler();

console.log('🚀 GymStack System Active: WhatsApp Agent, Dashboard & Daily 7 AM Research Scheduler are running!');

// 2. Automatically launch Cloudflare Tunnel if cloudflared binary is available
const cloudflaredPath = path.resolve('bin', process.platform === 'win32' ? 'cloudflared.exe' : 'cloudflared');

if (fs.existsSync(cloudflaredPath) && process.env.NO_TUNNEL !== '1') {
  console.log('🌐 Starting Cloudflare Live Tunnel...');
  const tunnel = spawn(cloudflaredPath, ['tunnel', '--url', 'http://127.0.0.1:3000']);
  let urlPrinted = false;

  const parseTunnelOutput = (data) => {
    const text = data.toString();
    const match = text.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
    if (match && !urlPrinted) {
      urlPrinted = true;
      console.log('\n================================================================');
      console.log('🎉 GYMSTACK PLATFORM IS LIVE ON THE INTERNET!');
      console.log(`🌐 Public HTTPS URL: ${match[0]}`);
      console.log('🔑 Local Dashboard:  http://localhost:3000');
      console.log('================================================================\n');
    }
  };

  tunnel.stdout.on('data', parseTunnelOutput);
  tunnel.stderr.on('data', parseTunnelOutput);

  tunnel.on('error', (err) => {
    console.warn('⚠️ Could not launch Cloudflare tunnel:', err.message);
  });

  const cleanup = () => {
    try {
      tunnel.kill();
    } catch (e) {}
  };

  process.on('exit', cleanup);
  process.on('SIGINT', () => { cleanup(); process.exit(); });
  process.on('SIGTERM', () => { cleanup(); process.exit(); });
}
