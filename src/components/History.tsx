import { useMemo } from 'react';
import { Calendar, ChevronRight, BarChart2, TrendingUp, Sparkles, AlertCircle } from 'lucide-react';
import { DailyLog } from '../types';
import CalorieTrendChart from './CalorieTrendChart';

interface HistoryProps {
  logs: DailyLog[];
  currentDateStr: string;
  targetKcal: number;
  onSelectDate: (dateStr: string) => void;
}

export default function History({ logs, currentDateStr, targetKcal, onSelectDate }: HistoryProps) {
  
  // Sortiere Logs chronologisch absteigend (neueste oben)
  const sortedLogs = useMemo(() => {
    return [...logs].sort((a, b) => b.date.localeCompare(a.date));
  }, [logs]);

  // Berechne allgemeine Statistiken
  const overallStats = useMemo(() => {
    if (logs.length === 0) return null;

    let totalDays = logs.length;
    let totalKcal = 0;
    let totalCarbs = 0;
    let totalProtein = 0;
    let totalFat = 0;
    let daysGoalMet = 0;

    logs.forEach((log) => {
      let dayKcal = log.meals.reduce((sum, m) => sum + m.kcal, 0);
      let dayCarbs = log.meals.reduce((sum, m) => sum + m.carbs, 0);
      let dayProtein = log.meals.reduce((sum, m) => sum + m.protein, 0);
      let dayFat = log.meals.reduce((sum, m) => sum + m.fat, 0);

      totalKcal += dayKcal;
      totalCarbs += dayCarbs;
      totalProtein += dayProtein;
      totalFat += dayFat;

      // Ziel erreicht, wenn Kalorien innerhalb des Zielbereichs liegen (z.B. max. 50 kcal drüber)
      if (dayKcal > 0 && dayKcal <= log.target_kcal + 50) {
        daysGoalMet++;
      }
    });

    return {
      avgKcal: Math.round(totalKcal / totalDays),
      avgCarbs: Math.round(totalCarbs / totalDays),
      avgProtein: Math.round(totalProtein / totalDays),
      avgFat: Math.round(totalFat / totalDays),
      goalMetRate: Math.round((daysGoalMet / totalDays) * 100),
      totalDays
    };
  }, [logs]);

  // Formatierung des Datums
  const formatDate = (dateStr: string) => {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    
    // Gestern berechnen
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

    if (dateStr === todayStr) return 'Heute';
    if (dateStr === yesterdayStr) return 'Gestern';

    const [year, month, day] = dateStr.split('-').map(Number);
    const d = new Date(year, month - 1, day);

    return d.toLocaleDateString('de-DE', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
  };

  return (
    <div className="space-y-6 pb-20">
      
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-emerald-950 text-emerald-400 rounded-xl">
          <BarChart2 className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-zinc-100">Deine Historie</h2>
          <p className="text-xs text-zinc-500">Übersicht und Statistiken deiner Ernährung</p>
        </div>
      </div>

      {/* 1. Allgemeine Statistiken */}
      {overallStats && (
        <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-3xl space-y-4 shadow-lg">
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 uppercase tracking-wider">
            <TrendingUp className="w-4 h-4" />
            Durchschnittswerte
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-zinc-950/40 p-3 rounded-2xl border border-zinc-800 text-center">
              <span className="text-xs text-zinc-500 font-medium block">Kalorien</span>
              <span className="text-lg font-extrabold text-zinc-200">{overallStats.avgKcal} kcal</span>
              <span className="text-[10px] text-zinc-600 block mt-0.5">pro Tag</span>
            </div>
            <div className="bg-zinc-950/40 p-3 rounded-2xl border border-zinc-800 text-center">
              <span className="text-xs text-zinc-500 font-medium block">Ziel-Erfüllung</span>
              <span className="text-lg font-extrabold text-emerald-400">{overallStats.goalMetRate}%</span>
              <span className="text-[10px] text-zinc-600 block mt-0.5">{overallStats.totalDays} aufgezeichnete Tage</span>
            </div>
          </div>

          {/* Makros Durchschnitt */}
          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-zinc-800/60 text-center text-xs">
            <div>
              <span className="text-zinc-500 block">Carbs</span>
              <span className="font-bold text-amber-500">{overallStats.avgCarbs}g</span>
            </div>
            <div>
              <span className="text-zinc-500 block">Protein</span>
              <span className="font-bold text-rose-500">{overallStats.avgProtein}g</span>
            </div>
            <div>
              <span className="text-zinc-500 block">Fat</span>
              <span className="font-bold text-sky-500">{overallStats.avgFat}g</span>
            </div>
          </div>
        </div>
      )}

      {/* 1.1 Kalorien-Verlauf & Trends */}
      <CalorieTrendChart 
        currentDateStr={currentDateStr}
        allLogs={logs}
        targetKcal={targetKcal}
      />

      {/* 2. Chronologische Tage-Liste */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider pl-1">Vergangene Tage</h3>
        
        {sortedLogs.length === 0 ? (
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 text-center text-zinc-500 text-sm flex flex-col items-center justify-center gap-3">
            <Calendar className="w-8 h-8 text-zinc-600" />
            <p>Noch keine Einträge vorhanden. Erfasse Lebensmittel auf dem Dashboard, um deine Historie zu füllen!</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {sortedLogs.map((log) => {
              const dayKcal = log.meals.reduce((sum, m) => sum + m.kcal, 0);
              const dayCarbs = log.meals.reduce((sum, m) => sum + m.carbs, 0);
              const dayProtein = log.meals.reduce((sum, m) => sum + m.protein, 0);
              const dayFat = log.meals.reduce((sum, m) => sum + m.fat, 0);
              
              const isOver = dayKcal > log.target_kcal;
              const percent = Math.min(100, (dayKcal / log.target_kcal) * 100);

              return (
                <div
                  key={log.date}
                  onClick={() => onSelectDate(log.date)}
                  className="bg-zinc-900 border border-zinc-800 hover:border-zinc-700 active:scale-[0.99] transition-all p-4 rounded-2xl flex items-center justify-between cursor-pointer group"
                >
                  <div className="space-y-2 flex-1 pr-4">
                    {/* Datum & Kalorien */}
                    <div className="flex items-baseline justify-between">
                      <span className="font-bold text-zinc-200 text-sm capitalize">{formatDate(log.date)}</span>
                      <div className="text-xs text-zinc-400 font-semibold font-mono">
                        <span className={isOver ? 'text-red-400 font-bold' : 'text-zinc-200'}>{dayKcal}</span>
                        <span className="text-zinc-600"> / {log.target_kcal} kcal</span>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                      <div 
                        style={{ width: `${percent}%` }}
                        className={`h-full rounded-full transition-all ${isOver ? 'bg-red-500' : 'bg-emerald-500'}`}
                      />
                    </div>

                    {/* Makro-Zusammenfassung */}
                    <div className="flex gap-2 text-[10px] text-zinc-500 font-mono">
                      <span>{log.meals.length} {log.meals.length === 1 ? 'Eintrag' : 'Einträge'}</span>
                      <span>•</span>
                      <span className="text-amber-500">C: {dayCarbs}g</span>
                      <span className="text-rose-500">P: {dayProtein}g</span>
                      <span className="text-sky-500">F: {dayFat}g</span>
                    </div>
                  </div>

                  <ChevronRight className="w-5 h-5 text-zinc-600 group-hover:text-zinc-400 transition-colors shrink-0" />
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
