import Dexie, { Table } from 'dexie';
import { DailyLog, UserSettings } from './types';

export class CalorieTrackerDatabase extends Dexie {
  daily_log!: Table<DailyLog, string>;
  settings!: Table<UserSettings, string>;

  constructor() {
    super('CalorieTrackerDB');
    this.version(1).stores({
      daily_log: 'date',
      settings: 'id',
    });
  }
}

export const db = new CalorieTrackerDatabase();

// Standard-Nährwertverteilung berechnen (in Gramm)
// Kohlenhydrate: 4 kcal/g, Proteine: 4 kcal/g, Fette: 9 kcal/g
export function calculateMacrosInGrams(kcal: number, carbsRatio: number, proteinRatio: number, fatRatio: number) {
  const carbsGrams = Math.round((kcal * (carbsRatio / 100)) / 4);
  const proteinGrams = Math.round((kcal * (proteinRatio / 100)) / 4);
  const fatGrams = Math.round((kcal * (fatRatio / 100)) / 9);

  return {
    carbs: carbsGrams,
    protein: proteinGrams,
    fat: fatGrams,
  };
}

// Standardeinstellungen initialisieren, falls nicht vorhanden
export async function ensureDefaultSettings(): Promise<UserSettings> {
  const existing = await db.settings.get('current');
  if (existing) {
    return existing;
  }

  const defaultSettings: UserSettings = {
    id: 'current',
    target_kcal: 2000,
    ratio_carbs: 50,
    ratio_protein: 30,
    ratio_fat: 20,
    gemini_api_key: '',
    user_name: 'Nutzer',
  };

  await db.settings.put(defaultSettings);
  return defaultSettings;
}

// Initialisiert oder holt ein Tages-Log für ein bestimmtes Datum
export async function getOrCreateDailyLog(dateStr: string): Promise<DailyLog> {
  const existing = await db.daily_log.get(dateStr);
  if (existing) {
    return existing;
  }

  const settings = await ensureDefaultSettings();
  const macros = calculateMacrosInGrams(
    settings.target_kcal,
    settings.ratio_carbs,
    settings.ratio_protein,
    settings.ratio_fat
  );

  const newLog: DailyLog = {
    date: dateStr,
    target_kcal: settings.target_kcal,
    target_carbs: macros.carbs,
    target_protein: macros.protein,
    target_fat: macros.fat,
    meals: [],
  };

  await db.daily_log.put(newLog);
  return newLog;
}
