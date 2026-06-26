import { useState, useMemo } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar, 
  Plus, 
  Trash2, 
  Coffee, 
  Utensils, 
  Moon, 
  Apple, 
  Sparkles, 
  Barcode, 
  AlertCircle 
} from 'lucide-react';
import { DailyLog, Meal } from '../types';
import { motion, AnimatePresence } from 'motion/react';

interface DashboardProps {
  dailyLog: DailyLog;
  onChangeDate: (offset: number) => void;
  onSetSpecificDate: (dateStr: string) => void;
  onAddMeals: (meals: Omit<Meal, 'id' | 'timestamp'>[]) => void;
  onDeleteMeal: (mealId: string) => void;
  onOpenQuickTrack: (category: 'breakfast' | 'lunch' | 'dinner' | 'snack') => void;
  onOpenBarcodeScanner: (category?: 'breakfast' | 'lunch' | 'dinner' | 'snack') => void;
  onEditMealClick: (meal: Meal) => void;
}

export default function Dashboard({
  dailyLog,
  onChangeDate,
  onSetSpecificDate,
  onAddMeals,
  onDeleteMeal,
  onOpenQuickTrack,
  onOpenBarcodeScanner,
  onEditMealClick
}: DashboardProps) {
  
  // Formatierung des Datums für die Anzeige (z.B. "Heute, 26. Juni")
  const formattedDateLabel = useMemo(() => {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    
    // Gestern berechnen
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

    const [year, month, day] = dailyLog.date.split('-').map(Number);
    const logDate = new Date(year, month - 1, day);

    const options: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long' };
    const localeDate = logDate.toLocaleDateString('de-DE', options);

    if (dailyLog.date === todayStr) {
      return `Heute, ${logDate.toLocaleDateString('de-DE', { day: 'numeric', month: 'long' })}`;
    } else if (dailyLog.date === yesterdayStr) {
      return `Gestern, ${logDate.toLocaleDateString('de-DE', { day: 'numeric', month: 'long' })}`;
    }
    return localeDate;
  }, [dailyLog.date]);

  // Aggregierte Nährwerte der heutigen Speisen
  const stats = useMemo(() => {
    let kcal = 0;
    let carbs = 0;
    let protein = 0;
    let fat = 0;

    dailyLog.meals.forEach((meal) => {
      kcal += meal.kcal;
      carbs += meal.carbs;
      protein += meal.protein;
      fat += meal.fat;
    });

    const remainingKcal = dailyLog.target_kcal - kcal;
    const isOverKcal = remainingKcal < 0;

    return {
      consumedKcal: kcal,
      remainingKcal: Math.abs(remainingKcal),
      isOverKcal,
      consumedCarbs: carbs,
      consumedProtein: protein,
      consumedFat: fat,
      targetKcal: dailyLog.target_kcal,
      targetCarbs: dailyLog.target_carbs,
      targetProtein: dailyLog.target_protein,
      targetFat: dailyLog.target_fat,
    };
  }, [dailyLog]);

  // Aufteilung der Speisen nach Kategorie
  const categorizedMeals = useMemo(() => {
    const categories: Record<'breakfast' | 'lunch' | 'dinner' | 'snack', { label: string; icon: any; color: string; list: Meal[]; totalKcal: number }> = {
      breakfast: { label: 'Frühstück', icon: Coffee, color: 'text-amber-400 bg-amber-950/30', list: [], totalKcal: 0 },
      lunch: { label: 'Mittagessen', icon: Utensils, color: 'text-emerald-400 bg-emerald-950/30', list: [], totalKcal: 0 },
      dinner: { label: 'Abendessen', icon: Moon, color: 'text-rose-400 bg-rose-950/30', list: [], totalKcal: 0 },
      snack: { label: 'Snacks & Riegel', icon: Apple, color: 'text-sky-400 bg-sky-950/30', list: [], totalKcal: 0 },
    };

    dailyLog.meals.forEach((meal) => {
      if (categories[meal.category]) {
        categories[meal.category].list.push(meal);
        categories[meal.category].totalKcal += meal.kcal;
      }
    });

    return categories;
  }, [dailyLog.meals]);

  // SVG Parameter für das Circular Progress Diagramm
  const radius = 75;
  const strokeWidth = 10;
  const circumference = 2 * Math.PI * radius;
  
  const fillPercentage = useMemo(() => {
    const pct = (stats.consumedKcal / stats.targetKcal) * 100;
    return Math.min(100, Math.max(0, pct));
  }, [stats]);

  const strokeDashoffset = useMemo(() => {
    return circumference - (fillPercentage / 100) * circumference;
  }, [fillPercentage, circumference]);

  return (
    <div className="space-y-6 pb-20">
      
      {/* 1. Datums-Navigator */}
      <div className="flex items-center justify-between bg-zinc-900 border border-zinc-800 p-3 rounded-2xl">
        <button 
          onClick={() => onChangeDate(-1)}
          className="p-2 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-xl transition-all"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        
        <div className="flex items-center gap-2 cursor-pointer hover:opacity-85 transition-opacity">
          <Calendar className="w-4 h-4 text-emerald-500" />
          <input
            type="date"
            value={dailyLog.date}
            onChange={(e) => e.target.value && onSetSpecificDate(e.target.value)}
            className="absolute opacity-0 w-28 cursor-pointer"
          />
          <span className="text-sm font-bold text-zinc-100">{formattedDateLabel}</span>
        </div>

        <button 
          onClick={() => onChangeDate(1)}
          className="p-2 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-xl transition-all"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* 2. Nozio Circular Calories Card */}
      <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl relative overflow-hidden flex flex-col items-center justify-center shadow-xl">
        {/* Glow Effekt im Hintergrund */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
        
        <div className="relative w-44 h-44 flex items-center justify-center">
          {/* SVG Kreis */}
          <svg className="absolute -rotate-90 w-full h-full">
            {/* Background Circle */}
            <circle
              cx="88"
              cy="88"
              r={radius}
              stroke="#27272a"
              strokeWidth={strokeWidth}
              fill="transparent"
              className="transition-all"
            />
            {/* Foreground Circle */}
            <circle
              cx="88"
              cy="88"
              r={radius}
              stroke={stats.isOverKcal ? '#ef4444' : '#10b981'}
              strokeWidth={strokeWidth}
              fill="transparent"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              className="transition-all duration-500 ease-out"
            />
          </svg>

          {/* Text im Kreis */}
          <div className="text-center z-10 space-y-1">
            <span className="text-3xl font-extrabold font-sans text-zinc-100 tracking-tight block">
              {stats.remainingKcal.toLocaleString('de-DE')}
            </span>
            <span className={`text-[11px] uppercase tracking-wider font-bold block ${stats.isOverKcal ? 'text-red-400' : 'text-zinc-400'}`}>
              {stats.isOverKcal ? 'kcal drüber' : 'kcal übrig'}
            </span>
          </div>
        </div>

        {/* Aufgenommen vs Ziel Legende */}
        <div className="grid grid-cols-2 gap-8 w-full mt-6 pt-4 border-t border-zinc-800/60 text-center">
          <div>
            <span className="text-xs text-zinc-500 font-semibold block">Gegessen</span>
            <span className="text-sm font-bold text-zinc-200">{stats.consumedKcal.toLocaleString('de-DE')} kcal</span>
          </div>
          <div>
            <span className="text-xs text-zinc-500 font-semibold block">Tagesziel</span>
            <span className="text-sm font-bold text-zinc-200">{stats.targetKcal.toLocaleString('de-DE')} kcal</span>
          </div>
        </div>
      </div>

      {/* 3. Makronährstoff-Balken */}
      <div className="grid grid-cols-3 gap-3 bg-zinc-900 border border-zinc-800 p-4 rounded-3xl shadow-md">
        
        {/* Kohlenhydrate */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-baseline text-xs">
            <span className="font-semibold text-zinc-400">Carbs</span>
            <span className="text-[10px] text-zinc-500 font-mono">{stats.consumedCarbs}g / {stats.targetCarbs}g</span>
          </div>
          <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, (stats.consumedCarbs / stats.targetCarbs) * 100)}%` }}
              transition={{ duration: 0.5 }}
              className="h-full bg-amber-500 rounded-full"
            />
          </div>
        </div>

        {/* Eiweiß */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-baseline text-xs">
            <span className="font-semibold text-zinc-400">Protein</span>
            <span className="text-[10px] text-zinc-500 font-mono">{stats.consumedProtein}g / {stats.targetProtein}g</span>
          </div>
          <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, (stats.consumedProtein / stats.targetProtein) * 100)}%` }}
              transition={{ duration: 0.5 }}
              className="h-full bg-rose-500 rounded-full"
            />
          </div>
        </div>

        {/* Fett */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-baseline text-xs">
            <span className="font-semibold text-zinc-400">Fat</span>
            <span className="text-[10px] text-zinc-500 font-mono">{stats.consumedFat}g / {stats.targetFat}g</span>
          </div>
          <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, (stats.consumedFat / stats.targetFat) * 100)}%` }}
              transition={{ duration: 0.5 }}
              className="h-full bg-sky-500 rounded-full"
            />
          </div>
        </div>

      </div>

      {/* Quick Access Actions */}
      <div className="flex gap-2">
        <button
          onClick={() => onOpenQuickTrack('breakfast')}
          className="flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] transition-all text-white rounded-xl font-semibold flex items-center justify-center gap-2 text-sm shadow-lg shadow-emerald-950/20"
        >
          <Sparkles className="w-4 h-4" />
          KI-Tracking
        </button>
        <button
          onClick={() => onOpenBarcodeScanner()}
          className="px-4 py-3 bg-zinc-800 hover:bg-zinc-700 active:scale-[0.98] transition-all text-zinc-200 rounded-xl font-semibold flex items-center justify-center gap-2 text-sm border border-zinc-700"
        >
          <Barcode className="w-4 h-4" />
          Barcode scannen
        </button>
      </div>

      {/* 4. Mahlzeiten Sektionen */}
      <div className="space-y-3.5">
        <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider pl-1">Deine Mahlzeiten</h4>
        
        {(Object.keys(categorizedMeals) as ('breakfast' | 'lunch' | 'dinner' | 'snack')[]).map((key) => {
          const category = categorizedMeals[key];
          const IconComponent = category.icon;

          return (
            <div key={key} className="bg-zinc-900 border border-zinc-800/80 rounded-2xl overflow-hidden shadow-sm">
              
              {/* Sektions-Header */}
              <div className="flex items-center justify-between p-4 bg-zinc-900/60 border-b border-zinc-800/40">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-xl ${category.color}`}>
                    <IconComponent className="w-4 h-4" />
                  </div>
                  <div>
                    <h5 className="text-sm font-bold text-zinc-200">{category.label}</h5>
                    <span className="text-[10px] text-zinc-500 font-mono">Empfohlen: ~{key === 'breakfast' ? '25%' : key === 'lunch' ? '35%' : key === 'dinner' ? '25%' : '15%'}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  <span className="text-sm font-extrabold text-zinc-300 font-sans mr-1">
                    {category.totalKcal} <span className="text-[11px] text-zinc-500 font-normal">kcal</span>
                  </span>
                  
                  {/* Barcode-Button direkt für diese Sektion */}
                  <button
                    onClick={() => onOpenBarcodeScanner(key)}
                    className="p-1.5 bg-zinc-800 hover:bg-emerald-950 hover:text-emerald-400 text-zinc-400 rounded-lg transition-all"
                    title={`${category.label} über Barcode scannen`}
                  >
                    <Barcode className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => onOpenQuickTrack(key)}
                    className="p-1.5 bg-zinc-800 hover:bg-emerald-950 hover:text-emerald-400 text-zinc-400 rounded-lg transition-all"
                    title={`${category.label} hinzufügen`}
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Speisenliste */}
              <div className="p-1">
                {category.list.length === 0 ? (
                  <div className="py-4 px-4 text-center text-zinc-500 text-xs">
                    Noch kein Eintrag. Klicke auf das Plus, um etwas hinzuzufügen.
                  </div>
                ) : (
                  <div className="divide-y divide-zinc-800/40">
                    <AnimatePresence>
                      {category.list.map((meal) => (
                        <motion.div
                          key={meal.id}
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, height: 0 }}
                          onClick={() => onEditMealClick(meal)}
                          className="flex items-center justify-between p-3 pl-4 text-xs group cursor-pointer hover:bg-zinc-800/30 transition-colors rounded-xl"
                        >
                          <div className="space-y-0.5 flex-1 pr-4">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-zinc-200 text-sm group-hover:text-emerald-400 transition-colors">{meal.name}</span>
                              <span className="text-[10px] text-zinc-500 font-mono">{meal.timestamp}</span>
                            </div>
                            <div className="flex gap-2 text-zinc-500 text-[11px]">
                              <span>{meal.amount_g}g</span>
                              <span>•</span>
                              <span className="text-amber-500 font-mono">C: {meal.carbs}g</span>
                              <span className="text-rose-500 font-mono">P: {meal.protein}g</span>
                              <span className="text-sky-500 font-mono">F: {meal.fat}g</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <span className="font-bold text-zinc-200">{meal.kcal} kcal</span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeleteMeal(meal.id);
                              }}
                              className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-950/20 rounded-lg transition-colors"
                              title="Eintrag löschen"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                )}
              </div>

            </div>
          );
        })}
      </div>

    </div>
  );
}
