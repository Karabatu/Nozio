import React, { useState, useRef, useEffect } from 'react';
import { X, Sparkles, Image as ImageIcon, Camera, Mic, Loader2, AlertCircle, Plus, Check } from 'lucide-react';
import { trackFoodWithGemini } from '../utils/gemini';
import { Meal } from '../types';
import { motion } from 'motion/react';

interface QuickTrackModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddMeals: (meals: Meal[]) => void;
  geminiApiKey: string;
  defaultCategory: 'breakfast' | 'lunch' | 'dinner' | 'snack';
}

export default function QuickTrackModal({
  isOpen,
  onClose,
  onAddMeals,
  geminiApiKey,
  defaultCategory
}: QuickTrackModalProps) {
  const [activeTab, setActiveTab] = useState<'ai' | 'manual'>('ai');
  const [textInput, setTextInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Bild-Zustand
  const [imageBase64, setImageBase64] = useState<{ mimeType: string; data: string; preview: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Manuelle Masken-Daten
  const [manualName, setManualName] = useState('');
  const [manualKcal, setManualKcal] = useState<number | ''>('');
  const [manualCarbs, setManualCarbs] = useState<number | ''>('');
  const [manualProtein, setManualProtein] = useState<number | ''>('');
  const [manualFat, setManualFat] = useState<number | ''>('');
  const [manualAmount, setManualAmount] = useState<number | ''>(100);
  const [manualCategory, setManualCategory] = useState<'breakfast' | 'lunch' | 'dinner' | 'snack'>(defaultCategory);

  // KI-Ergebnisse (vor dem Einbuchen anzeigen & editieren lassen für maximale Flexibilität)
  const [aiDraftMeals, setAiDraftMeals] = useState<Meal[]>([]);

  // Synchronisieren, wenn das Modal geöffnet wird oder sich die Standardkategorie ändert
  useEffect(() => {
    if (isOpen) {
      setManualCategory(defaultCategory);
      setTextInput('');
      setError(null);
      setImageBase64(null);
      setManualName('');
      setManualKcal('');
      setManualCarbs('');
      setManualProtein('');
      setManualFat('');
      setManualAmount(100);
      setAiDraftMeals([]);
      setActiveTab('ai'); // Standardmäßig mit dem modernen KI-Tracking starten
    }
  }, [isOpen, defaultCategory]);

  // Bild einlesen und in Base64 umwandeln
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Nur Bilder erlauben
    if (!file.type.startsWith('image/')) {
      setError('Bitte wähle eine gültige Bilddatei aus.');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const resultStr = reader.result as string;
      const commaIdx = resultStr.indexOf(',');
      const rawBase64 = resultStr.substring(commaIdx + 1);
      
      setImageBase64({
        mimeType: file.type,
        data: rawBase64,
        preview: resultStr
      });
      setError(null);
    };
    reader.readAsDataURL(file);
  };

  // KI-Tracking ausführen
  const handleAiTrack = async () => {
    if (!textInput && !imageBase64) {
      setError('Bitte trage eine Beschreibung ein oder wähle ein Bild deiner Mahlzeit.');
      return;
    }

    setLoading(true);
    setError(null);
    setAiDraftMeals([]);

    try {
      const results = await trackFoodWithGemini(
        geminiApiKey,
        textInput,
        imageBase64 ? { mimeType: imageBase64.mimeType, data: imageBase64.data } : undefined
      );

      // Category der Entwürfe auf die aktuelle Vorauswahl anpassen
      const calibrated = results.map(item => ({
        ...item,
        category: manualCategory
      }));

      setAiDraftMeals(calibrated);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Die KI-Analyse ist fehlgeschlagen. Du kannst deine Mahlzeit unten manuell erfassen.');
      // Automatisch in den manuellen Modus wechseln bei einem Key-Fehler oder API-Ausfall
      setActiveTab('manual');
      // Falls der Nutzer bereits Text eingegeben hat, diesen als Namen vorschlagen
      if (textInput && textInput.length < 50) {
        setManualName(textInput);
      }
    } finally {
      setLoading(false);
    }
  };

  // Entwurf bearbeiten
  const handleDraftMealChange = (index: number, field: keyof Meal, value: any) => {
    const updated = [...aiDraftMeals];
    updated[index] = {
      ...updated[index],
      [field]: value
    };
    setAiDraftMeals(updated);
  };

  // Entwurf-Zutat löschen
  const handleRemoveDraftMeal = (index: number) => {
    setAiDraftMeals(aiDraftMeals.filter((_, i) => i !== index));
  };

  // KI Entwürfe einbuchen
  const handleSaveAiDrafts = () => {
    if (aiDraftMeals.length === 0) return;
    onAddMeals(aiDraftMeals);
    onClose();
  };

  // Manuelles Einbuchen
  const handleManualSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualName.trim()) {
      setError('Bitte gib einen Namen für das Lebensmittel an.');
      return;
    }

    const now = new Date();
    const timestampStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const newMeal: Meal = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      name: manualName.trim(),
      amount_g: Number(manualAmount) || 100,
      kcal: Math.round(Number(manualKcal) || 0),
      carbs: Math.round(Number(manualCarbs) || 0),
      protein: Math.round(Number(manualProtein) || 0),
      fat: Math.round(Number(manualFat) || 0),
      timestamp: timestampStr,
      category: manualCategory
    };

    onAddMeals([newMeal]);
    onClose();
  };

  return (
    <motion.div
      id="quick-track-modal-container"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md"
    >
      {/* Background click listener to close */}
      <div className="absolute inset-0" onClick={onClose} />

      <motion.div
        id="quick-track-modal-content"
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        transition={{ type: 'spring', damping: 25, stiffness: 350 }}
        className="relative w-full max-w-md bg-zinc-900/75 backdrop-blur-xl border border-zinc-800/80 rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] z-10"
      >
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-emerald-950 text-emerald-400 rounded-lg">
              <Sparkles className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-zinc-100">Essen erfassen</h3>
          </div>
          <button 
            id="quick-track-close-btn"
            onClick={onClose} 
            className="p-1 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Tab-Wechsler */}
        <div className="flex border-b border-zinc-800">
          <button
            onClick={() => { setActiveTab('ai'); setError(null); }}
            className={`flex-1 py-3 text-sm font-semibold transition-colors relative ${
              activeTab === 'ai' ? 'text-emerald-400' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            KI-Direkt-Tracking
            {activeTab === 'ai' && (
              <div className="absolute bottom-0 inset-x-8 h-0.5 bg-emerald-500 rounded-t-full"></div>
            )}
          </button>
          <button
            onClick={() => { setActiveTab('manual'); setError(null); }}
            className={`flex-1 py-3 text-sm font-semibold transition-colors relative ${
              activeTab === 'manual' ? 'text-emerald-400' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Manuelle Schnelleingabe
            {activeTab === 'manual' && (
              <div className="absolute bottom-0 inset-x-8 h-0.5 bg-emerald-500 rounded-t-full"></div>
            )}
          </button>
        </div>

        {/* Body */}
        <div className="p-5 flex-1 overflow-y-auto space-y-4">
          
          {/* Fehlermeldung */}
          {error && (
            <div className="flex items-start gap-3 p-3 bg-red-950/40 border border-red-900/50 rounded-xl text-red-200 text-xs">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <p className="flex-1">{error}</p>
            </div>
          )}

          {/* Mahlzeiten-Kategorie Vorauswahl */}
          <div className="space-y-1.5">
            <span className="text-xs text-zinc-400 font-medium">Zu welcher Mahlzeit hinzufügen?</span>
            <div className="grid grid-cols-4 gap-1.5">
              {(['breakfast', 'lunch', 'dinner', 'snack'] as const).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setManualCategory(cat)}
                  className={`py-1.5 px-1 text-center rounded-lg text-xs font-semibold border transition-colors capitalize ${
                    manualCategory === cat
                      ? 'bg-emerald-950/40 border-emerald-500 text-emerald-400'
                      : 'bg-zinc-800/40 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {cat === 'breakfast' ? 'Frühstück' : cat === 'lunch' ? 'Mittag' : cat === 'dinner' ? 'Abend' : 'Snack'}
                </button>
              ))}
            </div>
          </div>

          {/* A) KI-TRACKING TAB */}
          {activeTab === 'ai' && aiDraftMeals.length === 0 && (
            <div className="space-y-4">
              
              {/* Freitext-Eingabe */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300">Beschreibe deine Mahlzeit</label>
                <div className="relative">
                  <textarea
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    rows={3}
                    placeholder="z.B. 'Zwei Rühreier mit 10g Butter und einer Scheibe Vollkornbrot'"
                    className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-zinc-100 text-sm focus:outline-none focus:border-emerald-500 placeholder-zinc-500 resize-none pr-10"
                    disabled={loading}
                  />
                  {/* Speech to text Hinweis */}
                  <div className="absolute right-3 bottom-3 text-zinc-500 hover:text-zinc-300 cursor-pointer" title="Nutze das Diktat-Symbol deiner Tastatur">
                    <Mic className="w-5 h-5" />
                  </div>
                </div>
              </div>

              {/* Bild hochladen */}
              <div className="space-y-1.5">
                <span className="text-xs font-semibold text-zinc-300 block">Mahlzeit fotografieren (Optional)</span>
                
                {imageBase64 ? (
                  <div className="relative rounded-xl overflow-hidden aspect-video border border-zinc-700 bg-black group">
                    <img 
                      src={imageBase64.preview} 
                      alt="Speisenvorschau" 
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => setImageBase64(null)}
                      className="absolute top-2 right-2 p-1 bg-black/60 hover:bg-black/80 text-white rounded-full transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (fileInputRef.current) {
                          // KRITISCH: capture-Attribut explizit entfernen für iOS Galerie-Auswahl
                          fileInputRef.current.removeAttribute('capture');
                          fileInputRef.current.click();
                        }
                      }}
                      className="flex-1 py-4 border-2 border-dashed border-zinc-800 hover:border-emerald-500 hover:bg-emerald-950/10 rounded-xl flex flex-col items-center justify-center gap-1.5 text-zinc-400 hover:text-emerald-400 transition-all cursor-pointer"
                    >
                      <ImageIcon className="w-6 h-6" />
                      <span className="text-xs font-semibold">Foto hochladen</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (fileInputRef.current) {
                          fileInputRef.current.setAttribute('capture', 'environment');
                          fileInputRef.current.click();
                        }
                      }}
                      className="flex-1 py-4 border-2 border-dashed border-zinc-800 hover:border-emerald-500 hover:bg-emerald-950/10 rounded-xl flex flex-col items-center justify-center gap-1.5 text-zinc-400 hover:text-emerald-400 transition-all cursor-pointer"
                    >
                      <Camera className="w-6 h-6" />
                      <span className="text-xs font-semibold">Kamera nutzen</span>
                    </button>
                  </div>
                )}
                
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImageChange}
                  accept="image/*"
                  className="hidden"
                />
              </div>

              {/* API Key Warnung falls leer */}
              {!geminiApiKey && (
                <div className="p-3 bg-amber-950/30 border border-amber-900/50 rounded-xl flex items-start gap-2 text-amber-200 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0 text-amber-500 mt-0.5" />
                  <p>
                    Kein Google API-Key in den Einstellungen hinterlegt. Bitte trage diesen in den Einstellungen ein, um das KI-Tracking zu nutzen, oder verwende die manuelle Schnelleingabe.
                  </p>
                </div>
              )}

              {/* Sende-Button */}
              <button
                type="button"
                onClick={handleAiTrack}
                disabled={loading || (!textInput && !imageBase64) || !geminiApiKey}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:hover:bg-emerald-600 text-white rounded-xl font-bold shadow-lg shadow-emerald-950/30 transition-all flex items-center justify-center gap-2 text-sm"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    KI analysiert Mahlzeit...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    KI-Analyse starten
                  </>
                )}
              </button>

            </div>
          )}

          {/* A.2) KI-ENTWÜRFE BEARBEITEN (Wird nach erfolgreicher KI-Analyse gezeigt) */}
          {activeTab === 'ai' && aiDraftMeals.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5 uppercase tracking-wider">
                  <Sparkles className="w-3.5 h-3.5" />
                  Ergebnisse prüfen
                </span>
                <button 
                  onClick={() => setAiDraftMeals([])}
                  className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
                >
                  Neu analysieren
                </button>
              </div>

              <div className="space-y-3">
                {aiDraftMeals.map((meal, idx) => (
                  <div key={meal.id} className="p-3 bg-zinc-800/60 border border-zinc-800 rounded-xl space-y-2 relative">
                    <button
                      type="button"
                      onClick={() => handleRemoveDraftMeal(idx)}
                      className="absolute top-2 right-2 text-zinc-500 hover:text-red-400 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>

                    {/* Name */}
                    <input
                      type="text"
                      value={meal.name}
                      onChange={(e) => handleDraftMealChange(idx, 'name', e.target.value)}
                      className="bg-transparent text-sm font-bold text-zinc-100 focus:outline-none border-b border-transparent focus:border-zinc-700 w-4/5 pb-0.5"
                    />

                    {/* Gramm, Kcal */}
                    <div className="grid grid-cols-5 gap-1.5 text-xs text-zinc-300">
                      <div className="col-span-2 space-y-0.5">
                        <span className="text-[10px] text-zinc-500 block">Menge</span>
                        <div className="flex items-center gap-0.5">
                          <input
                            type="number"
                            value={meal.amount_g}
                            onChange={(e) => handleDraftMealChange(idx, 'amount_g', Number(e.target.value) || 0)}
                            className="bg-zinc-900 border border-zinc-700/50 rounded p-1 w-full font-semibold focus:outline-none"
                          />
                          <span className="text-zinc-500 font-medium">g</span>
                        </div>
                      </div>
                      <div className="space-y-0.5">
                        <span className="text-[10px] text-zinc-500 block">Kcal</span>
                        <input
                          type="number"
                          value={meal.kcal}
                          onChange={(e) => handleDraftMealChange(idx, 'kcal', Number(e.target.value) || 0)}
                          className="bg-zinc-900 border border-zinc-700/50 rounded p-1 w-full text-zinc-200 focus:outline-none"
                        />
                      </div>
                      <div className="space-y-0.5">
                        <span className="text-[10px] text-zinc-500 block">Carbs</span>
                        <input
                          type="number"
                          value={meal.carbs}
                          onChange={(e) => handleDraftMealChange(idx, 'carbs', Number(e.target.value) || 0)}
                          className="bg-zinc-900 border border-zinc-700/50 rounded p-1 w-full text-amber-500 focus:outline-none"
                        />
                      </div>
                      <div className="space-y-0.5">
                        <span className="text-[10px] text-zinc-500 block">Prot</span>
                        <input
                          type="number"
                          value={meal.protein}
                          onChange={(e) => handleDraftMealChange(idx, 'protein', Number(e.target.value) || 0)}
                          className="bg-zinc-900 border border-zinc-700/50 rounded p-1 w-full text-rose-500 focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={handleSaveAiDrafts}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold shadow-lg shadow-emerald-950/30 transition-all flex items-center justify-center gap-2 text-sm"
              >
                <Plus className="w-4 h-4" />
                In Tages-Log einbuchen ({aiDraftMeals.length} Posten)
              </button>
            </div>
          )}

          {/* B) MANUELLE SCHNELLEINGABE */}
          {activeTab === 'manual' && (
            <form onSubmit={handleManualSave} className="space-y-3">
              
              {/* Name */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-400">Lebensmittelname</label>
                <input
                  type="text"
                  required
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  placeholder="z.B. Apfel, Quark, Ei"
                  className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-zinc-100 text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Menge & Kalorien */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-zinc-400">Menge (g / ml)</label>
                  <input
                    type="number"
                    required
                    value={manualAmount}
                    onChange={(e) => setManualAmount(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-zinc-100 text-sm focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-zinc-400">Kalorien (kcal)</label>
                  <input
                    type="number"
                    required
                    value={manualKcal}
                    onChange={(e) => setManualKcal(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="0"
                    className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-zinc-100 text-sm focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Makros */}
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-amber-500 uppercase tracking-wider">Carbs (g)</label>
                  <input
                    type="number"
                    value={manualCarbs}
                    onChange={(e) => setManualCarbs(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="0"
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-zinc-100 text-sm focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-rose-500 uppercase tracking-wider">Protein (g)</label>
                  <input
                    type="number"
                    value={manualProtein}
                    onChange={(e) => setManualProtein(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="0"
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-zinc-100 text-sm focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-sky-500 uppercase tracking-wider">Fat (g)</label>
                  <input
                    type="number"
                    value={manualFat}
                    onChange={(e) => setManualFat(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="0"
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-zinc-100 text-sm focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold shadow-lg shadow-emerald-950/30 transition-all flex items-center justify-center gap-2 text-sm"
                >
                  <Check className="w-4 h-4" />
                  Eintrag manuell buchen
                </button>
              </div>

            </form>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 bg-zinc-950/80 border-t border-zinc-800 text-center">
          <span className="text-[10px] text-zinc-500 font-mono">
            100% lokal • Keine Registrierung • Daten verbleiben auf deinem Gerät
          </span>
        </div>

      </motion.div>
    </motion.div>
  );
}
