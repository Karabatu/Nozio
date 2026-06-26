import { Meal } from '../types';

interface GeminiTrackResult {
  name: string;
  amount_g: number;
  kcal: number;
  carbs: number;
  protein: number;
  fat: number;
}

// Hilfsfunktion zum Aufruf der Gemini-API für Lebensmittel-Erkennung
export async function trackFoodWithGemini(
  apiKey: string,
  textInput: string,
  base64Image?: { mimeType: string; data: string }
): Promise<Meal[]> {
  if (!apiKey) {
    throw new Error('Kein API-Schlüssel hinterlegt. Bitte trage deinen Google AI Studio API-Key in den Einstellungen ein.');
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`;

  const systemInstruction = 
    "Du bist ein hochpräziser Ernährungsberater und Daten-Parser. Analysiere das Bild oder den Freitext des Nutzers penibel. " +
    "Schätze die Grammanzahl realistisch und berechne die Nährwerte (Kalorien, Kohlenhydrate, Proteine, Fette) für jedes erkannte Lebensmittel. " +
    "Du darfst in deiner Antwort KEINERLEI normalen Text, keine Erklärungen und keine Markdown-Code-Blöcke (wie ```json) verwenden. " +
    "Antworte AUSSCHLIESSLICH mit einem validen, minifizierten JSON-Array in exakt diesem Format:\n" +
    "[{\"name\": \"Lebensmittelname\", \"amount_g\": 100, \"kcal\": 150, \"carbs\": 20, \"protein\": 15, \"fat\": 4}]";

  const userParts: any[] = [];

  // Wenn ein Bild vorhanden ist, fügen wir es den Teilen hinzu
  if (base64Image) {
    userParts.push({
      inlineData: {
        mimeType: base64Image.mimeType,
        data: base64Image.data
      }
    });
  }

  // Text-Eingabe (oder Standard-Eingabeaufforderung für Bild)
  userParts.push({
    text: textInput || "Analysiere diese Mahlzeit auf dem Foto und schätze die Nährwerte."
  });

  const requestBody = {
    contents: [
      {
        role: "user",
        parts: userParts
      }
    ],
    systemInstruction: {
      parts: [
        {
          text: systemInstruction
        }
      ]
    },
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.2
    }
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData?.error?.message || `HTTP Fehler ${response.status}`;
      throw new Error(errorMessage);
    }

    const responseData = await response.json();
    const generatedText = responseData?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';

    if (!generatedText) {
      throw new Error('Die KI hat eine leere Antwort zurückgegeben.');
    }

    // JSON parsen und in Meal-Struktur umwandeln
    // Die KI könnte Markdown backticks mitsenden, obwohl wir es verboten haben (Sicherheitsbereinigung)
    let cleanedJson = generatedText;
    if (cleanedJson.includes('```json')) {
      cleanedJson = cleanedJson.split('```json')[1].split('```')[0].trim();
    } else if (cleanedJson.includes('```')) {
      cleanedJson = cleanedJson.split('```')[1].split('```')[0].trim();
    }

    const items: GeminiTrackResult[] = JSON.parse(cleanedJson);
    
    if (!Array.isArray(items)) {
      throw new Error('Das Antwortformat ist kein Array.');
    }

    const now = new Date();
    const timestampStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    return items.map((item, idx) => ({
      id: `${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 4)}`,
      name: item.name || 'Unbekanntes Lebensmittel',
      amount_g: Math.max(1, Number(item.amount_g) || 100),
      kcal: Math.max(0, Math.round(Number(item.kcal) || 0)),
      carbs: Math.max(0, Math.round(Number(item.carbs) || 0)),
      protein: Math.max(0, Math.round(Number(item.protein) || 0)),
      fat: Math.max(0, Math.round(Number(item.fat) || 0)),
      timestamp: timestampStr,
      category: 'breakfast' // Standardmäßig, kann der Nutzer im Dialog anpassen
    }));

  } catch (error: any) {
    console.error('Gemini API Fehler:', error);
    throw error;
  }
}

// Hilfsfunktion für den AI Coach Chatbot (multi-turn Gespräch)
export async function chatWithAiCoach(
  apiKey: string,
  history: { sender: 'user' | 'ai'; text: string }[],
  userSettings: { user_name: string; target_kcal: number },
  todaySummary?: {
    remainingKcal: number;
    consumedKcal: number;
    meals: { category: string; name: string; amount_g: number; kcal: number; protein: number; carbs: number; fat: number }[];
  }
): Promise<string> {
  if (!apiKey) {
    throw new Error('Kein API-Schlüssel hinterlegt. Bitte trage deinen Google AI Studio API-Key in den Einstellungen ein.');
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`;

  let systemInstruction = 
    `Du bist Nozio Coach "Nico", ein hochkompetenter, empathischer und zertifizierter Ernährungsberater, Fitness-Coach und Motivator für die App **Nozio** (nicht YAZIO, nicht NutriAI). ` +
    `Dein Ziel ist es, den Nutzer namens "${userSettings.user_name}" optimal bei seiner Ernährung und Fitness zu unterstützen. ` +
    `Sein tägliches Kalorienziel liegt bei ${userSettings.target_kcal} kcal. `;

  if (todaySummary) {
    systemInstruction += 
      `\n\nAKTUELLE DATEN FÜR HEUTE:\n` +
      `- Bereits konsumiert: ${todaySummary.consumedKcal} kcal\n` +
      `- NOCH OFFENER KALORIENBEDARF: ${todaySummary.remainingKcal} kcal. Nutze diesen offenen Kalorienbedarf als Basis für alle deine Empfehlungen und Entscheidungen!\n` +
      `- Bereits gegessen:\n` +
      (todaySummary.meals.length > 0 
        ? todaySummary.meals.map(m => `  * [${m.category}] ${m.name} (${m.amount_g}g, ${m.kcal} kcal, P: ${m.protein}g, KH: ${m.carbs}g, F: ${m.fat}g)`).join('\n')
        : `  * Noch keine Einträge für heute vorhanden.`) + 
      `\n\n`;
  }

  systemInstruction +=
    `ANTWORT-RICHTLINIEN:\n` +
    `1. Antworte immer extrem kurz, prägnant, freundlich, motivierend, fachlich präzise und übersichtlich auf Deutsch.\n` +
    `2. Verwende kurze Absätze und Bulletpoints für Rezepte oder Tipps, um die Lesbarkeit auf Mobilgeräten zu maximieren.\n` +
    `3. Nutze den noch offenen Kalorienbedarf des Nutzers aktiv als Basis für Empfehlungen. Wenn der Nutzer hungrig ist, empfehle Snacks oder Mahlzeiten, die perfekt in sein verbleibendes Kalorienbudget passen.\n` +
    `4. Wenn der Nutzer dich bittet, ein Lebensmittel, eine Zutat oder eine Mahlzeit einzutragen oder hinzuzufügen (z.B. "trage zum Frühstück 2 Eier ein" oder "füge 50g Haferflocken als Snack hinzu"), dann befolge das und hänge am Ende deiner Antwort für jedes einzutragende Lebensmittel exakt einen JSON-Block in folgendem Format an:\n` +
    `[[ADD_MEAL: {"category": "breakfast" | "lunch" | "dinner" | "snack", "name": "Lebensmittelname", "amount_g": 100, "kcal": 150, "carbs": 20, "protein": 15, "fat": 4}]]\n` +
    `Du kannst auch mehrere Blöcke anhängen, falls mehrere Lebensmittel eingetragen werden sollen. Schätze die Nährwerte (Kcal, Carbs, Protein, Fat) basierend auf deinen wissenschaftlichen Erkenntnissen für die angegebene Menge realistisch ab. Antworte dem Nutzer kurz und bestätige, dass du das eingetragen hast.\n` +
    `5. Wenn der Nutzer nach einer Übersicht fragt, was er heute gegessen hat ("was habe ich heute gegessen?"), liste die Einträge übersichtlich auf und gib ein kurzes, prägnantes Feedback, was schlau war (z.B. proteinreich) und was er verbessern kann, inklusive gesunder, proteinreicher Alternativen.\n` +
    `WICHTIG: Formuliere deine textlichen Antworten immer vollständig aus. Breche niemals mitten im Satz oder unvollständig ab. Der JSON-Block [[ADD_MEAL: ...]] darf nur am Ende stehen.`;

  // Historie in das Gemini REST API Format umwandeln und bereinigen.
  // Gemini verlangt, dass die Rollen strikt abwechseln (user -> model -> user -> model...)
  // und dass das Gespräch mit einer 'user'-Nachricht beginnt.
  const sanitizedHistory: { role: 'user' | 'model'; parts: { text: string }[] }[] = [];

  for (const msg of history) {
    const role = msg.sender === 'user' ? 'user' : 'model';
    if (sanitizedHistory.length > 0 && sanitizedHistory[sanitizedHistory.length - 1].role === role) {
      // Wenn der vorherige Sender derselbe war, führen wir die Texte zusammen
      sanitizedHistory[sanitizedHistory.length - 1].parts[0].text += '\n\n' + msg.text;
    } else {
      sanitizedHistory.push({
        role,
        parts: [{ text: msg.text }]
      });
    }
  }

  // Sicherstellen, dass die Historie mit 'user' beginnt
  while (sanitizedHistory.length > 0 && sanitizedHistory[0].role !== 'user') {
    sanitizedHistory.shift();
  }

  // Falls danach kein Inhalt übrig ist, fügen wir eine Fallback-Eingabe hinzu
  if (sanitizedHistory.length === 0) {
    sanitizedHistory.push({
      role: 'user',
      parts: [{ text: 'Hallo Nico!' }]
    });
  }

  const requestBody = {
    contents: sanitizedHistory,
    systemInstruction: {
      parts: [{ text: systemInstruction }]
    },
    generationConfig: {
      temperature: 0.7
    }
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData?.error?.message || `HTTP Fehler ${response.status}`;
      throw new Error(errorMessage);
    }

    const responseData = await response.json();
    return responseData?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || 
      'Entschuldigung, ich konnte das nicht verarbeiten. Bitte versuche es erneut.';
  } catch (error: any) {
    console.error('Gemini Coach Fehler:', error);
    throw error;
  }
}
