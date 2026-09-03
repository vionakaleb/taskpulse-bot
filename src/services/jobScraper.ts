import { supabase } from '../services/supabase.js';
import { format, subDays } from 'date-fns';

export const JobScraperService = {
  async findJobs(userId: number, options: { role?: string; skills?: string; date?: string } = {}) {
    // Fetch user's parsed skills and titles from Supabase as fallback
    const { data: user, error } = await supabase
      .from('tele_users')
      .select('skills, job_titles')
      .eq('telegram_id', userId)
      .single();

    if (error || !user) {
      throw new Error('Please upload your resume first using /resume');
    }

    // Defaults
    const defaultRole = '(Frontend | Fullstack)';
    const defaultSkills = '(typescript | javascript | angular | react | vue | "next.js")';
    const defaultDate = format(subDays(new Date(), 1), 'yyyy-MM-dd');

    const role = options.role || (user.job_titles?.[0] ? `(${user.job_titles.join(' | ')})` : defaultRole);
    const skills = options.skills || (user.skills && user.skills.length > 0 ? `(${user.skills.join(' | ')})` : defaultSkills);
    const date = options.date || defaultDate;

    // Google Dorking Pattern:
    // (sites) (roles) (skills) visa_criteria (exclusions) (date)
    const sites = '(site:linkedin.com | site:lever.co | site:greenhouse.io)';
    const visaCriteria = 'visa sponsorship';
    const exclusions = '"-no Visa" -not -cannot -unable -"not able" -"authorized to work"';

    const fullQuery = `${sites} ${role} ${skills} ${visaCriteria} ${exclusions} after:${date}`;
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(fullQuery)}`;

    return {
      query: fullQuery,
      url: searchUrl,
      message: `I found recent openings matching: ${role} with ${skills}. Check them out here:`
    };
  },

  async getRecentJobs(userId: number, options: { role?: string; skills?: string; date?: string } = {}) {
    try {
      const result = await this.findJobs(userId, options);
      return result;
    } catch (e: any) {
      throw e;
    }
  }
};
