import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, getOrCreateDailyLog, ensureDefaultSettings } from './db';
import { Meal } from './types';
import { AnimatePresence } from 'motion/react';

// Komponenten importieren
import Dashboard from './components/Dashboard';
import History from './components/History';
import Settings from './components/Settings';
import AiCoach from './components/AiCoach';
import QuickTrackModal from './components/QuickTrackModal';
import BarcodeScannerModal from './components/BarcodeScannerModal';
import EditMealModal from './components/EditMealModal';

// Icons
import { 
  Activity, 
  Sparkles, 
  Calendar, 
  Settings as SettingsIcon, 
  Bot,
  Flame,
  Apple
} from 'lucide-react';

export default function App() {
  // Navigation: 'dashboard' | 'coach' | 'history' | 'settings'
  const [currentTab, setCurrentTab] = useState<'dashboard' | 'coach' | 'history' | 'settings'>('dashboard');
  
  // Aktuelles Datum im Format YYYY-MM-DD in lokaler Zeitzone
  const [currentDateStr, setCurrentDateStr] = useState<string>(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  });

  // Modale Steuerungen
  const [isQuickTrackOpen, setIsQuickTrackOpen] = useState(false);
  const [quickTrackCategory, setQuickTrackCategory] = useState<'breakfast' | 'lunch' | 'dinner' | 'snack'>('breakfast');
  const [isBarcodeScannerOpen, setIsBarcodeScannerOpen] = useState(false);
  const [editingMeal, setEditingMeal] = useState<Meal | null>(null);

  // Reaktiv geladene Daten aus IndexedDB (Dexie Live Queries)
  const userSettings = useLiveQuery(() => ensureDefaultSettings(), []);
  const dailyLogs = useLiveQuery(() => db.daily_log.toArray(), []) || [];
  const currentDailyLog = useLiveQuery(() => db.daily_log.get(currentDateStr), [currentDateStr]);

  // Automatisches Tages-Log erstellen, wenn auf ein Datum navigiert wird
  useEffect(() => {
    async function init() {
      await getOrCreateDailyLog(currentDateStr);
    }
    init();
  }, [currentDateStr, userSettings]);

  // Funktion zum Vor- und Zurückblättern der Tage (unter Berücksichtigung lokaler Zeit)
  const handleOffsetDate = (offset: number) => {
    const [year, month, day] = currentDateStr.split('-').map(Number);
    const d = new Date(year, month - 1, day);
    d.setDate(d.getDate() + offset);
    const dateString = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    setCurrentDateStr(dateString);
  };

  // Direktes Datum setzen
  const handleSetSpecificDate = (dateString: string) => {
    setCurrentDateStr(dateString);
  };

  // Speisen hinzufügen
  const handleAddMeals = async (newMeals: (Omit<Meal, 'id' | 'timestamp'> & { id?: string; timestamp?: string })[]) => {
    const log = await db.daily_log.get(currentDateStr);
    if (!log) return;

    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const preparedMeals: Meal[] = newMeals.map((m, idx) => ({
      ...m,
      id: m.id || `${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 4)}`,
      timestamp: m.timestamp || timeStr,
      category: m.category || quickTrackCategory
    }));

    const updatedLog = {
      ...log,
      meals: [...log.meals, ...preparedMeals]
    };

    await db.daily_log.put(updatedLog);
  };

  // Speise löschen
  const handleDeleteMeal = async (mealId: string) => {
    const log = await db.daily_log.get(currentDateStr);
    if (!log) return;

    const updatedLog = {
      ...log,
      meals: log.meals.filter((m) => m.id !== mealId)
    };

    await db.daily_log.put(updatedLog);
  };

  // Speise aktualisieren
  const handleUpdateMeal = async (updatedMeal: Meal) => {
    const log = await db.daily_log.get(currentDateStr);
    if (!log) return;

    const updatedLog = {
      ...log,
      meals: log.meals.map((m) => (m.id === updatedMeal.id ? updatedMeal : m))
    };

    await db.daily_log.put(updatedLog);
  };

  // Quick-Track öffnen mit vorausgewählter Kategorie
  const handleOpenQuickTrack = (category: 'breakfast' | 'lunch' | 'dinner' | 'snack') => {
    setQuickTrackCategory(category);
    setIsQuickTrackOpen(true);
  };

  // Barcode-Scanner öffnen (optional mit vorausgewählter Kategorie)
  const handleOpenBarcodeScanner = (category?: 'breakfast' | 'lunch' | 'dinner' | 'snack') => {
    if (category) {
      setQuickTrackCategory(category);
    }
    setIsBarcodeScannerOpen(true);
  };

  // Callback, wenn Einstellungen geändert werden (erzwingt Reload-Abfrage)
  const handleSettingsChanged = async () => {
    // Wenn das Ziel geändert wurde, passen wir das heutige Log an
    const settings = await db.settings.get('current');
    const log = await db.daily_log.get(currentDateStr);
    if (settings && log && log.meals.length === 0) {
      // Wenn der Tag noch leer ist, aktualisieren wir die Ziele direkt
      const carbsG = Math.round((settings.target_kcal * (settings.ratio_carbs / 100)) / 4);
      const proteinG = Math.round((settings.target_kcal * (settings.ratio_protein / 100)) / 4);
      const fatG = Math.round((settings.target_kcal * (settings.ratio_fat / 100)) / 9);

      await db.daily_log.put({
        ...log,
        target_kcal: settings.target_kcal,
        target_carbs: carbsG,
        target_protein: proteinG,
        target_fat: fatG
      });
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans antialiased">
      
      {/* Container im Smartphone-Layout zentriert auf Desktop */}
      <div className="flex-1 w-full max-w-md mx-auto bg-black border-x border-zinc-900 flex flex-col shadow-2xl relative min-h-screen">
        
        {/* Statusbar Mockup */}
        <div className="sticky top-0 z-40 bg-black/90 backdrop-blur-md border-b border-zinc-900/50 px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Flame className="w-5 h-5 text-emerald-500 fill-emerald-500/10" />
            <h1 className="text-base font-black tracking-tight bg-gradient-to-r from-emerald-400 to-emerald-500 bg-clip-text text-transparent">
              Nozio
            </h1>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider font-mono">100% lokal</span>
          </div>
        </div>

        {/* Haupt-Inhaltsbereich (scrollbar) */}
        <div className="flex-1 overflow-y-auto px-4.5 pt-4">
          {currentTab === 'dashboard' && currentDailyLog && (
            <Dashboard
              dailyLog={currentDailyLog}
              onChangeDate={handleOffsetDate}
              onSetSpecificDate={handleSetSpecificDate}
              onAddMeals={handleAddMeals}
              onDeleteMeal={handleDeleteMeal}
              onOpenQuickTrack={handleOpenQuickTrack}
              onOpenBarcodeScanner={handleOpenBarcodeScanner}
              onEditMealClick={(meal) => setEditingMeal(meal)}
            />
          )}

          {currentTab === 'coach' && (
            <AiCoach
              geminiApiKey={userSettings?.gemini_api_key || ''}
              userSettings={userSettings || null}
              onNavigateToSettings={() => setCurrentTab('settings')}
            />
          )}

          {currentTab === 'history' && (
            <History
              logs={dailyLogs}
              currentDateStr={currentDateStr}
              targetKcal={userSettings?.target_kcal || 2000}
              onSelectDate={(dateStr) => {
                setCurrentDateStr(dateStr);
                setCurrentTab('dashboard');
              }}
            />
          )}

          {currentTab === 'settings' && (
            <Settings onSettingsChanged={handleSettingsChanged} />
          )}
        </div>

        {/* Navigation Drawer (Bottom Tabs) */}
        {/* paddingBottom mit env(safe-area-inset-bottom) verhindert, dass iOS Home-Bar die Nav überdeckt */}
        <div
          className="sticky bottom-0 z-40 bg-zinc-950/95 backdrop-blur-lg border-t border-zinc-900/80 pt-2 px-6 flex justify-between items-center rounded-t-3xl"
          style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
        >
          
          {/* Dashboard Tab */}
          <button
            onClick={() => setCurrentTab('dashboard')}
            className={`flex flex-col items-center gap-1 transition-all ${
              currentTab === 'dashboard' ? 'text-emerald-400 scale-105' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <Activity className="w-5 h-5" />
            <span className="text-[10px] font-bold tracking-tight">Tagebuch</span>
          </button>

          {/* AI Coach Tab */}
          <button
            onClick={() => setCurrentTab('coach')}
            className={`flex flex-col items-center gap-1 transition-all ${
              currentTab === 'coach' ? 'text-emerald-400 scale-105' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <div className="relative">
              <Bot className="w-5 h-5" />
              <Sparkles className="w-2.5 h-2.5 text-emerald-400 absolute -top-1 -right-1.5 animate-pulse" />
            </div>
            <span className="text-[10px] font-bold tracking-tight">AI Coach</span>
          </button>

          {/* History Tab */}
          <button
            onClick={() => setCurrentTab('history')}
            className={`flex flex-col items-center gap-1 transition-all ${
              currentTab === 'history' ? 'text-emerald-400 scale-105' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <Calendar className="w-5 h-5" />
            <span className="text-[10px] font-bold tracking-tight">Historie</span>
          </button>

          {/* Settings Tab */}
          <button
            onClick={() => setCurrentTab('settings')}
            className={`flex flex-col items-center gap-1 transition-all ${
              currentTab === 'settings' ? 'text-emerald-400 scale-105' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <SettingsIcon className="w-5 h-5" />
            <span className="text-[10px] font-bold tracking-tight">Setup</span>
          </button>

        </div>

      </div>

      {/* MODALE DIALOGE */}
      <AnimatePresence>
        {isQuickTrackOpen && (
          <QuickTrackModal
            isOpen={isQuickTrackOpen}
            onClose={() => setIsQuickTrackOpen(false)}
            onAddMeals={handleAddMeals}
            geminiApiKey={userSettings?.gemini_api_key || ''}
            defaultCategory={quickTrackCategory}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isBarcodeScannerOpen && (
          <BarcodeScannerModal
            isOpen={isBarcodeScannerOpen}
            onClose={() => setIsBarcodeScannerOpen(false)}
            onAddMeal={(meal) => handleAddMeals([meal])}
            defaultCategory={quickTrackCategory}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {editingMeal && (
          <EditMealModal
            isOpen={!!editingMeal}
            onClose={() => setEditingMeal(null)}
            meal={editingMeal}
            onUpdateMeal={handleUpdateMeal}
            onDeleteMeal={handleDeleteMeal}
          />
        )}
      </AnimatePresence>

    </div>
  );
}
