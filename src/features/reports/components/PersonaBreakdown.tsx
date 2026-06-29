import { useState } from 'react';
import { Check, Pencil, X } from 'lucide-react';
import { formatAmount } from '@/features/transactions/format';
import type { PersonaSpending } from '../aggregate';
import { chartColor } from './chartColors';

/** Edición de apodos (MEJ-8): mostrar el apodo y guardarlo/quitarlo por `personaKey`. */
export interface PersonaAliasing {
  /** Nombre a mostrar para esa persona (apodo si hay, si no el real). */
  labelFor: (key: string, baseLabel: string) => string;
  onSave: (key: string, alias: string) => void;
  onClear: (key: string) => void;
}

interface PersonaBreakdownProps {
  people: PersonaSpending[];
  baseCurrency: string;
  /** Si se pasa, cada persona muestra un control para ponerle un apodo privado (MEJ-8). */
  aliasing?: PersonaAliasing;
}

/**
 * Detalle del gasto por persona (FR-22): cuánto y qué % del total aporta cada una, y en
 * qué categoría gastó mayormente ("mayormente en Super" / "varios"). Acompaña al donut
 * (mismo orden y color que sus porciones). Con `aliasing` (MEJ-8) permite ponerle a cada
 * persona un apodo privado, editable inline.
 */
export function PersonaBreakdown({ people, baseCurrency, aliasing }: PersonaBreakdownProps) {
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  if (people.length === 0) {
    return <p className="text-sm text-muted-foreground">Sin gastos en el período.</p>;
  }

  function startEdit(key: string, current: string) {
    setEditingKey(key);
    setDraft(current);
  }

  function commit(key: string) {
    const value = draft.trim();
    if (value) aliasing?.onSave(key, value);
    else aliasing?.onClear(key);
    setEditingKey(null);
  }

  return (
    <ul className="space-y-1 text-sm">
      {people.map((person, index) => {
        const display = aliasing ? aliasing.labelFor(person.key, person.holder) : person.holder;
        const isEditing = editingKey === person.key;
        return (
          <li key={person.key} className="flex flex-wrap items-baseline justify-between gap-x-2">
            <span className="flex items-center gap-2 font-medium">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: chartColor(index) }}
                aria-hidden
              />
              {isEditing ? (
                <span className="flex items-center gap-1">
                  <input
                    type="text"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commit(person.key);
                      if (e.key === 'Escape') setEditingKey(null);
                    }}
                    autoFocus
                    aria-label={`Apodo para ${person.holder}`}
                    placeholder={person.holder}
                    className="w-28 rounded border border-input bg-background px-1.5 py-0.5 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => commit(person.key)}
                    aria-label="Guardar apodo"
                    className="text-primary hover:opacity-80"
                  >
                    <Check className="h-4 w-4" aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingKey(null)}
                    aria-label="Cancelar"
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" aria-hidden />
                  </button>
                </span>
              ) : (
                <>
                  {display}{' '}
                  <span className="text-muted-foreground">· {Math.round(person.share * 100)}%</span>
                  {aliasing && (
                    <button
                      type="button"
                      onClick={() => startEdit(person.key, display === person.holder ? '' : display)}
                      aria-label={`Ponerle un apodo a ${person.holder}`}
                      title="Apodo (solo lo ves vos)"
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <Pencil className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  )}
                </>
              )}
            </span>
            <span className="text-xs text-muted-foreground">
              {formatAmount(person.expense, baseCurrency)} ·{' '}
              {person.mainLabel === 'Varios' ? 'varios' : `mayormente en ${person.mainLabel}`}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
