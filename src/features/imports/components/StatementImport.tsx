import { useRef, useState } from 'react';
import {
  accountLabel,
  CARD_NETWORKS,
  useAccounts,
  type Account,
  type AccountFormInput,
} from '@/features/accounts';
import { useCategories } from '@/features/categories';
import { accountDefaultsFromHint, accountsToMatchable, isResidualHint, matchAccount } from '@/lib/account-match';
import { IngestaError, type StatementAccountHint } from '@/lib/ingesta';
import { useConfirmImport, useFindExistingHashes, useParseStatement } from '../hooks';
import {
  buildStagingModel,
  countSelected,
  toImportRows,
  type EditableRow,
  type StagingModel,
} from '../staging';
import { AccountQuickCreate } from './AccountQuickCreate';
import { StagingRow } from './StagingRow';

/** Mapea las pistas del resumen a los valores iniciales del alta de medios (B7). */
function defaultsFromHint(hint: StatementAccountHint): Partial<AccountFormInput> {
  const base = accountDefaultsFromHint(hint);
  const network = (CARD_NETWORKS as readonly string[]).includes(base.network) ? base.network : '';
  return {
    name: base.name,
    bank: base.bank,
    network: network as AccountFormInput['network'],
    last4: base.last4,
    holderName: base.holderName,
    holderKind: 'name', // del resumen sale un nombre, no un miembro de la app
    type: 'credit', // los resúmenes son de tarjetas de crédito
  };
}

interface StatementImportProps {
  workspaceId: string;
}

function parseErrorMessage(err: unknown): string {
  if (err instanceof IngestaError) {
    if (err.status === 401) return 'Sesión inválida para el servicio de ingesta. Reingresá y reintentá.';
    if (err.status === 422)
      return 'No pudimos leer el resumen: contraseña incorrecta o formato no soportado (por ahora: Banco Patagonia Visa/Master).';
    if (!err.status) return err.message; // falta URL del micro / red
    return `El servicio respondió ${err.status}.`;
  }
  return err instanceof Error ? err.message : 'No se pudo procesar el resumen.';
}

/** Flujo de importación de resumen: subir PDF → revisar → confirmar en bloque (FR-16). */
export function StatementImport({ workspaceId }: StatementImportProps) {
  const { data: accounts } = useAccounts(workspaceId);
  const { data: categories } = useCategories(workspaceId);
  const parseStatement = useParseStatement();
  const findExistingHashes = useFindExistingHashes(workspaceId);
  const confirmImport = useConfirmImport(workspaceId);

  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState('');
  const [model, setModel] = useState<StagingModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<number | null>(null);
  /** Índices de tarjetas con el "crear medio" inline abierto (FR-16b). Las que no
   * matchean con un medio existente arrancan abiertas para crearlo directamente. */
  const [createOpen, setCreateOpen] = useState<ReadonlySet<number>>(new Set());
  // Guards anti doble-submit (BUG-9): evitan disparar dos parseos/importaciones con un
  // doble click rápido antes de que React refleje `disabled`.
  const parsingRef = useRef(false);
  const confirmingRef = useRef(false);

  function toggleCreate(cardIdx: number, open?: boolean) {
    setCreateOpen((prev) => {
      const next = new Set(prev);
      const shouldOpen = open ?? !next.has(cardIdx);
      if (shouldOpen) next.add(cardIdx);
      else next.delete(cardIdx);
      return next;
    });
  }

  const expenseCategories = (categories ?? []).filter((c) => c.kind === 'expense');

  async function handleParse() {
    if (parsingRef.current) return;
    if (!file) {
      setError('Elegí un archivo PDF del resumen.');
      return;
    }
    parsingRef.current = true;
    setError(null);
    setDone(null);
    try {
      const result = await parseStatement.mutateAsync({ file, password: password || undefined });
      // Calcular hashes (1ra pasada) y marcar los que ya existen en la DB (FR-17).
      const draft = buildStagingModel(result);
      const hashes = draft.cards.flatMap((c) => c.rows.map((r) => r.externalHash));
      const existing = await findExistingHashes.mutateAsync(hashes);
      // Precargar categoría sugerida por comercio (F2-6) — solo gastos.
      const built = buildStagingModel(result, existing, expenseCategories);
      // Asociar cada tarjeta al medio que matchea (F2-5, FR-16b); si no hay, queda en ''.
      const matchable = accountsToMatchable(accounts ?? []);
      const open = new Set<number>();
      built.cards.forEach((card, i) => {
        // Sección de impuestos/cargos al pie (BUG-5): no es una tarjeta, no lleva medio.
        if (isResidualHint(card.accountHint)) return;
        const { matched } = matchAccount(card.accountHint, matchable);
        if (matched) card.accountId = matched.id;
        // Tarjeta sin medio existente → abrir el alta directamente con los datos del resumen.
        else open.add(i);
      });
      setCreateOpen(open);
      setModel(built);
    } catch (err) {
      setError(parseErrorMessage(err));
    } finally {
      parsingRef.current = false;
    }
  }

  /** Tras crear un medio inline, asociarlo a esa tarjeta y cerrar el form. */
  function handleAccountCreated(cardIdx: number, account: Account) {
    setCardAccount(cardIdx, account.id);
    toggleCreate(cardIdx, false);
  }

  function patchRow(cardIdx: number, rowId: string, patch: Partial<EditableRow>) {
    setModel((prev) => {
      if (!prev) return prev;
      const cards = prev.cards.map((card, i) =>
        i !== cardIdx
          ? card
          : { ...card, rows: card.rows.map((r) => (r.id === rowId ? { ...r, ...patch } : r)) },
      );
      return { ...prev, cards };
    });
  }

  function setCardAccount(cardIdx: number, accountId: string) {
    setModel((prev) =>
      prev
        ? { ...prev, cards: prev.cards.map((c, i) => (i === cardIdx ? { ...c, accountId } : c)) }
        : prev,
    );
    // Si eligió un medio existente, cerramos el alta inline de esa tarjeta.
    if (accountId) toggleCreate(cardIdx, false);
  }

  async function handleConfirm() {
    if (confirmingRef.current || !model || !file) return;
    const rows = toImportRows(model);
    if (rows.length === 0) {
      setError('No hay movimientos seleccionados para importar.');
      return;
    }
    confirmingRef.current = true;
    setError(null);
    try {
      const created = await confirmImport.mutateAsync({
        file,
        rows,
        chargedOn: model.statementCloseOn,
      });
      setDone(created);
      setModel(null);
      setFile(null);
      setPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron crear los movimientos.');
    } finally {
      confirmingRef.current = false;
    }
  }

  const selected = model ? countSelected(model) : 0;
  const dupCount = model
    ? model.cards.reduce((acc, c) => acc + c.rows.filter((r) => r.duplicate).length, 0)
    : 0;

  return (
    <div className="space-y-4">
      {error && <p className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">{error}</p>}
      {done !== null && (
        <p className="rounded-md bg-primary/10 p-2 text-sm">
          Se importaron {done} movimiento{done === 1 ? '' : 's'}. ✅
        </p>
      )}

      {!model && (
        <div className="space-y-3 rounded-md border border-border p-4">
          <div className="space-y-1">
            <label htmlFor="stmt-file" className="text-sm font-medium">
              Resumen (PDF)
            </label>
            <input
              id="stmt-file"
              type="file"
              accept="application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="w-full text-sm"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="stmt-pass" className="text-sm font-medium">
              Contraseña (si el PDF está protegido)
            </label>
            <input
              id="stmt-pass"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <button
            type="button"
            onClick={handleParse}
            disabled={parseStatement.isPending || findExistingHashes.isPending}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {parseStatement.isPending || findExistingHashes.isPending
              ? 'Leyendo resumen…'
              : 'Cargar y revisar'}
          </button>
        </div>
      )}

      {model && dupCount > 0 && (
        <p className="rounded-md bg-muted p-2 text-sm text-muted-foreground">
          {dupCount} movimiento{dupCount === 1 ? '' : 's'} ya {dupCount === 1 ? 'estaba' : 'estaban'}{' '}
          importado{dupCount === 1 ? '' : 's'}: {dupCount === 1 ? 'quedó destildado' : 'quedaron destildados'} (podés re-tildarlos para forzar el alta).
        </p>
      )}

      {model &&
        model.cards.map((card, cardIdx) => {
          // Impuestos/cargos al pie (BUG-5): no es una tarjeta, no se le asigna medio.
          const isResidual = isResidualHint(card.accountHint);
          return (
          <div key={cardIdx} className="space-y-2 rounded-md border border-border p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm">
                <span className="font-medium">
                  {isResidual ? 'Impuestos y otros cargos del resumen' : card.accountHint.holder ?? 'Tarjeta'}
                </span>{' '}
                <span className="text-muted-foreground">
                  {[card.accountHint.bank, card.accountHint.network, card.accountHint.last4 && `••${card.accountHint.last4}`]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </div>
              {!isResidual && (
                <div className="flex items-center gap-2">
                  <select
                    value={card.accountId}
                    onChange={(e) => setCardAccount(cardIdx, e.target.value)}
                    className="rounded-md border border-input bg-background px-2 py-1 text-sm"
                    aria-label="Medio para esta tarjeta"
                  >
                    <option value="">Sin medio</option>
                    {(accounts ?? []).map((a) => (
                      <option key={a.id} value={a.id}>
                        {accountLabel({ ...a, holderName: a.holder_name })}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => toggleCreate(cardIdx)}
                    className="rounded-md border border-input px-2 py-1 text-sm font-medium hover:bg-accent"
                  >
                    {createOpen.has(cardIdx) ? 'Cerrar' : '+ Crear medio'}
                  </button>
                </div>
              )}
            </div>
            {isResidual && (
              <p className="text-xs text-muted-foreground">
                Cargos del resumen (impuestos, sellos, IVA…): se importan sin medio.
              </p>
            )}
            {!isResidual && !card.accountId && !createOpen.has(cardIdx) && (
              <p className="text-xs text-muted-foreground">
                No encontramos un medio para esta tarjeta. Elegí uno o crealo con los datos del resumen.
              </p>
            )}
            {!isResidual && createOpen.has(cardIdx) && (
              <AccountQuickCreate
                workspaceId={workspaceId}
                title="Crear medio detectado en el resumen"
                defaults={defaultsFromHint(card.accountHint)}
                accounts={accounts ?? []}
                onCreated={(account) => handleAccountCreated(cardIdx, account)}
                onCancel={() => toggleCreate(cardIdx, false)}
              />
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr>
                    <th className="px-2 py-1">✓</th>
                    <th className="px-2 py-1">Fecha</th>
                    <th className="px-2 py-1">Descripción</th>
                    <th className="px-2 py-1 text-right">Monto</th>
                    <th className="px-2 py-1">Categoría</th>
                  </tr>
                </thead>
                <tbody>
                  {card.rows.map((row) => (
                    <StagingRow
                      key={row.id}
                      row={row}
                      categories={expenseCategories}
                      onChange={(patch) => patchRow(cardIdx, row.id, patch)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          );
        })}

      {model && (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleConfirm}
            disabled={confirmImport.isPending || selected === 0}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {confirmImport.isPending
              ? 'Importando…'
              : `Confirmar e importar ${selected} movimiento${selected === 1 ? '' : 's'}`}
          </button>
          <button
            type="button"
            onClick={() => {
              setModel(null);
              setError(null);
            }}
            className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            Cancelar
          </button>
        </div>
      )}
    </div>
  );
}
