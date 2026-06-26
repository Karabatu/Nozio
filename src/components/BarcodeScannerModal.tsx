import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Camera, X, Loader2, AlertCircle, Sparkles } from 'lucide-react';
import { Meal } from '../types';
import { motion } from 'motion/react';

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddMeal: (meal: Omit<Meal, 'id' | 'timestamp'>) => void;
  defaultCategory?: 'breakfast' | 'lunch' | 'dinner' | 'snack';
}

export default function BarcodeScannerModal({ isOpen, onClose, onAddMeal, defaultCategory }: BarcodeScannerModalProps) {
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [productData, setProductData] = useState<any>(null);
  const [amountG, setAmountG] = useState<number>(100);
  const [scannerActive, setScannerActive] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<'breakfast' | 'lunch' | 'dinner' | 'snack'>('breakfast');

  const qrCodeRegionId = "html5qr-code-full-region";
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);

  // Kamera starten
  const startScanner = async () => {
    setError(null);
    setProductData(null);
    setScanResult(null);

    try {
      const html5QrCode = new Html5Qrcode(qrCodeRegionId, {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.ITF
        ],
        verbose: false
      });
      html5QrCodeRef.current = html5QrCode;
      setScannerActive(true);

      await html5QrCode.start(
        { 
          // KEINE width/height-Constraints: iOS Safari wirft sonst OverconstrainedError
          facingMode: "environment"
        },
        {
          fps: 15, // Auf 15fps reduziert für iOS-Performance
          qrbox: { width: 280, height: 110 }, // optimales Rechteck für Barcodes
          aspectRatio: 1.777778, // Widescreen für schärfere Ecken
        },
        (decodedText) => {
          // Erfolg beim Scannen
          setScanResult(decodedText);
          stopScanner();
          fetchProductData(decodedText);
        },
        () => {
          // Fehler beim Scannen (kann ignoriert werden, da kontinuierlich gescannt wird)
        }
      );
    } catch (err: any) {
      console.error("Scanner konnte nicht gestartet werden", err);
      setError("Kamera-Zugriff verweigert oder Scanner-Fehler. Stelle sicher, dass du Kameraberechtigungen erteilt hast.");
      setScannerActive(false);
    }
  };

  // Kamera stoppen
  const stopScanner = async () => {
    if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
      try {
        await html5QrCodeRef.current.stop();
        html5QrCodeRef.current = null;
      } catch (err) {
        console.error("Scanner konnte nicht gestoppt werden", err);
      }
    }
    setScannerActive(false);
  };

  // Open Food Facts API abfragen
  const fetchProductData = async (barcode: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`https://world.openfoodfacts.org/api/v3/product/${barcode}.json`);
      if (!res.ok) {
        throw new Error("Fehler bei der Anfrage an Open Food Facts");
      }
      const data = await res.json();
      
      if (data.status === 'failure' || !data.product) {
        throw new Error("Produkt in der Open Food Facts Datenbank nicht gefunden.");
      }

      const p = data.product;
      const nutriments = p.nutriments || {};

      // Robustes Parsen von Nährwerten (bereinigt Strings und konvertiert ggf. kJ in kcal)
      const parseNutrient = (val: any): number => {
        if (val === undefined || val === null) return 0;
        if (typeof val === 'number') return isNaN(val) ? 0 : val;
        const cleaned = String(val).replace(/[^0-9.]/g, '');
        const parsed = parseFloat(cleaned);
        return isNaN(parsed) ? 0 : parsed;
      };

      const name = (p.product_name_de || p.product_name || p.generic_name || "Unbekanntes Produkt").trim();
      
      // Kalorien ermitteln (bevorzugt direkt kcal, andernfalls aus kJ umrechnen)
      let kcal100g = parseNutrient(nutriments['energy-kcal_100g'] || nutriments['energy-kcal'] || nutriments['energy-kcal_value']);
      if (kcal100g === 0) {
        const energyKj = parseNutrient(nutriments['energy_100g'] || nutriments['energy'] || nutriments['energy_value']);
        if (energyKj > 0) {
          kcal100g = Math.round(energyKj / 4.184);
        }
      } else {
        kcal100g = Math.round(kcal100g);
      }

      const carbs100g = parseNutrient(nutriments.carbohydrates_100g || nutriments.carbohydrates);
      const protein100g = parseNutrient(nutriments.proteins_100g || nutriments.proteins);
      const fat100g = parseNutrient(nutriments.fat_100g || nutriments.fat);

      setProductData({
        name,
        kcal100g,
        carbs100g,
        protein100g,
        fat100g,
        barcode
      });
    } catch (err: any) {
      setError(err.message || "Das Produkt konnte nicht abgerufen werden.");
    } finally {
      setLoading(false);
    }
  };

  // Einbuchen des Produkts mit berechneter Grammzahl
  const handleSave = () => {
    if (!productData) return;

    const factor = amountG / 100;
    onAddMeal({
      name: productData.name,
      amount_g: amountG,
      kcal: Math.round(productData.kcal100g * factor),
      carbs: Math.round(productData.carbs100g * factor),
      protein: Math.round(productData.protein100g * factor),
      fat: Math.round(productData.fat100g * factor),
      category: selectedCategory
    });
    onClose();
  };

  useEffect(() => {
    if (isOpen) {
      setScanResult(null);
      setProductData(null);
      setAmountG(100);
      setError(null);
      setSelectedCategory(defaultCategory || 'breakfast');
      // Verzögerung für den Modal-Aufbau, damit das DOM-Element bereit ist
      const timer = setTimeout(() => {
        startScanner();
      }, 300);
      return () => {
        clearTimeout(timer);
        stopScanner();
      };
    } else {
      stopScanner();
    }
  }, [isOpen]);

  return (
    <motion.div
      id="barcode-modal-container"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md"
    >
      {/* Background click listener to close */}
      <div className="absolute inset-0" onClick={onClose} />

      <motion.div
        id="barcode-modal-content"
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        transition={{ type: 'spring', damping: 25, stiffness: 350 }}
        className="relative w-full max-w-md bg-zinc-900/75 backdrop-blur-xl border border-zinc-800/80 rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] z-10"
      >
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-emerald-500" />
            <h3 className="text-lg font-semibold text-zinc-100">Barcode-Scanner</h3>
          </div>
          <button 
            id="barcode-close-btn"
            onClick={onClose} 
            className="p-1 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 flex-1 overflow-y-auto space-y-4">
          
          {/* Fehlermeldung */}
          {error && (
            <div className="flex items-start gap-3 p-3 bg-red-950/40 border border-red-900/50 rounded-xl text-red-200 text-sm">
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
              <div className="space-y-2">
                <p>{error}</p>
                {!scannerActive && !productData && (
                  <button 
                    onClick={startScanner}
                    className="px-3 py-1 bg-red-900 hover:bg-red-800 text-white rounded-lg text-xs font-medium transition-colors"
                  >
                    Kamera erneut starten
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Scanner-Bereich */}
          {!scanResult && !productData && !loading && (
            <div className="space-y-4">
              <p className="text-center text-zinc-400 text-sm">
                Halte den Barcode eines Lebensmittels zentriert vor die Kamera, um es automatisch zu erfassen.
              </p>
              <div className="relative aspect-video w-full bg-black rounded-xl overflow-hidden border border-zinc-800">
                <div id={qrCodeRegionId} className="w-full h-full"></div>
                {/* Scan-Linie Animation */}
                <div className="absolute inset-x-0 top-1/2 h-0.5 bg-emerald-500 shadow-[0_0_10px_#10b981] animate-pulse"></div>
              </div>
            </div>
          )}

          {/* Ladezustand */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-12 space-y-3">
              <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
              <p className="text-zinc-400 text-sm">Frage Open Food Facts ab...</p>
            </div>
          )}

          {/* Produkt-Ergebnis & Portionseingabe */}
          {productData && (
            <div className="space-y-5">
              <div className="p-4 bg-zinc-800/50 border border-zinc-800 rounded-xl space-y-3">
                <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-semibold uppercase tracking-wider">
                  <Sparkles className="w-3.5 h-3.5" />
                  Produkt gefunden
                </div>
                <h4 className="text-lg font-medium text-zinc-100">{productData.name}</h4>
                <p className="text-xs text-zinc-500 font-mono">EAN: {productData.barcode}</p>

                {/* Nährwerte pro 100g */}
                <div className="grid grid-cols-4 gap-2 pt-2 text-center border-t border-zinc-800">
                  <div className="bg-zinc-900/50 p-2 rounded-lg">
                    <div className="text-xs text-zinc-500 font-medium">Kalorien</div>
                    <div className="text-sm font-bold text-zinc-200">{productData.kcal100g} kcal</div>
                    <div className="text-[10px] text-zinc-600">pro 100g</div>
                  </div>
                  <div className="bg-zinc-900/50 p-2 rounded-lg">
                    <div className="text-xs text-zinc-500 font-medium">Carbs</div>
                    <div className="text-sm font-bold text-amber-500">{productData.carbs100g.toFixed(1)}g</div>
                    <div className="text-[10px] text-zinc-600 font-mono">50%</div>
                  </div>
                  <div className="bg-zinc-900/50 p-2 rounded-lg">
                    <div className="text-xs text-zinc-500 font-medium">Protein</div>
                    <div className="text-sm font-bold text-rose-500">{productData.protein100g.toFixed(1)}g</div>
                    <div className="text-[10px] text-zinc-600 font-mono">30%</div>
                  </div>
                  <div className="bg-zinc-900/50 p-2 rounded-lg">
                    <div className="text-xs text-zinc-500 font-medium">Fat</div>
                    <div className="text-sm font-bold text-sky-500">{productData.fat100g.toFixed(1)}g</div>
                    <div className="text-[10px] text-zinc-600 font-mono">20%</div>
                  </div>
                </div>
              </div>

              {/* Mahlzeiten-Kategorie Vorauswahl */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-zinc-400">Zu welcher Mahlzeit hinzufügen?</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {(['breakfast', 'lunch', 'dinner', 'snack'] as const).map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSelectedCategory(cat)}
                      className={`py-1.5 px-1 text-center rounded-lg text-xs font-semibold border transition-colors capitalize ${
                        selectedCategory === cat
                          ? 'bg-emerald-950/40 border-emerald-500 text-emerald-400'
                          : 'bg-zinc-800/40 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      {cat === 'breakfast' ? 'Frühstück' : cat === 'lunch' ? 'Mittag' : cat === 'dinner' ? 'Abend' : 'Snack'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Portion eingeben */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-zinc-300">Portionsgröße (in Gramm)</label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    value={amountG}
                    onChange={(e) => setAmountG(Math.max(1, Number(e.target.value) || 0))}
                    className="flex-1 px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-zinc-100 font-semibold focus:outline-none focus:border-emerald-500"
                    placeholder="z.B. 150"
                  />
                  <span className="text-zinc-400 font-medium text-lg">g</span>
                </div>
                
                {/* Berechnete Werte für Portion */}
                <div className="flex items-center justify-between p-3 bg-zinc-950/50 rounded-xl border border-zinc-800/80 text-sm">
                  <span className="text-zinc-400">Portionswert:</span>
                  <span className="font-bold text-emerald-400">
                    {Math.round(productData.kcal100g * (amountG / 100))} kcal
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-zinc-950/80 border-t border-zinc-800 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl font-medium transition-colors"
          >
            Abbrechen
          </button>
          
          {productData ? (
            <button
              onClick={handleSave}
              className="flex-1 px-4 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-semibold shadow-lg shadow-emerald-950/30 transition-colors"
            >
              Hinzufügen
            </button>
          ) : (
            <button
              onClick={startScanner}
              disabled={scannerActive}
              className="flex-1 px-4 py-3 bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 text-zinc-200 rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
            >
              <Camera className="w-4 h-4" />
              Scanner starten
            </button>
          )}
        </div>

      </motion.div>
    </motion.div>
  );
}
