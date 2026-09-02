import { Telegraf } from "telegraf";
import dotenv from "dotenv";
import express from "express";
import { supabase } from "./services/supabase.js";
import { ItemService } from "./services/itemService.js";
import { ResumeService } from "./services/resumeParser.js";
import { JobScraperService } from "./services/jobScraper.js";
import { AIService } from "./services/aiService.js";

dotenv.config();

const bot = new Telegraf(process.env.BOT_TOKEN || "");

// --- HTTP Server for Render Health Check & Cron ---
const app = express();
const PORT = Number(process.env.PORT) || 10000;

app.get("/health", (req, res) => res.send("OK"));

app.get("/cron/reminders", async (req, res) => {
  const key = req.query.key;
  if (key !== process.env.CRON_SECRET) {
    return res.status(403).send("Forbidden");
  }

  try {
    await sendMonthlyBillReminders();
    res.send("Reminders sent successfully");
  } catch (e: any) {
    console.error("Cron Execution Error:", e);
    res.status(500).send(`Error: ${e.message}`);
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Health check server listening on port ${PORT}`);
});

// --- CRUD Logic ---
bot.start((ctx) =>
  ctx.reply("Welcome to TaskPulse! Use /help to see what I can do."),
);
bot.help((ctx) =>
  ctx.reply(
    'Available commands:\n/add [type] [title] - Add item (checklist, event, bill)\n/list [type] - List all or specific items (checklist, event, bill)\n/delete [id] - Delete an item\n/resume - Upload your resume for job searching\n/jobs - Find suitable jobs\n\n💡 You can also just talk to me! Ask things like "Kapan saya beli cat-litter?"',
  ),
);

bot.command("add", async (ctx) => {
  const text = ctx.message.text.split(" ").slice(1).join(" ");
  if (!text) return ctx.reply("Usage: /add [checklist|event|bill] [title]");

  const parts = text.split(" ");
  const type = parts[0]?.toLowerCase();
  const title = parts.slice(1).join(" ");

  try {
    await ItemService.ensureUser(ctx.from.id, ctx.from.username);

    // AI parsing for complex inputs
    if (parts.length > 3 || text.includes("on") || text.includes("-")) {
      const aiParsed = await AIService.parseAddCommand(text);
      if (aiParsed) {
        await ItemService.addItem(
          ctx.from.id,
          aiParsed.type as any,
          aiParsed.title,
          undefined,
          aiParsed.dueDate,
        );
        return ctx.reply(
          `✅ AI Added ${aiParsed.type}: ${aiParsed.title}${aiParsed.dueDate ? ` on ${aiParsed.dueDate}` : ""}`,
        );
      }
    }

    // Fallback to simple parsing
    if (!["checklist", "event", "bill"].includes(type!) || !title) {
      return ctx.reply("Usage: /add [checklist|event|bill] [title]");
    }

    await ItemService.addItem(ctx.from.id, type as any, title);
    ctx.reply(`✅ Added ${type}: ${title}`);
  } catch (e: any) {
    ctx.reply(`❌ Error: ${e.message}`);
  }
});

bot.command("list", async (ctx) => {
  const type = ctx.message.text.split(" ")[1]?.toLowerCase();
  try {
    await ItemService.ensureUser(ctx.from.id, ctx.from.username);
    const tele_items = await ItemService.listItems(ctx.from.id, type);
    if (!tele_items || tele_items.length === 0) {
      return ctx.reply(
        type ? `Your ${type} list is empty.` : "Your list is empty.",
      );
    }

    const list = tele_items
      .map((i) => (type ? `✅ ${i.title}` : `✅ ${i.type}: ${i.title}`))
      .join("\n");
    ctx.reply(
      `${type ? `${type.toUpperCase()} Items:` : "Your Items:"}\n${list}\n\nUse /delete [id] to remove.`,
    );
  } catch (e: any) {
    ctx.reply(`❌ Error: ${e.message}`);
  }
});

bot.command("delete", async (ctx) => {
  const input = ctx.message.text.split(" ").slice(1).join(" ");
  if (!input) return ctx.reply("Usage: /delete [id or item name]");

  try {
    await ItemService.ensureUser(ctx.from.id, ctx.from.username);

    // If input is a UUID (roughly 36 chars), use direct delete
    if (input.length >= 32 && /^[0-9a-f-]+$/.test(input)) {
      await ItemService.deleteItem(ctx.from.id, input);
      return ctx.reply("✅ Item deleted.");
    }

    // AI parsing for name-based delete
    const aiParsed = await AIService.parseDeleteCommand(input);
    if (aiParsed) {
      const matches = await ItemService.findItemByTitle(
        ctx.from.id,
        aiParsed.title,
      );
      if (!matches || matches.length === 0) {
        return ctx.reply(
          `❌ Could not find any item matching "${aiParsed.title}"`,
        );
      }
      if (matches.length > 1) {
        const list = matches.map((m) => `✅ ${m.title}`).join("\n");
        return ctx.reply(
          `Found multiple matches. Please use the ID to delete:\n${list}`,
        );
      }
      await ItemService.deleteItem(ctx.from.id, matches[0].id);
      return ctx.reply(`✅ Deleted: ${matches[0].title}`);
    }

    ctx.reply("❌ Could not identify the item to delete.");
  } catch (e: any) {
    ctx.reply(`❌ Error: ${e.message}`);
  }
});

// --- Resume & Jobs ---
bot.command("resume", async (ctx) => {
  ctx.reply("Please send me your resume as a PDF or DOCX file.");
});

bot.on("document", async (ctx) => {
  const file = ctx.message.document;
  if (
    !file.mime_type ||
    (!file.mime_type.includes("pdf") &&
      !file.mime_type.includes("wordprocessingml"))
  ) {
    return ctx.reply("Unsupported file type. Please send PDF or DOCX.");
  }

  try {
    ctx.reply("Parsing your resume... ⏳");
    const fileLink = await ctx.telegram.getFileLink(file.file_id);
    const result = await ResumeService.uploadResume(
      ctx.from.id,
      file.file_id,
      file.file_name || "resume",
    );

    ctx.reply(
      `✅ Resume parsed successfully!\n\nDetected Skills: ${result.skills.join(", ") || "None"}\nDetected Titles: ${result.jobTitles.join(", ") || "None"}\n\nYou can now use /jobs to find suitable positions.`,
    );
  } catch (e: any) {
    ctx.reply(`❌ Error: ${e.message}`);
  }
});

bot.command("jobs", async (ctx) => {
  try {
    const result = await JobScraperService.getRecentJobs(ctx.from.id);
    ctx.reply(
      `${result.message}\n\n👉 [Click here to view jobs](${result.url})`,
      { parse_mode: "Markdown" },
    );
  } catch (e: any) {
    ctx.reply(`❌ Error: ${e.message}`);
  }
});

// --- Natural Language Q&A ---
bot.on("text", async (ctx) => {
  // Ignore if it's a command
  if (ctx.message.text.startsWith("/")) return;

  try {
    await ItemService.ensureUser(ctx.from.id, ctx.from.username);

    if (!AIService.checkRateLimit(ctx.from.id)) {
      return ctx.reply(
        "⚠️ You have reached your AI request limit for this hour. Please try again later!",
      );
    }

    ctx.reply("Thinking... 🧠");
    const items = await ItemService.listItems(ctx.from.id);
    const answer = await AIService.answerQuestion(
      ctx.from.id,
      ctx.message.text,
      items,
    );
    ctx.reply(answer);
  } catch (e: any) {
    console.error("NL Query Error:", e);
    ctx.reply("❌ Sorry, I had trouble processing that request.");
  }
});

// --- Automated Admin Logic (Notification Trigger) ---
export async function sendMonthlyBillReminders() {
  const { data: tele_users, error } = await supabase.rpc("get_bill_payers");

  if (error) console.error("Cron Error:", error);
  if (!tele_users) return;

  for (const user of tele_users) {
    try {
      await bot.telegram.sendMessage(
        user.telegram_id,
        "📅 It is the 1st of the month! Please review and update your Bill Payments list.",
      );
    } catch (e) {
      console.error(`Could not notify user ${user.telegram_id}:`, e);
    }
  }
}

// --- Webhook Integration ---
const WEBHOOK_PATH = "/secret-telegram-webhook";
const BOT_URL =
  process.env.BOT_URL || "https://taskpulse-bot-r5zy.onrender.com";
const WEBHOOK_URL = `${BOT_URL}${WEBHOOK_PATH}`;

app.use(bot.webhookCallback(WEBHOOK_PATH));

bot.telegram
  .setWebhook(WEBHOOK_URL)
  .then(() => {
    console.log(`✅ Webhook integrated: ${WEBHOOK_URL}`);
  })
  .catch((err) => {
    console.error("❌ Webhook registration failed:", err);
  });
