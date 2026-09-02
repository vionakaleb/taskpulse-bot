import { supabase } from "../services/supabase.js";
import type { TaskItem } from "../types/index.js";

export const ItemService = {
  async ensureUser(telegramId: number, username?: string) {
    const { data, error } = await supabase
      .from("tele_users")
      .upsert(
        { telegram_id: telegramId, username },
        { onConflict: "telegram_id" },
      )
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async addItem(
    userId: number,
    type: TaskItem["type"],
    title: string,
    description?: string,
    dueDate?: string,
  ) {
    const { data, error } = await supabase
      .from("tele_items")
      .insert({
        user_id: userId,
        type,
        title,
        description,
        due_date: dueDate,
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async listItems(userId: number, type?: string) {
    let query = supabase.from("tele_items").select("*").eq("user_id", userId);

    if (type) {
      query = query.eq("type", type.toLowerCase());
    }

    const { data, error } = await query.order("created_at", {
      ascending: false,
    });
    if (error) throw error;
    return data;
  },

  async findItemByTitle(userId: number, title: string) {
    const { data, error } = await supabase
      .from("tele_items")
      .select("*")
      .eq("user_id", userId)
      .ilike("title", `%${title}%`)
      .limit(5);
    if (error) throw error;
    return data;
  },

  async deleteItem(userId: number, id: string) {
    const { error } = await supabase
      .from("tele_items")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);
    if (error) throw error;
    return true;
  },

  async clearItemsByType(userId: number, type: string) {
    const { error } = await supabase
      .from("tele_items")
      .delete()
      .eq("user_id", userId)
      .eq("type", type.toLowerCase());
    if (error) throw error;
    return true;
  },
};
