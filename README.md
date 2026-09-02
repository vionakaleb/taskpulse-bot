# TaskPulse 🚀

TaskPulse is a Telegram bot designed to help you manage your life and career. It combines simple CRUD list management with AI-powered natural language interaction, resume parsing, and targeted job searching.

## ✨ Features

### 🧠 AI-Powered Interaction
- **Natural Language Q&A**: Just talk to the bot! Ask things like *"When did I last buy cat-litter?"* or *"What bills are pending?"* and get concise answers based on your data.
- **Smart Input Parsing**: Add items using natural language. Instead of strict formats, you can say `/add checklist bought cat-litter on 01-09-2026` and the bot will extract the date and title automatically.
- **Intuitive Deletion**: Delete items by name (e.g., `/delete checklist cat-litter`) without needing to find the exact UUID.

### 📝 Task Management
- **CRUD Lists**: Manage checklists, events, and bill payments.
- **Type Filtering**: View specific lists using `/list [type]` (e.g., `/list bill`).
- **Smart Retention**: 
  - `Checklists` and `Events` are automatically deleted after 2 months.
  - `Bill Payments` are kept forever.
- **Monthly Reminders**: Automated notifications on the 1st of every month to update your bills.

### 💼 Career Assistant
- **Resume Parsing**: Upload your resume (PDF/DOCX) to automatically extract skills and job titles.
- **Job Scraper**: Find recent (last 7 days) job openings based on your specific skills and titles, targeting high-intent platforms like Lever and Greenhouse.

## 🛠️ Tech Stack
- **Bot Framework**: [Telegraf](https://telegraf.js.org/) (Node.js/TypeScript)
- **AI Model**: [Google Gemini 1.5 Flash](https://aistudio.google.com/)
- **Database & API**: [Supabase](https://supabase.com/) (PostgreSQL)
- **Parsing**: `pdf-parse` & `mammoth`
- **Scheduling**: Supabase `pg_cron` or GitHub Actions

## 🚀 Deployment & Integration

### 1. Deploy to Render
This bot is optimized for deployment on [Render](https://render.com).
- **Build Command**: `npm install && npm run build`
- **Start Command**: `npm start`
- **Runtime**: Node.js

### 2. Telegram Integration (Webhooks)
The bot uses **Webhooks** for high performance. Once deployed to Render, the bot automatically registers its endpoint with Telegram.

**Required Environment Variables on Render:**
| Variable | Description | Where to get it |
| :--- | :--- | :--- |
| `BOT_TOKEN` | Telegram Bot API Token | [@BotFather](https://t.me/botfather) |
| `GEMINI_API_KEY` | Google AI Studio API Key | [Google AI Studio](https://aistudio.google.com/) |
| `SUPABASE_URL` | Your Supabase Project URL | Supabase Dashboard $\rightarrow$ Settings |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Service Role Key | Supabase Dashboard $\rightarrow$ Settings |
| `CRON_SECRET` | A secure string for the cron endpoint | Create your own random string |
| `PORT` | Server port (Default: 10000) | Provided by Render |

### 3. Verification
Check your Render logs. You should see:
`✅ Webhook integrated: https://your-app-url.onrender.com/secret-telegram-webhook`

## 💻 Local Development

### 1. Prerequisites
- Node.js v18+
- A Telegram Bot Token (Get it from [@BotFather](https://t.me/botfather))
- A Supabase Project (Free tier)
- A Gemini API Key (Free tier)

### 2. Database Setup
Run the following SQL scripts in your Supabase SQL Editor:
1. Execute `supabase_schema.sql` to create the `tele_users` and `tele_items` tables.
2. Execute `supabase_cron.sql` to set up the cleanup and notification functions.

### 3. Installation & Run
```bash
# Clone the project
git clone <repo-url>
cd TaskPulse

# Install dependencies
npm install

# Start in development mode
npm run dev
```

## ⌨️ Bot Commands
- `/start` - Start the bot
- `/help` - Show all available commands
- `/add [type] [title]` - Add item (e.g., `/add bill Electric Bill`). Now supports natural language dates!
- `/list [type]` - View all items or filter by type (checklist, event, bill)
- `/delete [id/name]` - Delete an item using its ID or just its name
- `/resume` - Upload your resume for job searching
- `/jobs` - Find suitable jobs based on your profile
- **(No Command)** - Just send a message to ask the AI about your lists!

## 📅 Automation Setup
To enable the 1st-of-the-month bill reminder and the 2-month cleanup, you can:
1. **Supabase pg_cron**: Enable the `pg_cron` extension in your Supabase dashboard and run the schedule commands found in `supabase_cron.sql`.
2. **GitHub Actions**: Set up a cron workflow that triggers a Supabase Edge Function to call the `sendMonthlyBillReminders` logic.
