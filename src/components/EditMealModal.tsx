import React, { useState, useEffect } from 'react';
import { X, Check, Trash2, AlertCircle } from 'lucide-react';
import { Meal } from '../types';
import { motion } from 'motion/react';

interface EditMealModalProps {
  isOpen: boolean;
  onClose: () => void;
  meal: Meal | null;
  onUpdateMeal: (meal: Meal) => void;
  onDeleteMeal: (mealId: string) => void;
}

export default function EditMealModal({
  isOpen,
  onClose,
  meal,
  onUpdateMeal,
  onDeleteMeal
}: EditMealModalProps) {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState<number>(100);
  const [kcal, setKcal] = useState<number>(0);
  const [carbs, setCarbs] = useState<number>(0);
  const [protein, setProtein] = useState<number>(0);
  const [fat, setFat] = useState<number>(0);
  const [category, setCategory] = useState<'breakfast' | 'lunch' | 'dinner' | 'snack'>('breakfast');
  const [timestamp, setTimestamp] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && meal) {
      setName(meal.name);
      setAmount(meal.amount_g);
      setKcal(meal.kcal);
      setCarbs(meal.carbs);
      setProtein(meal.protein);
      setFat(meal.fat);
      setCategory(meal.category);
      setTimestamp(meal.timestamp || '');
      setError(null);
    }
  }, [isOpen, meal]);

  if (!meal) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Bitte gib einen Namen für das Lebensmittel ein.');
      return;
    }

    onUpdateMeal({
      ...meal,
      name: name.trim(),
      amount_g: Math.max(0, Number(amount) || 0),
      kcal: Math.max(0, Number(kcal) || 0),
      carbs: Math.max(0, Number(carbs) || 0),
      protein: Math.max(0, Number(protein) || 0),
      fat: Math.max(0, Number(fat) || 0),
      category,
      timestamp: timestamp.trim() || meal.timestamp
    });
    onClose();
  };

  const handleDelete = () => {
    if (window.confirm(`Möchtest du "${meal.name}" wirklich aus deinem Tagebuch löschen?`)) {
      onDeleteMeal(meal.id);
      onClose();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-md"
    >
      {/* Background click listener to close */}
      <div className="absolute inset-0" onClick={onClose} />

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 30 }}
        transition={{ type: 'spring', damping: 25, stiffness: 350 }}
        className="relative w-full max-w-md bg-zinc-900/75 backdrop-blur-xl border-t sm:border border-zinc-800/80 rounded-t-[2.5rem] sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden z-10 max-h-[92vh] sm:max-h-[90vh]"
      >
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-zinc-800/60 bg-zinc-950/40">
          <div>
            <h3 className="text-base font-extrabold text-zinc-100 font-display">Speise bearbeiten</h3>
            <p className="text-[10px] text-zinc-500 font-medium">Passe Namen, Kalorien oder Makronährstoffe an</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 rounded-xl transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content & Form */}
        <div className="p-5 overflow-y-auto space-y-4">
          {error && (
            <div className="p-3 bg-red-950/40 border border-red-900/50 rounded-2xl flex items-center gap-2 text-red-200 text-xs">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
              <p>{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Name */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-400">Lebensmittelname</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-zinc-100 text-sm focus:outline-none focus:border-emerald-500 font-medium"
                placeholder="z.B. Vollkornbrot, Banane"
              />
            </div>

            {/* Menge & Kalorien */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-400">Menge (g / ml)</label>
                <input
                  type="number"
                  required
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-zinc-100 text-sm focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-400">Kalorien (kcal)</label>
                <input
                  type="number"
                  required
                  min="0"
                  value={kcal}
                  onChange={(e) => setKcal(Number(e.target.value))}
                  className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-zinc-100 text-sm focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>
            </div>

            {/* Makros */}
            <div className="space-y-2 bg-zinc-950/40 p-4 rounded-2xl border border-zinc-800/60">
              <span className="text-xs font-bold text-zinc-400 block uppercase tracking-wider mb-1">Makronährstoffe (in g)</span>
              
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-amber-500 uppercase tracking-wider block">Kohlenhydrate</label>
                  <input
                    type="number"
                    min="0"
                    value={carbs}
                    onChange={(e) => setCarbs(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-zinc-100 text-sm focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-rose-500 uppercase tracking-wider block">Proteine</label>
                  <input
                    type="number"
                    min="0"
                    value={protein}
                    onChange={(e) => setProtein(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-zinc-100 text-sm focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-sky-500 uppercase tracking-wider block">Fette</label>
                  <input
                    type="number"
                    min="0"
                    value={fat}
                    onChange={(e) => setFat(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-zinc-100 text-sm focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Kategorie & Uhrzeit */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-400">Mahlzeit</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as any)}
                  className="w-full px-3 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-zinc-100 text-xs focus:outline-none focus:border-emerald-500 font-semibold"
                >
                  <option value="breakfast">Frühstück</option>
                  <option value="lunch">Mittagessen</option>
                  <option value="dinner">Abendessen</option>
                  <option value="snack">Snacks & Riegel</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-400">Uhrzeit</label>
                <input
                  type="text"
                  required
                  placeholder="08:00"
                  value={timestamp}
                  onChange={(e) => setTimestamp(e.target.value)}
                  className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-zinc-100 text-sm focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>
            </div>

            {/* Buttons */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={handleDelete}
                className="py-3 px-4 bg-red-950/20 hover:bg-red-950/40 border border-red-900/40 hover:border-red-900 text-red-400 rounded-xl transition-all flex items-center justify-center gap-2 text-xs font-bold"
                title="Löschen"
              >
                <Trash2 className="w-4.5 h-4.5" />
                Löschen
              </button>

              <button
                type="submit"
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold shadow-lg shadow-emerald-950/20 transition-all flex items-center justify-center gap-2 text-sm"
              >
                <Check className="w-4 h-4" />
                Speichern
              </button>
            </div>

          </form>
        </div>

        {/* Footer */}
        <div className="p-4 bg-zinc-950/80 border-t border-zinc-800 text-center text-[10px] text-zinc-500 font-mono">
          Änderungen werden sofort in der lokalen Datenbank gespeichert
        </div>

      </motion.div>
    </motion.div>
  );
}
