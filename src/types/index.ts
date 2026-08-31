export type ItemType = 'checklist' | 'event' | 'bill';

export interface UserProfile {
  telegramId: number;
  username?: string;
  resumeUrl?: string;
  skills?: string[];
  jobTitles?: string[];
}

export interface TaskItem {
  id?: string;
  userId: number;
  type: ItemType;
  title: string;
  description?: string;
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
}
