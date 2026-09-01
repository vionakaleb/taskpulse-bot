import { Telegraf } from 'telegraf';
import dotenv from 'dotenv';
import express from 'express';
import { supabase } from './services/supabase.js';
import { ItemService } from './services/itemService.js';
import { ResumeService } from './services/resumeParser.js';
import { JobScraperService } from './services/jobScraper.js';

dotenv.config();

const bot = new Telegraf(process.env.BOT_TOKEN || '');

// --- HTTP Server for Render Health Check & Cron ---
const app = express();
const PORT = Number(process.env.PORT) || 10000;

app.get('/health', (req, res) => res.send('OK'));

app.get('/cron/reminders', async (req, res) => {
  const key = req.query.key;
  if (key !== process.env.CRON_SECRET) {
    return res.status(403).send('Forbidden');
  }

  try {
    await sendMonthlyBillReminders();
    res.send('Reminders sent successfully');
  } catch (e: any) {
    console.error('Cron Execution Error:', e);
    res.status(500).send(`Error: ${e.message}`);
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Health check server listening on port ${PORT}`);
});

// --- CRUD Logic ---
bot.start((ctx) => ctx.reply('Welcome to TaskPulse! Use /help to see what I can do.'));
bot.help((ctx) => ctx.reply('Available commands:\n/add [type] [title] - Add item (checklist, event, bill)\n/list - List all tele_items\n/delete [id] - Delete an item\n/resume - Upload your resume for job searching\n/jobs - Find suitable jobs'));

bot.command('add', async (ctx) => {
  const text = ctx.message.text.split(' ').slice(1).join(' ');
  const parts = text.split(' ');
  const type = parts[0]?.toLowerCase();
  const title = parts.slice(1).join(' ');

  if (!['checklist', 'event', 'bill'].includes(type!) || !title) {
    return ctx.reply('Usage: /add [checklist|event|bill] [title]');
  }

  try {
    await ItemService.ensureUser(ctx.from.id, ctx.from.username);
    await ItemService.addItem(ctx.from.id, type as any, title);
    ctx.reply(`✅ Added ${type}: ${title}`);
  } catch (e: any) {
    ctx.reply(`❌ Error: ${e.message}`);
  }
});

bot.command('list', async (ctx) => {
  try {
    await ItemService.ensureUser(ctx.from.id, ctx.from.username);
    const tele_items = await ItemService.listItems(ctx.from.id);
    if (!tele_items || tele_items.length === 0) return ctx.reply('Your list is empty.');

    const list = tele_items.map(i => `[${i.id.slice(0, 8)}] ${i.type}: ${i.title}`).join('\n');
    ctx.reply(`Your Items:\n${list}\n\nUse /delete [id] to remove.`);
  } catch (e: any) {
    ctx.reply(`❌ Error: ${e.message}`);
  }
});

bot.command('delete', async (ctx) => {
  const id = ctx.message.text.split(' ')[1];
  if (!id) return ctx.reply('Usage: /delete [id]');

  try {
    await ItemService.ensureUser(ctx.from.id, ctx.from.username);
    await ItemService.deleteItem(ctx.from.id, id);
    ctx.reply('✅ Item deleted.');
  } catch (e: any) {
    ctx.reply(`❌ Error: ${e.message}`);
  }
});

// --- Resume & Jobs ---
bot.command('resume', async (ctx) => {
  ctx.reply('Please send me your resume as a PDF or DOCX file.');
});

bot.on('document', async (ctx) => {
  const file = ctx.message.document;
  if (!file.mime_type || (!file.mime_type.includes('pdf') && !file.mime_type.includes('wordprocessingml'))) {
    return ctx.reply('Unsupported file type. Please send PDF or DOCX.');
  }

  try {
    ctx.reply('Parsing your resume... ⏳');
    const fileLink = await ctx.telegram.getFileLink(file.file_id);
    const result = await ResumeService.uploadResume(ctx.from.id, file.file_id, file.file_name || 'resume');
    
    ctx.reply(`✅ Resume parsed successfully!\n\nDetected Skills: ${result.skills.join(', ') || 'None'}\nDetected Titles: ${result.jobTitles.join(', ') || 'None'}\n\nYou can now use /jobs to find suitable positions.`);
  } catch (e: any) {
    ctx.reply(`❌ Error: ${e.message}`);
  }
});

bot.command('jobs', async (ctx) => {
  try {
    const result = await JobScraperService.getRecentJobs(ctx.from.id);
    ctx.reply(`${result.message}\n\n👉 [Click here to view jobs](${result.url})`, { parse_mode: 'Markdown' });
  } catch (e: any) {
    ctx.reply(`❌ Error: ${e.message}`);
  }
});

// --- Automated Admin Logic (Notification Trigger) ---
// This function is designed to be called by an external cron (GitHub Action or Supabase Edge Function)
export async function sendMonthlyBillReminders() {
  const { data: tele_users, error } = await supabase
    .rpc('get_bill_payers');

  if (error) console.error('Cron Error:', error);
  if (!tele_users) return;

  for (const user of tele_users) {
    try {
      await bot.telegram.sendMessage(user.telegram_id, '📅 It is the 1st of the month! Please review and update your Bill Payments list.');
    } catch (e) {
      console.error(`Could not notify user ${user.telegram_id}:`, e);
    }
  }
}

bot.launch().then(() => console.log('TaskPulse Bot is running...'));

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
