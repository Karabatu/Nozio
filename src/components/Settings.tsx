import React, { useState, useEffect } from 'react';
import { 
  Settings as SettingsIcon, 
  Key, 
  User, 
  Activity, 
  Download, 
  Upload, 
  RefreshCw, 
  Check, 
  AlertCircle,
  Lock,
  Sparkles
} from 'lucide-react';
import { UserSettings } from '../types';
import { db, ensureDefaultSettings } from '../db';

interface SettingsProps {
  onSettingsChanged: () => void;
}

export default function Settings({ onSettingsChanged }: SettingsProps) {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [kcalInput, setKcalInput] = useState<number>(2000);
  const [carbsRatio, setCarbsRatio] = useState<number>(50);
  const [proteinRatio, setProteinRatio] = useState<number>(30);
  const [fatRatio, setFatRatio] = useState<number>(20);
  const [apiKey, setApiKey] = useState<string>('');
  const [userName, setUserName] = useState<string>('');

  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Einstellungen laden beim Mounten
  useEffect(() => {
    async function load() {
      const s = await ensureDefaultSettings();
      setSettings(s);
      setKcalInput(s.target_kcal);
      setCarbsRatio(s.ratio_carbs);
      setProteinRatio(s.ratio_protein);
      setFatRatio(s.ratio_fat);
      setApiKey(s.gemini_api_key);
      setUserName(s.user_name);
    }
    load();
  }, []);

  // Prüfen, ob Verteilungs-Verhältnis genau 100% ergibt
  const ratioTotal = Number(carbsRatio) + Number(proteinRatio) + Number(fatRatio);
  const isRatioValid = ratioTotal === 100;

  // Einstellungen speichern
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isRatioValid) {
      setErrorMsg(`Die Makro-Verteilung muss genau 100% ergeben. Aktuell: ${ratioTotal}%`);
      return;
    }

    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const updated: UserSettings = {
        id: 'current',
        target_kcal: kcalInput,
        ratio_carbs: carbsRatio,
        ratio_protein: proteinRatio,
        ratio_fat: fatRatio,
        gemini_api_key: apiKey.trim(),
        user_name: userName.trim() || 'Nutzer'
      };

      await db.settings.put(updated);
      setSettings(updated);
      setSuccessMsg('Einstellungen erfolgreich gespeichert!');
      onSettingsChanged(); // App informieren, um Dashboard neu zu laden

      // Nach 3 Sekunden Erfolgsmeldung ausblenden
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setErrorMsg('Fehler beim Speichern: ' + (err.message || err));
    } finally {
      setSaving(false);
    }
  };

  // Daten exportieren
  const handleExport = async () => {
    try {
      const logs = await db.daily_log.toArray();
      const s = await db.settings.toArray();
      
      const backup = {
        version: 1,
        app: "KI_Kalorien_Tracker",
        exportedAt: new Date().toISOString(),
        settings: s,
        logs: logs
      };

      const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
        JSON.stringify(backup, null, 2)
      )}`;
      
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', jsonString);
      downloadAnchor.setAttribute(
        'download',
        `nozio_tracker_backup_${new Date().toISOString().split('T')[0]}.json`
      );
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    } catch (err: any) {
      alert('Export fehlgeschlagen: ' + err.message);
    }
  };

  // Daten importieren
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const confirmImport = window.confirm(
      'Möchtest du wirklich dieses Backup importieren? Dies überschreibt alle aktuellen Daten auf diesem Gerät.'
    );
    if (!confirmImport) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const fileContent = event.target?.result as string;
        const data = JSON.parse(fileContent);

        if (data.app !== "KI_Kalorien_Tracker" || !Array.isArray(data.logs)) {
          throw new Error('Das übergebene Dokument ist kein gültiges Backup des Kalorien-Trackers.');
        }

        // IndexedDB löschen und importieren
        await db.daily_log.clear();
        for (const log of data.logs) {
          await db.daily_log.put(log);
        }

        if (Array.isArray(data.settings) && data.settings.length > 0) {
          await db.settings.clear();
          for (const s of data.settings) {
            await db.settings.put(s);
          }
        }

        alert('Erfolgreich wiederhergestellt! Die Anwendung lädt nun neu.');
        window.location.reload();
      } catch (err: any) {
        alert('Fehler beim Importieren: ' + err.message);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6 pb-20">
      
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-emerald-950 text-emerald-400 rounded-xl">
          <SettingsIcon className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-zinc-100">Einstellungen</h2>
          <p className="text-xs text-zinc-500">Konfiguriere deine Ziele und Datensicherungen</p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-5">
        
        {/* Statusmeldungen */}
        {successMsg && (
          <div className="flex items-center gap-2 p-3.5 bg-emerald-950/40 border border-emerald-900/50 rounded-2xl text-emerald-400 text-sm">
            <Check className="w-4 h-4 shrink-0" />
            <p>{successMsg}</p>
          </div>
        )}

        {errorMsg && (
          <div className="flex items-center gap-2 p-3.5 bg-red-950/40 border border-red-900/50 rounded-2xl text-red-400 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <p>{errorMsg}</p>
          </div>
        )}

        {/* 1. Nutzerprofil */}
        <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-3xl space-y-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 uppercase tracking-wider">
            <User className="w-4 h-4" />
            Nutzerprofil
          </div>
          
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-400">Dein Name</label>
            <input
              type="text"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-zinc-100 text-sm focus:outline-none focus:border-emerald-500"
              placeholder="Wie heißt du?"
            />
          </div>
        </div>

        {/* 2. Kalorien & Makroziele */}
        <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-3xl space-y-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 uppercase tracking-wider">
            <Activity className="w-4 h-4" />
            Kalorien & Makroziele
          </div>

          {/* Kalorienziel */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-400 flex justify-between">
              <span>Tägliches Kalorienziel</span>
              <span className="font-bold text-zinc-200 font-mono">{kcalInput} kcal</span>
            </label>
            <input
              type="range"
              min="1000"
              max="5000"
              step="50"
              value={kcalInput}
              onChange={(e) => setKcalInput(Number(e.target.value))}
              className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
            />
          </div>

          {/* Makro-Verhältnis Slider / Eingaben */}
          <div className="space-y-3 pt-2">
            <span className="text-xs font-semibold text-zinc-400 block">Makronährstoff-Verteilung (in %)</span>
            
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1 bg-zinc-950/40 p-3 rounded-2xl border border-zinc-800/60">
                <label className="text-[10px] font-bold text-amber-500 uppercase tracking-wider block">Kohlenhydrate</label>
                <div className="flex items-baseline gap-1">
                  <input
                    type="number"
                    value={carbsRatio}
                    onChange={(e) => setCarbsRatio(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
                    className="w-12 bg-transparent text-lg font-extrabold text-zinc-100 focus:outline-none"
                  />
                  <span className="text-xs text-zinc-500">%</span>
                </div>
              </div>

              <div className="space-y-1 bg-zinc-950/40 p-3 rounded-2xl border border-zinc-800/60">
                <label className="text-[10px] font-bold text-rose-500 uppercase tracking-wider block">Proteine</label>
                <div className="flex items-baseline gap-1">
                  <input
                    type="number"
                    value={proteinRatio}
                    onChange={(e) => setProteinRatio(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
                    className="w-12 bg-transparent text-lg font-extrabold text-zinc-100 focus:outline-none"
                  />
                  <span className="text-xs text-zinc-500">%</span>
                </div>
              </div>

              <div className="space-y-1 bg-zinc-950/40 p-3 rounded-2xl border border-zinc-800/60">
                <label className="text-[10px] font-bold text-sky-500 uppercase tracking-wider block">Fette</label>
                <div className="flex items-baseline gap-1">
                  <input
                    type="number"
                    value={fatRatio}
                    onChange={(e) => setFatRatio(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
                    className="w-12 bg-transparent text-lg font-extrabold text-zinc-100 focus:outline-none"
                  />
                  <span className="text-xs text-zinc-500">%</span>
                </div>
              </div>
            </div>

            {/* Validierungsanzeige */}
            <div className="flex items-center justify-between text-[11px] font-semibold pt-1">
              <span className="text-zinc-500">Gesamtsumme:</span>
              <span className={isRatioValid ? 'text-emerald-400' : 'text-red-400'}>
                {ratioTotal}% {isRatioValid ? '(Korrekt)' : '(Muss 100% ergeben)'}
              </span>
            </div>
          </div>
        </div>

        {/* 3. Google Gemini API-Schlüssel */}
        <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-3xl space-y-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 uppercase tracking-wider">
            <Key className="w-4 h-4" />
            Google AI Studio Integration
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-zinc-400 flex items-center justify-between">
              <span>Google Gemini API-Key</span>
              <span className="text-[10px] bg-emerald-950 text-emerald-400 font-bold px-1.5 py-0.5 rounded flex items-center gap-1 uppercase">
                <Lock className="w-3 h-3" /> lokal gesichert
              </span>
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-zinc-100 text-sm focus:outline-none focus:border-emerald-500 font-mono tracking-wider"
              placeholder="AIzaSy..."
            />
            <p className="text-[10px] text-zinc-500 leading-normal">
              Trage deinen privaten, kostenlosen API-Key aus Google AI Studio ein. Dieser wird ausschließlich in der lokalen Browser-Sandbox gespeichert und schickt Anfragen direkt an Google-Server. Er verlässt dein Gerät niemals.
            </p>
          </div>
        </div>

        {/* Speicher-Button */}
        <button
          type="submit"
          disabled={saving || !isRatioValid}
          className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl font-bold shadow-lg shadow-emerald-950/20 transition-all text-sm flex items-center justify-center gap-2"
        >
          {saving ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              Wird gespeichert...
            </>
          ) : (
            <>
              <Check className="w-4 h-4" />
              Änderungen sichern
            </>
          )}
        </button>

      </form>

      {/* 4. Daten-Backup & Wiederherstellung */}
      <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-3xl space-y-4">
        <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 uppercase tracking-wider">
          <Download className="w-4 h-4" />
          Datensicherung & Import
        </div>

        <p className="text-xs text-zinc-500 leading-normal">
          Da alle Daten lokal in deinem Browser (IndexedDB) liegen, solltest du ab und zu Backups ziehen. Du kannst diese Datei auch nutzen, um dein Profil auf ein anderes iPhone oder Gerät zu übertragen.
        </p>

        <div className="flex gap-3 pt-2">
          <button
            onClick={handleExport}
            className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl font-bold text-xs transition-colors flex items-center justify-center gap-2 border border-zinc-700/60"
          >
            <Download className="w-4 h-4 text-emerald-500" />
            Daten exportieren
          </button>
          
          <label className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl font-bold text-xs transition-colors flex items-center justify-center gap-2 border border-zinc-700/60 cursor-pointer text-center">
            <Upload className="w-4 h-4 text-emerald-500" />
            Daten importieren
            <input
              type="file"
              onChange={handleImport}
              accept=".json"
              className="hidden"
            />
          </label>
        </div>
      </div>

    </div>
  );
}
