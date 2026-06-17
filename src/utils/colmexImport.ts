import type { AppData, Trade, TradeEntry, TradeExit } from '../types/trade';

// ── Colmex Pro CSV import ───────────────────────────────────────────────────────
// Colmex Pro exports a flat trade-history CSV (one execution per row):
//   Date,Currency,Side,Symbol,Quantity,Price,ExecTime,Commission,TradeId,Comment
// Unlike IBKR there is no API — Yuval exports the file and uploads it in-app.
// This module parses the CSV, groups executions into positions, and merges them
// into AppData. Re-uploading a fuller export is idempotent (stable position ids),
// so no duplicates are created.

interface Execution {
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  commission: number; // positive
  dateISO: string; // YYYY-MM-DD
  timeISO: string; // full ISO timestamp, used for chronological sorting
}

interface PositionState {
  symbol: string;
  type: 'long' | 'short';
  entries: Execution[];
  exits: Execution[];
  openQty: number;
  openedAt: string;
  status?: 'open' | 'closed';
}

export interface ColmexImportResult {
  data: AppData;
  newCount: number;
  updatedCount: number;
  parsedExecutions: number;
  positions: number;
}

// ── CSV parsing ─────────────────────────────────────────────────────────────────

function parseColmexCsv(text: string): Execution[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];

  // Map header columns by name so we tolerate column-order changes.
  const header = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const idx = (name: string) => header.indexOf(name);
  const iDate = idx('date');
  const iSide = idx('side');
  const iSymbol = idx('symbol');
  const iQty = idx('quantity');
  const iPrice = idx('price');
  const iTime = idx('exectime');
  const iComm = idx('commission');

  if (iDate < 0 || iSide < 0 || iSymbol < 0 || iQty < 0 || iPrice < 0) {
    throw new Error('קובץ לא תקין — חסרות עמודות חובה (Date/Side/Symbol/Quantity/Price). ודא שזה ייצוא היסטוריית מסחר מקולמקס פרו בפורמט CSV.');
  }

  const executions: Execution[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    const date = (cols[iDate] || '').trim();
    const sideRaw = (cols[iSide] || '').trim().toLowerCase();
    const symbol = (cols[iSymbol] || '').trim().toUpperCase();
    const quantity = Number((cols[iQty] || '').trim());
    const price = Number((cols[iPrice] || '').trim());
    const time = iTime >= 0 ? (cols[iTime] || '').trim() : '00:00:00';
    const commission = iComm >= 0 ? Math.abs(Number((cols[iComm] || '0').trim()) || 0) : 0;

    if (!date || !symbol || !sideRaw || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(price)) {
      continue; // skip blank / malformed rows
    }
    const side: 'BUY' | 'SELL' = sideRaw.startsWith('b') ? 'BUY' : 'SELL';

    executions.push({
      symbol,
      side,
      quantity,
      price,
      commission,
      dateISO: date,
      timeISO: `${date}T${time || '00:00:00'}`,
    });
  }

  // Colmex exports newest-first; group chronologically (oldest first).
  executions.sort((a, b) => (a.timeISO < b.timeISO ? -1 : a.timeISO > b.timeISO ? 1 : 0));
  return executions;
}

// ── Grouping executions into positions (broker-agnostic, ported from IBKR import) ─

function groupExecutionsIntoPositions(executions: Execution[]): PositionState[] {
  const openPositions = new Map<string, PositionState>();
  const completedTrades: PositionState[] = [];

  for (const ex of executions) {
    const existing = openPositions.get(ex.symbol);

    if (!existing) {
      openPositions.set(ex.symbol, {
        symbol: ex.symbol,
        type: ex.side === 'BUY' ? 'long' : 'short',
        entries: [ex],
        exits: [],
        openQty: ex.quantity,
        openedAt: ex.timeISO,
      });
    } else {
      const isSameDirection =
        (existing.type === 'long' && ex.side === 'BUY') ||
        (existing.type === 'short' && ex.side === 'SELL');

      if (isSameDirection) {
        existing.entries.push(ex);
        existing.openQty += ex.quantity;
      } else {
        existing.exits.push(ex);
        existing.openQty -= ex.quantity;

        if (Math.abs(existing.openQty) < 0.001) {
          completedTrades.push({ ...existing, status: 'closed' });
          openPositions.delete(ex.symbol);
        } else if (existing.openQty < -0.001) {
          // Position flipped — close current, open reverse with leftover qty
          completedTrades.push({ ...existing, status: 'closed' });
          const newType = existing.type === 'long' ? 'short' : 'long';
          const flipQty = Math.abs(existing.openQty);
          openPositions.set(ex.symbol, {
            symbol: ex.symbol,
            type: newType,
            entries: [{ ...ex, quantity: flipQty }],
            exits: [],
            openQty: flipQty,
            openedAt: ex.timeISO,
          });
        }
      }
    }
  }

  for (const pos of openPositions.values()) {
    completedTrades.push({ ...pos, status: 'open' });
  }
  return completedTrades;
}

// ── Position → Trade mapping ─────────────────────────────────────────────────────

function djb2(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function generateColmexId(pos: PositionState): string {
  const seed = [
    pos.symbol,
    pos.type,
    pos.entries[0].dateISO,
    pos.entries[0].price.toFixed(4),
    pos.entries[0].quantity,
  ].join('|');
  return 'colmex-' + djb2(seed);
}

function calcAvgEntry(entries: Execution[]): number {
  const totalCost = entries.reduce((s, e) => s + e.price * e.quantity, 0);
  const totalQty = entries.reduce((s, e) => s + e.quantity, 0);
  return totalQty > 0 ? totalCost / totalQty : 0;
}

function mapPositionToTrade(pos: PositionState, serialNumber: number): Trade {
  const avgEntry = calcAvgEntry(pos.entries);
  const totalShares = pos.entries.reduce((s, e) => s + e.quantity, 0);
  const totalInvested = avgEntry * totalShares;

  const initialEntry: TradeEntry = {
    price: pos.entries[0].price,
    quantity: pos.entries[0].quantity,
    totalAmount: pos.entries[0].price * pos.entries[0].quantity,
    date: pos.entries[0].dateISO,
    commission: Math.round(pos.entries[0].commission * 100) / 100,
  };

  // Display caps (model supports 3 reinforcements + 4 exits); totals below use ALL legs.
  const reinforcements: TradeEntry[] = pos.entries.slice(1, 4).map((e) => ({
    price: e.price,
    quantity: e.quantity,
    totalAmount: e.price * e.quantity,
    date: e.dateISO,
    commission: Math.round(e.commission * 100) / 100,
  }));

  const exitPL = (e: Execution) => {
    const costBasis = avgEntry * e.quantity;
    return pos.type === 'long'
      ? e.price * e.quantity - costBasis
      : costBasis - e.price * e.quantity;
  };

  const exits: TradeExit[] = pos.exits.slice(0, 4).map((e) => {
    const costBasis = avgEntry * e.quantity;
    const pl = exitPL(e);
    return {
      price: e.price,
      quantity: e.quantity,
      totalAmount: e.price * e.quantity,
      profitLoss: Math.round(pl * 100) / 100,
      profitLossPercent: costBasis > 0 ? Math.round((pl / costBasis) * 10000) / 100 : 0,
      notes: '',
      date: e.dateISO,
      commission: Math.round(e.commission * 100) / 100,
    };
  });

  // Totals computed from ALL exits (not just the displayed 4) for scalping accuracy.
  const fullPL = pos.exits.reduce((s, e) => s + exitPL(e), 0);
  const totalCommissions =
    pos.entries.reduce((s, e) => s + e.commission, 0) +
    pos.exits.reduce((s, e) => s + e.commission, 0);

  return {
    id: generateColmexId(pos),
    serialNumber,
    type: pos.type,
    stockName: pos.symbol,
    date: pos.entries[0].dateISO,
    initialEntry,
    reinforcements,
    exits,
    totalShares,
    avgEntryPrice: Math.round(avgEntry * 10000) / 10000,
    totalInvested: Math.round(totalInvested * 100) / 100,
    totalProfitLoss: Math.round(fullPL * 100) / 100,
    totalProfitLossPercent: totalInvested > 0 ? Math.round((fullPL / totalInvested) * 10000) / 100 : 0,
    rr: 0,
    commissions: Math.round(totalCommissions * 100) / 100,
    entryReason: '',
    exitReason: '',
    conclusions: '',
    notes: '[יובא מקולמקס פרו]',
    behavioralTags: [],
    createdAt: new Date().toISOString(),
    status: pos.status,
    ibkrImported: true, // marks as broker-imported (preserves manual edits on re-import)
  };
}

// ── Merge into AppData (ported from IBKR import) ──────────────────────────────────

function mergeIntoAppData(appData: AppData, importedTrades: Trade[]): { data: AppData; newCount: number; updatedCount: number } {
  const trades = [...(appData.trades || [])];
  let newCount = 0;
  let updatedCount = 0;

  for (const it of importedTrades) {
    const existingIdx = trades.findIndex((t) => t.id === it.id);

    if (existingIdx === -1) {
      const maxSerial = trades.length > 0 ? Math.max(...trades.map((t) => t.serialNumber || 0)) : 0;
      it.serialNumber = maxSerial + 1;
      trades.push(it);
      newCount++;
      continue;
    }

    const existing = trades[existingIdx];
    // Only ever touch broker-imported trades; manually-created trades stay as-is.
    if (existing.ibkrImported !== true) continue;

    // Refresh the broker/numeric fields (incl. per-leg commission) from the fresh
    // import; preserve the user's manual annotations and bookkeeping.
    const refreshed: Trade = {
      ...existing,
      type: it.type,
      date: it.date,
      initialEntry: it.initialEntry,
      reinforcements: it.reinforcements,
      exits: it.exits,
      totalShares: it.totalShares,
      avgEntryPrice: it.avgEntryPrice,
      totalInvested: it.totalInvested,
      totalProfitLoss: it.totalProfitLoss,
      totalProfitLossPercent: it.totalProfitLossPercent,
      commissions: it.commissions,
      status: it.status,
    };

    if (JSON.stringify(refreshed) !== JSON.stringify(existing)) {
      trades[existingIdx] = refreshed;
      updatedCount++;
    }
  }

  return { data: { ...appData, trades }, newCount, updatedCount };
}

// ── Public entry point ───────────────────────────────────────────────────────────

export function importColmexCsv(appData: AppData, csvText: string): ColmexImportResult {
  const executions = parseColmexCsv(csvText);
  if (executions.length === 0) {
    throw new Error('לא נמצאו עסקאות בקובץ.');
  }
  const positions = groupExecutionsIntoPositions(executions);
  const importedTrades = positions.map((p, i) => mapPositionToTrade(p, i + 1));
  const merged = mergeIntoAppData(appData, importedTrades);
  return {
    data: merged.data,
    newCount: merged.newCount,
    updatedCount: merged.updatedCount,
    parsedExecutions: executions.length,
    positions: positions.length,
  };
}
