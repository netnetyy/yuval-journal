import type { AppData } from '../types/trade';
import { supabase } from './supabase';

const STORAGE_KEY = 'yuval-journal-data';

function migrate(parsed: AppData): AppData {
  if (parsed.portfolioBaseValue === undefined) {
    parsed.portfolioBaseValue = parsed.deposits?.reduce((s, d) => s + d.amount, 0) ?? 0;
  }
  if (parsed.defaultCommissionPerAction === undefined) parsed.defaultCommissionPerAction = 2.5;
  if (parsed.riskUnitValue === undefined) parsed.riskUnitValue = 100;

  // One-time fix: correct doubled commissions caused by the * 2 bug in TradeForm
  if (!parsed.commissionsFixed) {
    const rate = parsed.defaultCommissionPerAction;
    if (parsed.trades) {
      parsed.trades = parsed.trades.map(t => ({
        ...t,
        commissions: (1 + (t.reinforcements?.length ?? 0) +
          (t.exits?.filter(e => e.price > 0 && e.quantity > 0).length ?? 0)) * rate,
      }));
    }
    parsed.commissionsFixed = true;
  }

  if (parsed.trades) {
    parsed.trades = parsed.trades.map(t => ({
      ...t,
      commissions: t.commissions ?? ((1 + (t.reinforcements?.length ?? 0) + (t.exits?.length ?? 0)) * 2.5),
      entryReason: t.entryReason ?? '',
      exitReason: t.exitReason ?? '',
      conclusions: t.conclusions ?? '',
      status: t.status ?? 'closed',
    }));
  }
  return parsed;
}

function defaultData(): AppData {
  return {
    trades: [],
    deposits: [],
    portfolioBaseValue: 0,
    defaultCommissionPerAction: 2.5,
    riskUnitValue: 100,
  };
}

// ── Supabase ──────────────────────────────────────────────────────────────────

export async function loadData(): Promise<AppData> {
  try {
    const { data, error } = await supabase
      .from('app_state')
      .select('data')
      .eq('id', 1)
      .single();

    if (!error && data?.data && typeof data.data === 'object') {
      const parsed = data.data as AppData;
      // If cloud is empty (first time), seed with localStorage data if available
      if (!parsed.trades) {
        const local = loadFromLocalStorage();
        await saveData(local);
        return local;
      }
      const wasFixed = parsed.commissionsFixed;
      const migrated = migrate(parsed);
      if (!wasFixed) {
        await saveData(migrated); // persist commission fix to Supabase immediately
      }
      return migrated;
    }
  } catch {
    // network error — fall back to localStorage
  }
  return loadFromLocalStorage();
}

export async function saveData(appData: AppData): Promise<void> {
  try {
    await supabase
      .from('app_state')
      .upsert({ id: 1, data: appData, updated_at: new Date().toISOString() });
    // Also keep a local copy for offline fallback
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
  } catch {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
  }
}

// ── Local fallback ────────────────────────────────────────────────────────────

function loadFromLocalStorage(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppData;
      const wasFixed = parsed.commissionsFixed;
      const migrated = migrate(parsed);
      if (!wasFixed) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
      }
      return migrated;
    }
  } catch {
    // fall through
  }
  return defaultData();
}

export function generateId(): string {
  return crypto.randomUUID();
}
