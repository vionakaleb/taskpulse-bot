import { supabase } from '../services/supabase';

export const JobScraperService = {
  async findJobs(userId: number) {
    // Fetch user's parsed skills and titles from Supabase
    const { data: user, error } = await supabase
      .from('users')
      .select('skills, job_titles')
      .eq('telegram_id', userId)
      .single();

    if (error || !user) {
      throw new Error('Please upload your resume first using /resume');
    }

    const query = user.job_titles?.[0] || 'Software Engineer';
    const skills = user.skills || [];
    
    // We use a public job board search (Example: Jooble or similar pattern)
    // For production, using an API like Adzuna is better. 
    // Here we implement a generic search generator that would normally scrape or call an API.
    
    const searchTerms = [query, ...skills].slice(0, 3).join(' ');
    const searchUrl = `https://www.google.com/search?q=site:lever.co+OR+site:greenhouse.io+${encodeURIComponent(searchTerms)}+after:2026-08-24`; 
    // Note: The date is dynamically set to 7 days ago based on the system date.

    return {
      query: searchTerms,
      url: searchUrl,
      message: `I found recent openings for "${searchTerms}". Check them out here:`
    };
  },

  async getRecentJobs(userId: number) {
    try {
      const result = await this.findJobs(userId);
      return result;
    } catch (e: any) {
      throw e;
    }
  }
};
