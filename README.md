# TaskPulse 🚀

TaskPulse is a Telegram bot designed to help you manage your life and career. It combines simple CRUD list management with AI-powered resume parsing and targeted job searching.

## ✨ Features

### 📝 Task Management
- **CRUD Lists**: Manage checklists, events, and bill payments.
- **Smart Retention**: 
  - `Checklists` and `Events` are automatically deleted after 2 months.
  - `Bill Payments` are kept forever.
- **Monthly Reminders**: Automated notifications on the 1st of every month to update your bills.

### 💼 Career Assistant
- **Resume Parsing**: Upload your resume (PDF/DOCX) to automatically extract skills and job titles.
- **Job Scraper**: Find recent (last 7 days) job openings based on your specific skills and titles, targeting high-intent platforms like Lever and Greenhouse.

## 🛠️ Tech Stack
- **Bot Framework**: [Telegraf](https://telegraf.js.org/) (Node.js/TypeScript)
- **Database & API**: [Supabase](https://supabase.com/) (PostgreSQL)
- **Parsing**: `pdf-parse` & `mammoth`
- **Scheduling**: Supabase `pg_cron` or GitHub Actions

## 🚀 Getting Started

### 1. Prerequisites
- Node.js v18+
- A Telegram Bot Token (Get it from [@BotFather](https://t.me/botfather))
- A Supabase Project (Free tier)

### 2. Database Setup
Run the following SQL scripts in your Supabase SQL Editor:
1. Execute `supabase_schema.sql` to create the `tele_users` and `tele_items` tables.
2. Execute `supabase_cron.sql` to set up the cleanup and notification functions.

### 3. Installation
```bash
# Clone the project
git clone <repo-url>
cd TaskPulse

# Install dependencies
npm install
```

### 4. Configuration
Create a `.env` file in the root directory:
```env
BOT_TOKEN=your_telegram_bot_token
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

### 5. Run the Bot
```bash
# Development mode
npm run dev

# Production build
npm run build
npm start
```

## ⌨️ Bot Commands
- `/start` - Start the bot
- `/help` - Show all available commands
- `/add [type] [title]` - Add item (e.g., `/add bill Electric Bill`)
- `/list` - View your current tele_items
- `/delete [id]` - Delete an item using its ID
- `/resume` - Upload your resume for job searching
- `/jobs` - Find suitable jobs based on your profile

## 📅 Automation Setup
To enable the 1st-of-the-month bill reminder and the 2-month cleanup, you can:
1. **Supabase pg_cron**: Enable the `pg_cron` extension in your Supabase dashboard and run the schedule commands found in `supabase_cron.sql`.
2. **GitHub Actions**: Set up a cron workflow that triggers a Supabase Edge Function to call the `sendMonthlyBillReminders` logic.
