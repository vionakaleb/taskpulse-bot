import { supabase } from '../services/supabase.js';
import * as pdfParse from 'pdf-parse';
import mammoth from 'mammoth';

export const ResumeService = {
  async uploadResume(telegramId: number, fileId: string, fileName: string) {
    // In a real scenario, you'd download from Telegram and upload to Supabase Storage
    // For this implementation, we simulate storage and focus on parsing
    const fileUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${fileId}`;
    
    const response = await fetch(fileUrl);
    const buffer = Buffer.from(await response.arrayBuffer());
    
    let text = '';
    if (fileName.endsWith('.pdf')) {
      const data = await (pdfParse as any)(buffer);
      text = data.text;
    } else if (fileName.endsWith('.docx')) {
      const data = await mammoth.extractRawText({ buffer });
      text = data.value;
    } else {
      throw new Error('Unsupported file format. Please upload PDF or DOCX.');
    }

    const parsedData = this.parseResume(text);

    const { error } = await supabase
      .from('tele_users')
      .upsert({ 
        telegram_id: telegramId, 
        skills: parsedData.skills, 
        job_titles: parsedData.jobTitles 
      });

    if (error) throw error;
    return parsedData;
  },

  parseResume(text: string) {
    // Basic keyword-based parsing logic
    const commonSkills = ['React', 'TypeScript', 'Node.js', 'Python', 'Java', 'AWS', 'Docker', 'Kubernetes', 'SQL', 'NoSQL', 'FastAPI', 'Next.js'];
    const jobTitles = ['Software Engineer', 'Frontend Developer', 'Backend Developer', 'Fullstack Developer', 'DevOps', 'Data Scientist'];

    const skills = commonSkills.filter(skill => 
      new RegExp(`\\b${skill}\\b`, 'i').test(text)
    );

    const foundTitles = jobTitles.filter(title => 
      new RegExp(`\\b${title}\\b`, 'i').test(text)
    );

    return {
      skills,
      jobTitles: foundTitles.length > 0 ? foundTitles : ['Software Engineer']
    };
  }
};
