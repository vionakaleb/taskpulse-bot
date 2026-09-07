import { Telegraf } from "telegraf";
import dotenv from "dotenv";
import express from "express";
import { supabase } from "./services/supabase.js";
import { ItemService } from "./services/itemService.js";
import { ResumeService } from "./services/resumeParser.js";
import { JobScraperService } from "./services/jobScraper.js";
import { AIService } from "./services/aiService.js";
import { ReesuClient } from "./services/reesuClient.js";
import { withReesuAuth, ReesuAuthError } from "./services/reesuAuth.js";

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
    'Available commands:\n/add [type] [title] - Add item (checklist, event, bill)\n/list [type] - List all or specific items (checklist, event, bill)\n/delete [id] - Delete an item\n/clear [type] - Clear all items of a specific type\n/reesu_login [email] [password] - Link your Reesu account\n\nReesu resumes:\n/resume - Upload a PDF/DOCX to create or update your resume\n/resume_new - Upload a PDF/DOCX to create an additional resume\n/resumes - List your Reesu resumes\n/resume_view [number] - View a resume\'s full content\n/resume_rename [number] [title] - Rename a resume\n/resume_delete [number] - Delete a resume\n/jobs - Find suitable jobs\n\n/search [query] - Get a clickable Google search link for a query\n\n💡 You can also just talk to me! Ask things like "Kapan saya beli cat-litter?"',
  ),
);

bot.command("search", (ctx) => {
  const query = ctx.message.text.split(" ").slice(1).join(" ").trim();
  if (!query) return ctx.reply("Usage: /search [query]");

  const url = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
  ctx.reply(url);
});

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
    if (aiParsed && aiParsed.titles) {
      let deletedCount = 0;
      const failed: string[] = [];

      for (const title of aiParsed.titles) {
        const matches = await ItemService.findItemByTitle(ctx.from.id, title);
        if (matches && matches.length === 1) {
          await ItemService.deleteItem(ctx.from.id, matches[0].id);
          deletedCount++;
        } else if (!matches || matches.length === 0) {
          failed.push(title);
        } else {
          failed.push(`${title} (multiple matches)`);
        }
      }

      let response = `✅ Deleted ${deletedCount} item(s).`;
      if (failed.length > 0) {
        response += `\n❌ Could not identify:\n${failed.join("\n")}`;
      }
      return ctx.reply(response);
    }

    ctx.reply("❌ Could not identify the item to delete.");
  } catch (e: any) {
    ctx.reply(`❌ Error: ${e.message}`);
  }
});

bot.command("clear", async (ctx) => {
  const type = ctx.message.text.split(" ")[1]?.toLowerCase();
  if (!type) return ctx.reply("Usage: /clear [checklist|event|bill]");

  if (!["checklist", "event", "bill"].includes(type)) {
    return ctx.reply("Invalid type. Please use checklist, event, or bill.");
  }

  try {
    await ItemService.ensureUser(ctx.from.id, ctx.from.username);
    await ItemService.clearItemsByType(ctx.from.id, type);
    ctx.reply(`✅ Cleared all ${type} items.`);
  } catch (e: any) {
    ctx.reply(`❌ Error: ${e.message}`);
  }
});

// Per-user cooldown so repeated taps on /reesu_login don't hammer the Reesu
// API (which rate-limits /auth/login at 5 requests/minute per IP) and burn
// through the shared limit on one impatient user.
const reesuLoginCooldown = new Map<number, number>();
const REESU_LOGIN_COOLDOWN_MS = 10_000;

bot.command("reesu_login", async (ctx) => {
  const parts = ctx.message.text.split(" ");
  if (parts.length < 3) {
    return ctx.reply("Usage: /reesu_login [email] [password]");
  }

  const lastAttempt = reesuLoginCooldown.get(ctx.from.id) ?? 0;
  const waitMs = REESU_LOGIN_COOLDOWN_MS - (Date.now() - lastAttempt);
  if (waitMs > 0) {
    return ctx.reply(`⏳ Please wait ${Math.ceil(waitMs / 1000)}s before trying again.`);
  }
  reesuLoginCooldown.set(ctx.from.id, Date.now());

  const email = parts[1] ?? "";
  const password = parts[2] ?? "";

  try {
    ctx.reply("Authenticating with Reesu... ⏳");
    const tokens = await ReesuClient.loginUser(email, password);

    // Ensure the tele_users row exists first - an update against a
    // non-existent row silently affects zero rows (no error), which would
    // otherwise drop the tokens for a brand-new user's first command.
    await ItemService.ensureUser(ctx.from.id, ctx.from.username);

    const { error } = await supabase
      .from("tele_users")
      .update({
        reesu_access_token: tokens.access_token,
        reesu_refresh_token: tokens.refresh_token,
      })
      .eq("telegram_id", ctx.from.id);

    if (error) throw error;
    ctx.reply("✅ Successfully linked your Reesu account!");
  } catch (e: any) {
    ctx.reply(`❌ Login failed: ${e.message}`);
  }
});

// --- Resume CRUD ---

// Tracks whether the next uploaded document should create a brand-new
// resume (/resume_new) instead of the default upsert behavior (/resume).
const pendingResumeAction = new Map<number, "create">();

function formatResumeList(resumes: any[]): string {
  return resumes
    .map(
      (r, i) =>
        `${i + 1}. ${r.title} ${r.is_public ? "🌐" : "🔒"} — updated ${new Date(r.updated_at).toLocaleDateString()}`,
    )
    .join("\n");
}

function formatResumeDetail(resume: any): string {
  const c = resume.content || {};
  const lines: string[] = [
    `📄 ${resume.title} (${resume.is_public ? "public" : "private"})`,
  ];
  if (c.name) lines.push(`👤 ${c.name}${c.headline ? ` — ${c.headline}` : ""}`);

  const contact = [c.location, c.email, c.phone, c.website, c.linkedin]
    .filter(Boolean)
    .join(" | ");
  if (contact) lines.push(contact);
  if (c.summary) lines.push(`\n${c.summary}`);

  const section = (label: string, entries: any[] = []) => {
    if (!entries.length) return;
    lines.push(`\n${label.toUpperCase()}`);
    for (const e of entries) {
      const head = [e.title, e.org].filter(Boolean).join(" @ ");
      const meta = [e.location, e.dates].filter(Boolean).join(" · ");
      lines.push(`• ${head}${meta ? ` (${meta})` : ""}`);
      for (const b of e.bullets || []) lines.push(`   - ${b}`);
    }
  };
  section("Experience", c.experience);
  section("Education", c.education);
  section("Projects", c.projects);
  section("Certifications", c.certifications);
  section("Achievements", c.achievements);

  if (c.skills?.length) {
    lines.push(`\nSKILLS`);
    for (const s of c.skills) lines.push(`• ${s.label}: ${s.value}`);
  }
  if (c.languages?.length) {
    lines.push(`\nLANGUAGES`);
    lines.push(c.languages.map((l: any) => `${l.name} (${l.level})`).join(", "));
  }

  const text = lines.join("\n");
  return text.length > 4000 ? `${text.slice(0, 4000)}\n… (truncated)` : text;
}

// Parses the leading "[number]" arg shared by /resume_view, /resume_rename
// and /resume_delete, returning null (with a usage reply already sent) if
// it's missing or not a positive integer.
function parseResumeIndexArg(ctx: any, usage: string): number | null {
  const arg = ctx.message.text.split(" ")[1];
  const index = Number(arg);
  if (!arg || !Number.isInteger(index) || index < 1) {
    ctx.reply(usage);
    return null;
  }
  return index;
}

bot.command("resumes", async (ctx) => {
  try {
    const resumes = await withReesuAuth(ctx.from.id, (token) =>
      ReesuClient.listResumes(token),
    );
    if (!resumes.length) {
      return ctx.reply(
        "You don't have any Reesu resumes yet. Use /resume and send a PDF/DOCX to create one.",
      );
    }
    ctx.reply(
      `Your Reesu resumes:\n${formatResumeList(resumes)}\n\nUse /resume_view [number], /resume_rename [number] [title], or /resume_delete [number].`,
    );
  } catch (e: any) {
    ctx.reply(`❌ ${e.message}`);
  }
});

bot.command("resume_view", async (ctx) => {
  const index = parseResumeIndexArg(ctx, "Usage: /resume_view [number] — see /resumes for the list.");
  if (index === null) return;

  try {
    const resume = await withReesuAuth(ctx.from.id, async (token) => {
      const resumes = await ReesuClient.listResumes(token);
      const target = resumes[index - 1];
      if (!target) throw new Error(`No resume #${index}. Run /resumes to see your list.`);
      return ReesuClient.getResume(token, target.id);
    });
    ctx.reply(formatResumeDetail(resume));
  } catch (e: any) {
    ctx.reply(`❌ ${e.message}`);
  }
});

bot.command("resume_rename", async (ctx) => {
  const parts = ctx.message.text.split(" ").slice(1);
  const index = Number(parts[0]);
  const newTitle = parts.slice(1).join(" ").trim();
  if (!parts[0] || !Number.isInteger(index) || index < 1 || !newTitle) {
    return ctx.reply("Usage: /resume_rename [number] [new title]");
  }

  try {
    await withReesuAuth(ctx.from.id, async (token) => {
      const resumes = await ReesuClient.listResumes(token);
      const target = resumes[index - 1];
      if (!target) throw new Error(`No resume #${index}. Run /resumes to see your list.`);
      await ReesuClient.updateResume(token, target.id, { title: newTitle });
    });
    ctx.reply(`✅ Renamed resume #${index} to "${newTitle}".`);
  } catch (e: any) {
    ctx.reply(`❌ ${e.message}`);
  }
});

bot.command("resume_delete", async (ctx) => {
  const index = parseResumeIndexArg(ctx, "Usage: /resume_delete [number] — see /resumes for the list.");
  if (index === null) return;

  try {
    const deletedTitle = await withReesuAuth(ctx.from.id, async (token) => {
      const resumes = await ReesuClient.listResumes(token);
      const target = resumes[index - 1];
      if (!target) throw new Error(`No resume #${index}. Run /resumes to see your list.`);
      await ReesuClient.deleteResume(token, target.id);
      return target.title;
    });
    ctx.reply(`🗑️ Deleted resume "${deletedTitle}".`);
  } catch (e: any) {
    ctx.reply(`❌ ${e.message}`);
  }
});

bot.command("resume", async (ctx) => {
  pendingResumeAction.delete(ctx.from.id);
  ctx.reply("Please send me your resume as a PDF or DOCX file.");
});

bot.command("resume_new", async (ctx) => {
  pendingResumeAction.set(ctx.from.id, "create");
  ctx.reply("Please send me your resume as a PDF or DOCX file to create a NEW resume.");
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

  const createNew = pendingResumeAction.get(ctx.from.id) === "create";
  pendingResumeAction.delete(ctx.from.id);

  try {
    ctx.reply("Parsing your resume... ⏳");

    // 1. Parse the resume text
    const fileLink = await ctx.telegram.getFileLink(file.file_id);
    const response = await fetch(fileLink as URL);
    const buffer = Buffer.from(await response.arrayBuffer());

    let text = "";
    if (file.file_name?.endsWith(".pdf")) {
      const pdfParse = require("pdf-parse");
      const data = await pdfParse(buffer);
      text = data.text;
    } else if (file.file_name?.endsWith(".docx")) {
      const mammoth = require("mammoth");
      const data = await mammoth.extractRawText({ buffer });
      text = data.value;
    } else {
      throw new Error("Unsupported file format.");
    }

    // 2. Structure using AI
    ctx.reply("Structuring your resume for Reesu... 🧠");
    const structuredContent = await AIService.structureResume(text);
    if (!structuredContent) {
      throw new Error("Failed to structure the resume content.");
    }
    const title = structuredContent.name
      ? `${structuredContent.name} — Resume`
      : "My Resume";

    // 3. Create or update via the Reesu API (auto-refreshing the access
    // token if it has expired since the user last talked to the bot).
    await withReesuAuth(ctx.from.id, async (token) => {
      if (!createNew) {
        const resumes = await ReesuClient.listResumes(token);
        const existingResume = resumes[0]; // most recently updated
        if (existingResume) {
          await ReesuClient.updateResume(token, existingResume.id, {
            content: structuredContent,
          });
          return ctx.reply(`✅ Your resume "${existingResume.title}" has been updated!`);
        }
      }
      await ReesuClient.createResume(token, title, structuredContent);
      ctx.reply(`✅ Created a new Reesu resume: "${title}"!`);
    });

    // Also keep the local bot cache updated
    const parsedData = ResumeService.parseResume(text);
    await supabase
      .from("tele_users")
      .update({
        skills: parsedData.skills,
        job_titles: parsedData.jobTitles,
      })
      .eq("telegram_id", ctx.from.id);

    ctx.reply(
      `Detected Skills: ${parsedData.skills.join(", ") || "None"}\nDetected Titles: ${parsedData.jobTitles.join(", ") || "None"}\n\nYou can now use /jobs to find suitable positions, or /resumes to manage your Reesu resumes.`,
    );
  } catch (e: any) {
    if (e instanceof ReesuAuthError) {
      return ctx.reply(`❌ ${e.message}`);
    }
    ctx.reply(`❌ Error: ${e.message}`);
  }
});

bot.command("jobs", async (ctx) => {
  try {
    const text = ctx.message.text.split(" ").slice(1).join(" ");
    let options = {};

    if (text) {
      const aiParsed = await AIService.parseJobsCommand(text);
      if (aiParsed) {
        options = {
          role: aiParsed.role,
          skills: aiParsed.skills,
          date: aiParsed.date,
        };
      }
    }

    const result = await JobScraperService.getRecentJobs(ctx.from.id, options);
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
    await ctx.reply(answer);
    await new Promise((resolve) => setTimeout(resolve, 10));
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
