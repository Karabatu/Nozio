export interface Meal {
  id: string;
  name: string;
  amount_g: number;
  kcal: number;
  carbs: number;
  protein: number;
  fat: number;
  timestamp: string;
  category: 'breakfast' | 'lunch' | 'dinner' | 'snack';
}

export interface DailyLog {
  date: string; // Format: YYYY-MM-DD
  target_kcal: number;
  target_carbs: number;
  target_protein: number;
  target_fat: number;
  meals: Meal[];
}

export interface UserSettings {
  id?: string; // Standard key "current" for single record
  target_kcal: number;
  ratio_carbs: number; // e.g. 50 (%)
  ratio_protein: number; // e.g. 30 (%)
  ratio_fat: number; // e.g. 20 (%)
  gemini_api_key: string;
  user_name: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: Date;
}
