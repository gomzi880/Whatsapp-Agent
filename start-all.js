/**
 * Master Runner: Starts both the WhatsApp AI Agent & the Global Research Dashboard
 */
import './src/dashboard/server.js';
import './index.js';
import { startDailyResearchScheduler } from './src/scheduler/researchScheduler.js';

// Start the daily automatic gym research scheduler (Runs every day 7:00 AM - 10:00 AM IST)
startDailyResearchScheduler();

console.log('🚀 GymStack System Active: WhatsApp Agent, Dashboard & Daily 7 AM Research Scheduler are running!');
