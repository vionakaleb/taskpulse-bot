import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

// Simple in-memory rate limiter
const requestCounts = new Map<number, { count: number; resetTime: number }>();
const LIMIT = 10; // max requests
const WINDOW = 60 * 60 * 1000; // 1 hour in ms

function checkRateLimit(userId: number): boolean {
  const now = Date.now();
  const userLimit = requestCounts.get(userId);

  if (!userLimit || now > userLimit.resetTime) {
    requestCounts.set(userId, { count: 1, resetTime: now + WINDOW });
    return true;
  }

  if (userLimit.count >= LIMIT) {
    return false;
  }

  userLimit.count++;
  return true;
}

export const AIService = {
  async parseAddCommand(text: string) {
    const prompt = `
      Extract task details from the following text: "${text}"
      Return ONLY a JSON object with these keys:
      - type: one of "checklist", "event", "bill"
      - title: the task description
      - dueDate: ISO 8601 date string (YYYY-MM-DD) or null if not mentioned. Assume current year 2026 if only month/day is given.

      Example input: "bought cat-litter on 01-09-2026"
      Example output: {"type": "checklist", "title": "bought cat-litter", "dueDate": "2026-09-01"}
    `;

    const result = await model.generateContent(prompt);
    const response = result.response.text();
    const jsonMatch = response.match(/\{.*\}/s);
    return jsonMatch ? JSON.parse(jsonMatch[0]) : null;
  },

  async parseDeleteCommand(text: string) {
    const prompt = `
      Extract task identification details from the following text: "${text}"
      The text may contain one or more items to delete, potentially separated by commas, newlines, or emojis like ✅.

      Return ONLY a JSON object with these keys:
      - type: one of "checklist", "event", "bill" (map the user's requested category to one of these)
      - titles: an array of strings containing the keywords to identify each task (strip emojis and numbering)

      Example input: "bought cat-litter, bought dog-food"
      Example output: {"type": "checklist", "titles": ["bought cat-litter", "bought dog-food"]}

      Example input: "✅ item one\\n✅ item two"
      Example output: {"type": "checklist", "titles": ["item one", "item two"]}
    `;

    const result = await model.generateContent(prompt);
    const response = result.response.text();
    const jsonMatch = response.match(/\{.*\}/s);
    return jsonMatch ? JSON.parse(jsonMatch[0]) : null;
  },

  async answerQuestion(userId: number, question: string, items: any[]) {
    const itemsContext = items.map(i => `[${i.type}] ${i.title} (Date: ${i.due_date || i.created_at})`).join('\n');
    const prompt = `
      You are a helpful assistant for TaskPulse.
      The user's items are:
      ${itemsContext}

      Question: ${question}

      Answer the question based ONLY on the provided list. Be concise and natural.
      If you can't find the answer, say you don't know.
      Language: Use the same language as the question.
    `;

    const result = await model.generateContent(prompt);
    return result.response.text();
  },

  checkRateLimit
};
