import { useState, useEffect, useCallback, type CSSProperties } from 'react';
import { Plus, Trash2, ChevronDown, ChevronUp, RefreshCw, Settings, X, TrendingUp, TrendingDown } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { supabase } from '../utils/supabase';

interface Purchase {
  id: string;
  date: string;
  shares: number;
  pricePerShare: number;
  notes: string;
}

interface Investment {
  id: string;
  symbol: string;
  name: string;
  purchases: Purchase[];
  currentPrice?: number;
  lastPriceUpdate?: string;
}

interface ValueSnapshot {
  date: string;  // YYYY-MM-DD
  value: number; // total portfolio value at that date
}

interface StoredData {
  investments: Investment[];
  snapshots: ValueSnapshot[];
}

const LOCAL_KEY = 'yuval-longterm-investments';
const API_KEY_STORAGE = 'finnhub_api_key';
const SUPABASE_ROW_ID = 2;

function generateId() {
  return crypto.randomUUID();
}

function parseStored(raw: unknown): StoredData {
  if (Array.isArray(raw)) return { investments: raw as Investment[], snapshots: [] };
  if (raw && typeof raw === 'object' && 'investments' in raw) return raw as StoredData;
  return { investments: [], snapshots: [] };
}

function loadFromLocal(): StoredData {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    return raw ? parseStored(JSON.parse(raw)) : { investments: [], snapshots: [] };
  } catch {
    return { investments: [], snapshots: [] };
  }
}

async function loadData(): Promise<StoredData> {
  try {
    const { data, error } = await supabase
      .from('app_state')
      .select('data')
      .eq('id', SUPABASE_ROW_ID)
      .single();
    if (!error && data?.data) return parseStored(data.data);
  } catch { /* fall through */ }
  return loadFromLocal();
}

async function saveData(stored: StoredData): Promise<void> {
  try {
    await supabase
      .from('app_state')
      .upsert({ id: SUPABASE_ROW_ID, data: stored, updated_at: new Date().toISOString() });
  } catch { /* fall through */ }
  localStorage.setItem(LOCAL_KEY, JSON.stringify(stored));
}

function calcStats(investment: Investment) {
  const totalShares = investment.purchases.reduce((s, p) => s + p.shares, 0);
  const totalCost = investment.purchases.reduce((s, p) => s + p.shares * p.pricePerShare, 0);
  const avgEntry = totalShares > 0 ? totalCost / totalShares : 0;
  const currentValue = totalShares * (investment.currentPrice ?? 0);
  const pl = investment.currentPrice ? currentValue - totalCost : null;
  const plPct = investment.currentPrice && totalCost > 0 ? ((currentValue - totalCost) / totalCost) * 100 : null;
  return { totalShares, totalCost, avgEntry, currentValue, pl, plPct };
}

function getSymbolColor(inv: Investment, allInvestments: Investment[]): { bg: string; glow: string } {
  const { plPct } = calcStats(inv);
  if (plPct === null) return { bg: 'linear-gradient(135deg, #334155, #1e293b)', glow: 'none' };

  const allPcts = allInvestments.map((i) => calcStats(i).plPct).filter((p): p is number => p !== null);
  const profits = allPcts.filter((p) => p > 0);
  const losses = allPcts.filter((p) => p < 0);

  if (plPct > 0) {
    const min = profits.length > 1 ? Math.min(...profits) : plPct;
    const max = profits.length > 1 ? Math.max(...profits) : plPct;
    const ratio = max === min ? 0.5 : (plPct - min) / (max - min);
    const L = Math.round(22 + ratio * 43); // 22% (dark) → 65% (light)
    return {
      bg: `linear-gradient(135deg, hsl(142,62%,${L}%), hsl(142,62%,${Math.max(L - 10, 14)}%))`,
      glow: `0 0 14px hsla(142,62%,${L}%,0.45)`,
    };
  } else if (plPct < 0) {
    const min = losses.length > 1 ? Math.min(...losses) : plPct; // most negative
    const max = losses.length > 1 ? Math.max(...losses) : plPct; // closest to 0
    const ratio = max === min ? 0.5 : (plPct - max) / (min - max); // 0 = small loss, 1 = big loss
    const L = Math.round(22 + ratio * 38); // 22% (dark, small loss) → 60% (light, big loss)
    return {
      bg: `linear-gradient(135deg, hsl(0,68%,${L}%), hsl(0,68%,${Math.max(L - 8, 14)}%))`,
      glow: `0 0 14px hsla(0,68%,${L}%,0.45)`,
    };
  }
  return { bg: 'linear-gradient(135deg, #475569, #334155)', glow: 'none' };
}

function isOlderThan24h(dateStr?: string) {
  if (!dateStr) return true;
  const diff = Date.now() - new Date(dateStr).getTime();
  return diff > 24 * 60 * 60 * 1000;
}

async function fetchPrice(symbol: string, apiKey: string): Promise<number | null> {
  try {
    const res = await fetch(
      `https://finnhub.io/api/v1/quote?symbol=${symbol.toUpperCase()}&token=${apiKey}`
    );
    const json = await res.json();
    if (json.c && json.c > 0) return json.c;
    return null;
  } catch {
    return null;
  }
}

export default function LongTermInvestments() {
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [snapshots, setSnapshots] = useState<ValueSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiKey, setApiKey] = useState(() => localStorage.getItem(API_KEY_STORAGE) ?? '');
  const [showApiSettings, setShowApiSettings] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showAddInvestment, setShowAddInvestment] = useState(false);
  const [addPurchaseForId, setAddPurchaseForId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMsg, setRefreshMsg] = useState('');

  // New investment form
  const [newSymbol, setNewSymbol] = useState('');
  const [newName, setNewName] = useState('');
  const [newDate, setNewDate] = useState(new Date().toISOString().slice(0, 10));
  const [newShares, setNewShares] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newNotes, setNewNotes] = useState('');

  // Add purchase form
  const [pDate, setPDate] = useState(new Date().toISOString().slice(0, 10));
  const [pShares, setPShares] = useState('');
  const [pPrice, setPPrice] = useState('');
  const [pNotes, setPNotes] = useState('');

  const persist = useCallback((updatedInvestments: Investment[], updatedSnapshots?: ValueSnapshot[]) => {
    setInvestments(updatedInvestments);
    const snaps = updatedSnapshots ?? snapshots;
    if (updatedSnapshots) setSnapshots(updatedSnapshots);
    saveData({ investments: updatedInvestments, snapshots: snaps });
  }, [snapshots]);

  // Load from Supabase on mount
  useEffect(() => {
    loadData().then((stored) => {
      setInvestments(stored.investments);
      setSnapshots(stored.snapshots);
      setLoading(false);
    });
  }, []);

  // Auto-refresh prices on load if stale
  useEffect(() => {
    if (loading || !apiKey) return;
    const stale = investments.filter((inv) => isOlderThan24h(inv.lastPriceUpdate));
    if (stale.length === 0) return;
    refreshPrices(stale.map((i) => i.id), false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  async function refreshPrices(ids?: string[], showMsg = true) {
    if (!apiKey) {
      setShowApiSettings(true);
      return;
    }
    setRefreshing(true);
    if (showMsg) setRefreshMsg('מעדכן מחירים...');
    const targets = ids ?? investments.map((i) => i.id);
    const updated = [...investments];
    for (const id of targets) {
      const idx = updated.findIndex((i) => i.id === id);
      if (idx === -1) continue;
      const price = await fetchPrice(updated[idx].symbol, apiKey);
      if (price !== null) {
        updated[idx] = { ...updated[idx], currentPrice: price, lastPriceUpdate: new Date().toISOString() };
      }
    }
    // Save portfolio value snapshot (one per day)
    const today = new Date().toISOString().slice(0, 10);
    const totalValue = updated.reduce((s, inv) => {
      const shares = inv.purchases.reduce((a, p) => a + p.shares, 0);
      return s + shares * (inv.currentPrice ?? 0);
    }, 0);
    const updatedSnapshots = [
      ...snapshots.filter((s) => s.date !== today),
      { date: today, value: +totalValue.toFixed(2) },
    ].sort((a, b) => a.date.localeCompare(b.date));

    persist(updated, updatedSnapshots);
    setRefreshing(false);
    if (showMsg) {
      setRefreshMsg('המחירים עודכנו!');
      setTimeout(() => setRefreshMsg(''), 3000);
    }
  }

  function handleSaveApiKey() {
    localStorage.setItem(API_KEY_STORAGE, apiKeyInput.trim());
    setApiKey(apiKeyInput.trim());
    setShowApiSettings(false);
    setApiKeyInput('');
  }

  function handleAddInvestment() {
    if (!newSymbol || !newShares || !newPrice) return;
    const inv: Investment = {
      id: generateId(),
      symbol: newSymbol.toUpperCase().trim(),
      name: newName.trim() || newSymbol.toUpperCase().trim(),
      purchases: [{
        id: generateId(),
        date: newDate,
        shares: parseFloat(newShares),
        pricePerShare: parseFloat(newPrice),
        notes: newNotes,
      }],
    };
    persist([...investments, inv]);
    setShowAddInvestment(false);
    setNewSymbol(''); setNewName(''); setNewShares(''); setNewPrice(''); setNewNotes('');
    setNewDate(new Date().toISOString().slice(0, 10));
  }

  function handleAddPurchase() {
    if (!addPurchaseForId || !pShares || !pPrice) return;
    const updated = investments.map((inv) =>
      inv.id === addPurchaseForId
        ? { ...inv, purchases: [...inv.purchases, { id: generateId(), date: pDate, shares: parseFloat(pShares), pricePerShare: parseFloat(pPrice), notes: pNotes }] }
        : inv
    );
    persist(updated);
    setAddPurchaseForId(null);
    setPShares(''); setPPrice(''); setPNotes('');
    setPDate(new Date().toISOString().slice(0, 10));
  }

  function handleDeletePurchase(invId: string, purchaseId: string) {
    const updated = investments.map((inv) =>
      inv.id === invId
        ? { ...inv, purchases: inv.purchases.filter((p) => p.id !== purchaseId) }
        : inv
    ).filter((inv) => inv.purchases.length > 0);
    persist(updated);
  }

  function handleDeleteInvestment(id: string) {
    if (!confirm('למחוק את ההשקעה הזו לגמרי?')) return;
    persist(investments.filter((i) => i.id !== id));
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: '#475569' }}>
        טוען...
      </div>
    );
  }

  const totalPortfolioValue = investments.reduce((s, inv) => {
    const { currentValue } = calcStats(inv);
    return s + currentValue;
  }, 0);
  const totalPortfolioCost = investments.reduce((s, inv) => s + calcStats(inv).totalCost, 0);
  const totalPL = totalPortfolioValue - totalPortfolioCost;
  const totalPLPct = totalPortfolioCost > 0 ? (totalPL / totalPortfolioCost) * 100 : 0;

  const inputStyle: CSSProperties = {
    width: '100%',
    padding: '8px 12px',
    backgroundColor: 'rgba(30,41,59,0.8)',
    border: '1px solid rgba(71,85,105,0.5)',
    borderRadius: '8px',
    color: '#f1f5f9',
    fontSize: '14px',
    outline: 'none',
    boxSizing: 'border-box',
    direction: 'rtl',
  };

  const btnPrimary: CSSProperties = {
    padding: '8px 16px',
    backgroundColor: '#0ea5e9',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 600,
  };

  const btnSecondary: CSSProperties = {
    padding: '8px 16px',
    backgroundColor: 'rgba(71,85,105,0.3)',
    color: '#94a3b8',
    border: '1px solid rgba(71,85,105,0.4)',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
  };

  return (
    <div style={{ padding: '28px', direction: 'rtl', maxWidth: '1100px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#f1f5f9', margin: 0 }}>השקעות ארוכות טווח</h1>
          <p style={{ color: '#64748b', fontSize: '14px', marginTop: '4px' }}>מעקב אחרי תיק ההשקעות לטווח ארוך</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {refreshMsg && <span style={{ color: '#22c55e', fontSize: '13px' }}>{refreshMsg}</span>}
          <button
            onClick={() => refreshPrices()}
            disabled={refreshing}
            style={{ ...btnSecondary, display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <RefreshCw size={14} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
            עדכן מחירים
          </button>
          <button onClick={() => { setShowApiSettings(true); setApiKeyInput(apiKey); }} style={{ ...btnSecondary, padding: '8px 10px' }}>
            <Settings size={16} />
          </button>
          <button onClick={() => setShowAddInvestment(true)} style={{ ...btnPrimary, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Plus size={16} />
            השקעה חדשה
          </button>
        </div>
      </div>

      {/* API Key warning */}
      {!apiKey && (
        <div style={{ backgroundColor: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '12px', padding: '16px', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <span style={{ color: '#f59e0b', fontWeight: 600 }}>נדרש API Key מ-Finnhub</span>
            <span style={{ color: '#94a3b8', fontSize: '13px', marginRight: '8px' }}> — לצורך עדכון מחירי מניות אוטומטי</span>
          </div>
          <button onClick={() => setShowApiSettings(true)} style={{ ...btnPrimary, backgroundColor: '#f59e0b' }}>הגדר עכשיו</button>
        </div>
      )}

      {/* Summary cards */}
      {investments.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
          {[
            { label: 'שווי תיק נוכחי', value: totalPortfolioValue > 0 ? `$${totalPortfolioValue.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—', color: '#0ea5e9', sub: null },
            { label: 'עלות כוללת', value: `$${totalPortfolioCost.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, color: '#94a3b8', sub: null },
            { label: 'רווח / הפסד', value: totalPortfolioValue > 0 ? `$${totalPL.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—', color: totalPL >= 0 ? '#22c55e' : '#ef4444', sub: totalPortfolioValue > 0 ? `${totalPLPct >= 0 ? '+' : ''}${totalPLPct.toFixed(2)}%` : null },
          ].map((card) => (
            <div key={card.label} style={{ backgroundColor: 'rgba(30,41,59,0.6)', border: '1px solid rgba(71,85,105,0.3)', borderRadius: '12px', padding: '20px' }}>
              <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '8px' }}>{card.label}</div>
              <div style={{ fontSize: '22px', fontWeight: 700, color: card.color }}>{card.value}</div>
              {card.sub && <div style={{ fontSize: '12px', color: card.color, marginTop: '4px' }}>{card.sub}</div>}
            </div>
          ))}
        </div>
      )}

      {/* Chart */}
      {investments.length > 0 && (() => {
        // Build cumulative cost line from purchase dates
        const allPurchases = investments.flatMap((inv) =>
          inv.purchases.map((p) => ({ date: p.date, cost: p.shares * p.pricePerShare }))
        ).sort((a, b) => a.date.localeCompare(b.date));

        let cumCost = 0;
        const costByDate: Record<string, number> = {};
        for (const p of allPurchases) {
          cumCost += p.cost;
          costByDate[p.date] = +cumCost.toFixed(2);
        }

        // Merge all dates from cost points + snapshots
        const allDates = Array.from(new Set([
          ...Object.keys(costByDate),
          ...snapshots.map((s) => s.date),
        ])).sort();

        let lastCost = 0;
        const chartData = allDates.map((date) => {
          if (costByDate[date] !== undefined) lastCost = costByDate[date];
          const snap = snapshots.find((s) => s.date === date);
          return {
            date,
            'עלות מצטברת': lastCost,
            'שווי תיק': snap ? snap.value : undefined,
          };
        });

        if (chartData.length < 1) return null;

        return (
          <div style={{ backgroundColor: 'rgba(30,41,59,0.6)', border: '1px solid rgba(71,85,105,0.3)', borderRadius: '12px', padding: '20px', marginBottom: '24px' }}>
            <div style={{ fontSize: '14px', fontWeight: 600, color: '#94a3b8', marginBottom: '4px' }}>שווי התיק לאורך זמן</div>
            <div style={{ fontSize: '12px', color: '#475569', marginBottom: '16px' }}>
              {snapshots.length === 0 ? 'לחץ "עדכן מחירים" כדי להתחיל לצבור נקודות שווי' : `${snapshots.length} נקודות שווי נצברו`}
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={chartData} margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(71,85,105,0.2)" />
                <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false}
                  tickFormatter={(d: string) => new Date(d).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' })} />
                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false}
                  tickFormatter={(v: number) => `$${v.toLocaleString('en')}`} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid rgba(71,85,105,0.5)', borderRadius: '8px', color: '#f1f5f9', fontSize: '13px' }}
                  formatter={(value) => [`$${Number(value).toLocaleString('en', { minimumFractionDigits: 2 })}`, undefined]}
                  labelFormatter={(label) => new Date(String(label)).toLocaleDateString('he-IL')}
                />
                <Legend wrapperStyle={{ color: '#94a3b8', fontSize: '13px' }} />
                <Line type="monotone" dataKey="עלות מצטברת" stroke="#64748b" strokeWidth={2} dot={false} strokeDasharray="4 3" />
                <Line type="monotone" dataKey="שווי תיק" stroke="#0ea5e9" strokeWidth={2.5} dot={{ fill: '#0ea5e9', r: 4 }} connectNulls={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        );
      })()}

      {/* Investments list */}
      {investments.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 20px', color: '#475569' }}>
          <TrendingUp size={48} style={{ marginBottom: '16px', opacity: 0.3 }} />
          <p style={{ fontSize: '16px', marginBottom: '8px' }}>אין השקעות עדיין</p>
          <p style={{ fontSize: '13px' }}>לחץ על "השקעה חדשה" כדי להתחיל</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {investments.map((inv) => {
            const { totalShares, totalCost, avgEntry, currentValue, pl, plPct } = calcStats(inv);
            const isExpanded = expandedId === inv.id;
            const hasPrice = inv.currentPrice != null;
            const { bg: symbolBg, glow: symbolGlow } = getSymbolColor(inv, investments);

            return (
              <div key={inv.id} style={{ backgroundColor: 'rgba(30,41,59,0.6)', border: '1px solid rgba(71,85,105,0.3)', borderRadius: '12px', overflow: 'hidden' }}>
                {/* Investment header row */}
                <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                  {/* Symbol badge */}
                  <div style={{ width: '52px', height: '52px', borderRadius: '12px', background: symbolBg, boxShadow: symbolGlow, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'background 0.5s, box-shadow 0.5s' }}>
                    <span style={{ color: 'white', fontWeight: 700, fontSize: '12px' }}>{inv.symbol}</span>
                  </div>

                  {/* Name + symbol */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, color: '#f1f5f9', fontSize: '15px' }}>{inv.name}</div>
                    <div style={{ color: '#64748b', fontSize: '12px', marginTop: '2px' }}>
                      {totalShares.toLocaleString('en', { maximumFractionDigits: 4 })} מניות · מחיר ממוצע כניסה: ${avgEntry.toFixed(2)}
                    </div>
                  </div>

                  {/* Current price */}
                  <div style={{ textAlign: 'center', minWidth: '90px' }}>
                    <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '2px' }}>מחיר נוכחי</div>
                    <div style={{ fontWeight: 700, color: '#f1f5f9', fontSize: '15px' }}>{hasPrice ? `$${inv.currentPrice!.toFixed(2)}` : '—'}</div>
                    {inv.lastPriceUpdate && (
                      <div style={{ fontSize: '10px', color: '#475569', marginTop: '2px' }}>
                        {new Date(inv.lastPriceUpdate).toLocaleDateString('he-IL')}
                      </div>
                    )}
                  </div>

                  {/* Current value */}
                  <div style={{ textAlign: 'center', minWidth: '110px' }}>
                    <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '2px' }}>שווי כולל</div>
                    <div style={{ fontWeight: 700, color: '#0ea5e9', fontSize: '15px' }}>{hasPrice ? `$${currentValue.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}</div>
                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>עלות: ${totalCost.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                  </div>

                  {/* P&L */}
                  <div style={{ textAlign: 'center', minWidth: '100px' }}>
                    <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '2px' }}>רווח/הפסד</div>
                    {pl !== null ? (
                      <>
                        <div style={{ fontWeight: 700, color: pl >= 0 ? '#22c55e' : '#ef4444', fontSize: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                          {pl >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                          {pl >= 0 ? '+' : ''}${pl.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <div style={{ fontSize: '11px', color: pl! >= 0 ? '#22c55e' : '#ef4444', marginTop: '2px' }}>
                          {plPct! >= 0 ? '+' : ''}{plPct!.toFixed(2)}%
                        </div>
                      </>
                    ) : (
                      <div style={{ color: '#475569', fontSize: '13px' }}>עדכן מחיר</div>
                    )}
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                    <button
                      onClick={() => { setAddPurchaseForId(inv.id); setExpandedId(inv.id); }}
                      style={{ padding: '6px 10px', backgroundColor: 'rgba(14,165,233,0.15)', color: '#0ea5e9', border: '1px solid rgba(14,165,233,0.3)', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <Plus size={12} /> חיזוק
                    </button>
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : inv.id)}
                      style={{ padding: '6px 8px', backgroundColor: 'transparent', color: '#64748b', border: '1px solid rgba(71,85,105,0.3)', borderRadius: '6px', cursor: 'pointer' }}
                    >
                      {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                    <button
                      onClick={() => handleDeleteInvestment(inv.id)}
                      style={{ padding: '6px 8px', backgroundColor: 'transparent', color: '#64748b', border: '1px solid rgba(71,85,105,0.3)', borderRadius: '6px', cursor: 'pointer' }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Expanded: purchases list + add purchase form */}
                {isExpanded && (
                  <div style={{ borderTop: '1px solid rgba(71,85,105,0.3)', padding: '16px 20px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#94a3b8', marginBottom: '12px' }}>היסטוריית רכישות</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: addPurchaseForId === inv.id ? '16px' : '0' }}>
                      {inv.purchases.map((p, idx) => (
                        <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', backgroundColor: 'rgba(15,23,42,0.5)', borderRadius: '8px' }}>
                          <span style={{ color: '#475569', fontSize: '12px', minWidth: '24px' }}>#{idx + 1}</span>
                          <span style={{ color: '#64748b', fontSize: '13px', minWidth: '90px' }}>{new Date(p.date).toLocaleDateString('he-IL')}</span>
                          <span style={{ color: '#f1f5f9', fontSize: '13px', minWidth: '80px' }}>{p.shares.toLocaleString('en', { maximumFractionDigits: 4 })} מניות</span>
                          <span style={{ color: '#94a3b8', fontSize: '13px', minWidth: '90px' }}>@ ${p.pricePerShare.toFixed(2)}</span>
                          <span style={{ color: '#0ea5e9', fontSize: '13px', minWidth: '100px' }}>סה"כ: ${(p.shares * p.pricePerShare).toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          {p.notes && <span style={{ color: '#64748b', fontSize: '12px', flex: 1 }}>{p.notes}</span>}
                          <button onClick={() => handleDeletePurchase(inv.id, p.id)} style={{ marginRight: 'auto', padding: '4px', backgroundColor: 'transparent', border: 'none', cursor: 'pointer', color: '#475569' }}>
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>

                    {/* Add purchase form */}
                    {addPurchaseForId === inv.id && (
                      <div style={{ backgroundColor: 'rgba(14,165,233,0.05)', border: '1px solid rgba(14,165,233,0.2)', borderRadius: '10px', padding: '16px', marginTop: '12px' }}>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#0ea5e9', marginBottom: '12px' }}>הוסף חיזוק</div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 2fr', gap: '10px', marginBottom: '12px' }}>
                          <div>
                            <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '4px' }}>תאריך</div>
                            <input type="date" value={pDate} onChange={(e) => setPDate(e.target.value)} style={inputStyle} />
                          </div>
                          <div>
                            <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '4px' }}>כמות מניות</div>
                            <input type="number" value={pShares} onChange={(e) => setPShares(e.target.value)} placeholder="10" style={inputStyle} />
                          </div>
                          <div>
                            <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '4px' }}>מחיר לרכישה ($)</div>
                            <input type="number" value={pPrice} onChange={(e) => setPPrice(e.target.value)} placeholder="150.00" style={inputStyle} />
                          </div>
                          <div>
                            <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '4px' }}>הערות (אופציונלי)</div>
                            <input type="text" value={pNotes} onChange={(e) => setPNotes(e.target.value)} placeholder="הערה..." style={inputStyle} />
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button onClick={handleAddPurchase} style={btnPrimary}>שמור חיזוק</button>
                          <button onClick={() => setAddPurchaseForId(null)} style={btnSecondary}>ביטול</button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Add new investment */}
      {showAddInvestment && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ backgroundColor: '#1e293b', border: '1px solid rgba(71,85,105,0.5)', borderRadius: '16px', padding: '28px', width: '480px', direction: 'rtl' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ color: '#f1f5f9', fontSize: '18px', fontWeight: 700, margin: 0 }}>השקעה חדשה</h2>
              <button onClick={() => setShowAddInvestment(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}><X size={20} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '10px' }}>
                <div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>סימול (Ticker) *</div>
                  <input value={newSymbol} onChange={(e) => setNewSymbol(e.target.value)} placeholder="AAPL" style={inputStyle} />
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>שם החברה</div>
                  <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Apple Inc." style={inputStyle} />
                </div>
              </div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#94a3b8', marginTop: '4px' }}>רכישה ראשונה</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                <div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>תאריך *</div>
                  <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} style={inputStyle} />
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>כמות מניות *</div>
                  <input type="number" value={newShares} onChange={(e) => setNewShares(e.target.value)} placeholder="10" style={inputStyle} />
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>מחיר לרכישה ($) *</div>
                  <input type="number" value={newPrice} onChange={(e) => setNewPrice(e.target.value)} placeholder="150.00" style={inputStyle} />
                </div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>הערות (אופציונלי)</div>
                <input value={newNotes} onChange={(e) => setNewNotes(e.target.value)} placeholder="הערות..." style={inputStyle} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '20px' }}>
              <button onClick={handleAddInvestment} style={btnPrimary}>הוסף השקעה</button>
              <button onClick={() => setShowAddInvestment(false)} style={btnSecondary}>ביטול</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: API Key settings */}
      {showApiSettings && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ backgroundColor: '#1e293b', border: '1px solid rgba(71,85,105,0.5)', borderRadius: '16px', padding: '28px', width: '440px', direction: 'rtl' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ color: '#f1f5f9', fontSize: '18px', fontWeight: 700, margin: 0 }}>הגדרות API מחירי מניות</h2>
              <button onClick={() => setShowApiSettings(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}><X size={20} /></button>
            </div>
            <p style={{ color: '#94a3b8', fontSize: '13px', lineHeight: '1.6', marginBottom: '16px' }}>
              לצורך עדכון מחירים אוטומטי יש להירשם בחינם ב-<strong style={{ color: '#0ea5e9' }}>finnhub.io</strong> ולהדביק את ה-API Key:
            </p>
            <ol style={{ color: '#64748b', fontSize: '13px', lineHeight: '2', paddingRight: '16px', marginBottom: '16px' }}>
              <li>כנס ל-finnhub.io ולחץ "Get free API key"</li>
              <li>הירשם עם מייל</li>
              <li>העתק את ה-API key מהדשבורד</li>
              <li>הדבק למטה</li>
            </ol>
            <input
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              placeholder="הדבק API Key כאן..."
              style={inputStyle}
            />
            <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
              <button onClick={handleSaveApiKey} disabled={!apiKeyInput.trim()} style={{ ...btnPrimary, opacity: apiKeyInput.trim() ? 1 : 0.5 }}>שמור</button>
              <button onClick={() => setShowApiSettings(false)} style={btnSecondary}>ביטול</button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
