import React, { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, AlertCircle, Bot, User, Trash2, ArrowRight } from 'lucide-react';
import { chatWithAiCoach } from '../utils/gemini';
import { ChatMessage, UserSettings, Meal } from '../types';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, getOrCreateDailyLog } from '../db';

interface AiCoachProps {
  geminiApiKey: string;
  userSettings: UserSettings | null;
  onNavigateToSettings: () => void;
}

export default function AiCoach({ geminiApiKey, userSettings, onNavigateToSettings }: AiCoachProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const threadEndRef = useRef<HTMLDivElement>(null);

  // Aktuelles Datum für Live-Queries
  const today = new Date();
  const currentDateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  
  // Holt das aktuelle Daily-Log für die AI-Kontextualisierung
  const currentDailyLog = useLiveQuery(() => db.daily_log.get(currentDateStr), [currentDateStr]);

  // Initialisiere Standardnachricht, falls der Chat leer ist
  useEffect(() => {
    const savedChat = localStorage.getItem('nozio_coach_chat');
    if (savedChat) {
      try {
        const parsed = JSON.parse(savedChat);
        // Date strings wieder in Date Objekte umwandeln
        const hydrated = parsed.map((m: any) => ({
          ...m,
          timestamp: new Date(m.timestamp)
        }));
        setMessages(hydrated);
        return;
      } catch (err) {
        console.error("Gespeicherter Chat konnte nicht geladen werden", err);
      }
    }

    // Wenn kein gespeicherter Chat, Standard-Begrüßung setzen
    const name = userSettings?.user_name || 'Nutzer';
    const welcomeMsg: ChatMessage = {
      id: 'welcome',
      sender: 'ai',
      text: `Hallo ${name}! 👋 Ich bin Nico, dein persönlicher KI-Ernährungsberater und Fitness-Coach.\n\nEgal, ob du Gewicht verlieren, Muskeln aufbauen, oder dich einfach gesünder ernähren möchtest – ich stehe dir mit Rat und Tat zur Seite. \n\nFrage mich gerne nach Rezepten, Tipps gegen Heißhunger, Trainingsplänen oder bitte mich, deine Nährwertverteilung zu analysieren. Woran arbeiten wir heute?`,
      timestamp: new Date()
    };
    setMessages([welcomeMsg]);
  }, [userSettings?.user_name]);

  // Chat-Historie in localStorage persistieren
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem('nozio_coach_chat', JSON.stringify(messages));
    }
  }, [messages]);

  // Automatisch zum Ende scrollen, wenn neue Nachrichten eingehen
  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Hilfsfunktion zur Darstellung einfacher Markdown-Strukturen wie Fettgedrucktes und Listen
  const renderFormattedMessage = (text: string) => {
    const lines = text.split('\n');
    return lines.map((line, lineIdx) => {
      // Prüfen, ob die Zeile ein Listeneintrag ist
      const isBulletList = line.trim().startsWith('* ') || line.trim().startsWith('- ');
      const isNumberedList = /^\d+\.\s/.test(line.trim());
      
      let content = line;
      if (isBulletList) {
        content = line.trim().replace(/^[\*\-]\s+/, '');
      } else if (isNumberedList) {
        content = line.trim().replace(/^\d+\.\s+/, '');
      }

      // Fettgedruckten Text parsen: **text**
      const parts = content.split('**');
      const parsedLine = parts.map((part, partIdx) => {
        if (partIdx % 2 === 1) {
          return <strong key={partIdx} className="font-extrabold text-white">{part}</strong>;
        }
        return part;
      });

      if (isBulletList) {
        return (
          <div key={lineIdx} className="flex items-start gap-1.5 ml-2.5 my-1">
            <span className="text-emerald-400 shrink-0 select-none">•</span>
            <span className="flex-1">{parsedLine}</span>
          </div>
        );
      }

      if (isNumberedList) {
        const numberMatch = line.trim().match(/^(\d+)\./);
        const number = numberMatch ? numberMatch[1] : '1';
        return (
          <div key={lineIdx} className="flex items-start gap-1.5 ml-2.5 my-1">
            <span className="text-emerald-400 font-bold font-mono shrink-0 select-none text-[10px] mt-0.5">{number}.</span>
            <span className="flex-1">{parsedLine}</span>
          </div>
        );
      }

      // Leere Zeile als Abstandshalter
      if (line.trim() === '') {
        return <div key={lineIdx} className="h-2" />;
      }

      return (
        <div key={lineIdx} className="min-h-[1.2em]">
          {parsedLine}
        </div>
      );
    });
  };

  // Nachricht absenden
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userText = input.trim();
    setInput('');
    setError(null);

    const userMsg: ChatMessage = {
      id: `${Date.now()}-user`,
      sender: 'user',
      text: userText,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      // Chat-Historie für Gemini aufbereiten
      // Wir holen die letzten 10 Nachrichten für den Kontext
      const historyContext = [...messages, userMsg].slice(-10).map(m => ({
        sender: m.sender,
        text: m.text
      }));

      // Aktuelle Kalorien- und Mahlzeiten-Daten für heute zusammenstellen
      const todayMeals = currentDailyLog?.meals || [];
      const consumedKcal = todayMeals.reduce((acc, m) => acc + (m.kcal || 0), 0);
      const targetKcal = userSettings?.target_kcal || 2000;
      const remainingKcal = targetKcal - consumedKcal;

      const todaySummary = {
        remainingKcal,
        consumedKcal,
        meals: todayMeals.map(m => ({
          category: m.category,
          name: m.name,
          amount_g: m.amount_g,
          kcal: m.kcal,
          protein: m.protein,
          carbs: m.carbs,
          fat: m.fat
        }))
      };

      const aiResponse = await chatWithAiCoach(
        geminiApiKey,
        historyContext,
        {
          user_name: userSettings?.user_name || 'Nutzer',
          target_kcal: targetKcal
        },
        todaySummary
      );

      // Extrahiere eventuelle [[ADD_MEAL: ...]] Blöcke
      let cleanText = aiResponse;
      const addMealRegex = /\[\[ADD_MEAL:\s*({.*?})\s*\]\]/g;
      const mealsToAdd: Meal[] = [];
      let match;

      // Wir parsen alle Blöcke
      while ((match = addMealRegex.exec(aiResponse)) !== null) {
        try {
          const mealData = JSON.parse(match[1]);
          if (mealData && mealData.name) {
            const now = new Date();
            const timestampStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
            const newMeal: Meal = {
              id: `${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
              name: mealData.name,
              amount_g: Number(mealData.amount_g) || 100,
              kcal: Number(mealData.kcal) || 0,
              carbs: Number(mealData.carbs) || 0,
              protein: Number(mealData.protein) || 0,
              fat: Number(mealData.fat) || 0,
              timestamp: mealData.timestamp || timestampStr,
              category: mealData.category || 'breakfast'
            };
            mealsToAdd.push(newMeal);
          }
        } catch (e) {
          console.error("Fehler beim Parsen des Mahlzeiten-Eintrags von der KI:", e);
        }
      }

      // Lösche die JSON-Blöcke aus dem ausgegebenen Text
      cleanText = cleanText.replace(/\[\[ADD_MEAL:\s*({.*?})\s*\]\]/g, '').trim();

      // Speichere gefundene Mahlzeiten in der Datenbank
      if (mealsToAdd.length > 0) {
        const log = await getOrCreateDailyLog(currentDateStr);
        const updatedMeals = [...(log.meals || []), ...mealsToAdd];
        await db.daily_log.update(currentDateStr, { meals: updatedMeals });
      }

      // Falls die Antwort nach Entfernen der Blöcke leer ist, setzen wir eine Standardbestätigung
      if (!cleanText) {
        cleanText = "Ich habe die Einträge erfolgreich für dich hinzugefügt!";
      }

      const aiMsg: ChatMessage = {
        id: `${Date.now()}-ai`,
        sender: 'ai',
        text: cleanText,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, aiMsg]);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Hoppla, bei der Verbindung mit Nico ist ein Fehler aufgetreten. Bitte überprüfe deine Internetverbindung und deinen API-Key.');
    } finally {
      setLoading(false);
    }
  };

  // Chatverlauf löschen
  const handleClearChat = () => {
    const confirmClear = window.confirm('Möchtest du das Gespräch mit Coach Nico wirklich zurücksetzen?');
    if (!confirmClear) return;

    const name = userSettings?.user_name || 'Nutzer';
    const welcomeMsg: ChatMessage = {
      id: 'welcome',
      sender: 'ai',
      text: `Gespräch zurückgesetzt. Wie kann ich dir heute helfen, ${name}?`,
      timestamp: new Date()
    };
    setMessages([welcomeMsg]);
    localStorage.removeItem('nozio_coach_chat');
  };

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] pb-4">
      
      {/* Header */}
      <div className="flex items-center justify-between p-3.5 bg-zinc-900 border border-zinc-800 rounded-2xl shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <div className="p-2.5 bg-emerald-950 text-emerald-400 rounded-xl">
              <Bot className="w-5 h-5" />
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-zinc-900 rounded-full"></div>
          </div>
          <div>
            <h2 className="text-sm font-bold text-zinc-100 flex items-center gap-1.5">
              Coach Nico
              <span className="text-[9px] bg-emerald-950 text-emerald-400 px-1 py-0.5 rounded uppercase font-extrabold tracking-wider">Ernährungsberater</span>
            </h2>
            <p className="text-[10px] text-zinc-500">Dein intelligenter Nozio-Begleiter</p>
          </div>
        </div>

        <button
          onClick={handleClearChat}
          className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-950/20 rounded-xl transition-all"
          title="Gespräch löschen"
        >
          <Trash2 className="w-4.5 h-4.5" />
        </button>
      </div>

      {/* API Key Warnung */}
      {!geminiApiKey && (
        <div className="mt-3 p-4 bg-amber-950/40 border border-amber-900/50 rounded-2xl flex flex-col gap-2 shrink-0">
          <div className="flex items-start gap-2.5 text-amber-200 text-xs leading-normal">
            <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <p>
              <strong>Google API-Key fehlt!</strong> Nico benötigt einen API-Key, um deine Fragen zu beantworten. Bitte trage deinen Key in den Einstellungen ein.
            </p>
          </div>
          <button
            onClick={onNavigateToSettings}
            className="w-full py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5"
          >
            Zu den Einstellungen <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Chat Thread */}
      <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
        {messages.map((msg) => {
          const isAi = msg.sender === 'ai';
          return (
            <div
              key={msg.id}
              className={`flex items-start gap-2.5 max-w-[85%] ${
                isAi ? 'self-start' : 'self-end flex-row-reverse ml-auto'
              }`}
            >
              {/* Avatar */}
              <div className={`p-1.5 rounded-lg shrink-0 ${
                isAi ? 'bg-emerald-950 text-emerald-400' : 'bg-zinc-800 text-zinc-300'
              }`}>
                {isAi ? <Bot className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
              </div>

              {/* Message Bubble */}
              <div className={`p-3.5 rounded-2xl text-xs leading-relaxed ${
                isAi 
                  ? 'bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-tl-sm shadow-sm w-full' 
                  : 'bg-emerald-600 text-white rounded-tr-sm shadow-md shadow-emerald-950/20'
              }`}>
                {/* Zeilenumbrüche und einfache Markdown-Strukturen rendern */}
                <div className="space-y-1">
                  {renderFormattedMessage(msg.text)}
                </div>
                <span className={`text-[9px] block text-right mt-1.5 ${
                  isAi ? 'text-zinc-500' : 'text-emerald-200'
                }`}>
                  {msg.timestamp.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          );
        })}

        {/* Ladeanzeige (KI schreibt...) */}
        {loading && (
          <div className="flex items-start gap-2.5 max-w-[80%] self-start">
            <div className="p-1.5 rounded-lg shrink-0 bg-emerald-950 text-emerald-400">
              <Bot className="w-3.5 h-3.5 animate-bounce" />
            </div>
            <div className="p-3 bg-zinc-900 border border-zinc-800 text-zinc-400 text-xs rounded-2xl rounded-tl-sm flex items-center gap-2">
              <span className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
              </span>
              <span>Nico formuliert eine Antwort...</span>
            </div>
          </div>
        )}

        {/* Fehlermeldung */}
        {error && (
          <div className="p-3 bg-red-950/40 border border-red-900/50 rounded-2xl flex items-start gap-2 text-red-200 text-xs">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <p>{error}</p>
          </div>
        )}

        <div ref={threadEndRef} />
      </div>

      {/* Input Form */}
      <form onSubmit={handleSend} className="flex gap-2 shrink-0 pt-2 border-t border-zinc-800/40">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={loading || !geminiApiKey}
          placeholder={geminiApiKey ? "Stelle Nico eine Frage zu Ernährung..." : "Bitte API-Key in Einstellungen eintragen..."}
          className="flex-1 px-4 py-3.5 bg-zinc-900 border border-zinc-800 rounded-2xl text-zinc-100 text-xs focus:outline-none focus:border-emerald-500 placeholder-zinc-500 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={loading || !input.trim() || !geminiApiKey}
          className="px-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-2xl transition-all shadow-lg shadow-emerald-950/20 flex items-center justify-center cursor-pointer"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>

    </div>
  );
}
