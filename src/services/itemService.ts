import { supabase } from '../services/supabase.js';
import type { TaskItem } from '../types/index.js';

export const ItemService = {
  async ensureUser(telegramId: number, username?: string) {
    const { data, error } = await supabase
      .from('users')
      .upsert({ telegram_id: telegramId, username }, { onConflict: 'telegram_id' })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async addItem(userId: number, type: TaskItem['type'], title: string, description?: string) {
    const { data, error } = await supabase
      .from('items')
      .insert({ user_id: userId, type, title, description })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async listItems(userId: number) {
    const { data, error } = await supabase
      .from('items')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  async deleteItem(userId: number, id: string) {
    const { error } = await supabase
      .from('items')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);
    if (error) throw error;
    return true;
  }
};
