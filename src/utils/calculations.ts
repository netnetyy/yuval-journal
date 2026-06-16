import type { Trade, AppData } from '../types/trade';

export interface PeriodStats {
  period: string;
  tradeIds: string[];
  count: number;
  wins: number;
  winRate: number;
  netPL: number;
  commissions: number;
  bestTrade: number;
  worstTrade: number;
  avgRR: number;
  riskUnits: number;
}

export function isClosedTrade(t: Trade): boolean {
  return !t.status || t.status === 'closed';
}

export function getOpenShares(t: Trade): number {
  const sold = (t.exits ?? []).reduce((sum, e) => sum + (e.quantity ?? 0), 0);
  return Math.max(0, t.totalShares - sold);
}

export function getNetProfitLoss(trade: Trade): number {
  return trade.totalProfitLoss - (trade.commissions ?? 0);
}

export function getRiskUnits(trade: Trade, riskUnitValue: number): number {
  if (!riskUnitValue) return 0;
  return getNetProfitLoss(trade) / riskUnitValue;
}

const HEBREW_MONTHS = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];

function buildPeriodStats(trades: Trade[], period: string, riskUnitValue: number): PeriodStats {
  const wins = trades.filter(t => getNetProfitLoss(t) > 0).length;
  const netPLs = trades.map(getNetProfitLoss);
  const netPL = netPLs.reduce((s, v) => s + v, 0);
  const commissions = trades.reduce((s, t) => s + (t.commissions ?? 0), 0);
  const rrs = trades.map(t => t.rr).filter(r => r !== 0 && isFinite(r));
  return {
    period,
    tradeIds: trades.map(t => t.id),
    count: trades.length,
    wins,
    winRate: trades.length ? (wins / trades.length) * 100 : 0,
    netPL,
    commissions,
    bestTrade: netPLs.length ? Math.max(...netPLs) : 0,
    worstTrade: netPLs.length ? Math.min(...netPLs) : 0,
    avgRR: rrs.length ? rrs.reduce((s, r) => s + r, 0) / rrs.length : 0,
    riskUnits: riskUnitValue ? netPL / riskUnitValue : 0,
  };
}

export function getMonthlyStats(data: AppData): PeriodStats[] {
  const riskUnitValue = data.riskUnitValue ?? 100;
  const byMonth = new Map<string, Trade[]>();
  for (const t of data.trades.filter(isClosedTrade)) {
    const [y, m] = t.date.split('-');
    const key = `${y}-${m}`;
    if (!byMonth.has(key)) byMonth.set(key, []);
    byMonth.get(key)!.push(t);
  }
  return [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, trades]) => {
      const [y, m] = key.split('-');
      const label = `${HEBREW_MONTHS[parseInt(m, 10) - 1]} ${y}`;
      return buildPeriodStats(trades, label, riskUnitValue);
    });
}

export function getYearlyStats(data: AppData): PeriodStats[] {
  const riskUnitValue = data.riskUnitValue ?? 100;
  const byYear = new Map<string, Trade[]>();
  for (const t of data.trades.filter(isClosedTrade)) {
    const y = t.date.split('-')[0];
    if (!byYear.has(y)) byYear.set(y, []);
    byYear.get(y)!.push(t);
  }
  return [...byYear.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([year, trades]) => buildPeriodStats(trades, year, riskUnitValue));
}

export function getPortfolioValue(data: AppData): number {
  return data.portfolioBaseValue + getTotalNetProfitLoss(data.trades.filter(isClosedTrade));
}

export function getTotalNetProfitLoss(trades: Trade[]): number {
  return trades.reduce((sum, t) => sum + getNetProfitLoss(t), 0);
}

// Portfolio value just before the given trade executed (chronological)
export function getPortfolioValueAtTrade(data: AppData, trade: Trade): number {
  const priorPL = data.trades
    .filter(isClosedTrade)
    .filter((t) => t.date < trade.date || (t.date === trade.date && t.createdAt < trade.createdAt))
    .reduce((sum, t) => sum + getNetProfitLoss(t), 0);
  return data.portfolioBaseValue + priorPL;
}

export function getPLPercentOfPortfolio(data: AppData, trade: Trade): number {
  const base = getPortfolioValueAtTrade(data, trade);
  if (base === 0) return 0;
  return (getNetProfitLoss(trade) / base) * 100;
}

export function getTotalProfitLoss(trades: Trade[]): number {
  return trades.reduce((sum, t) => sum + t.totalProfitLoss, 0);
}

export function getWinRate(trades: Trade[]): number {
  if (trades.length === 0) return 0;
  const wins = trades.filter((t) => getNetProfitLoss(t) > 0).length;
  return (wins / trades.length) * 100;
}

// Chart 1: total portfolio value over time (includes deposits at their dates + trade P&L)
export function getEquityCurve(data: AppData): { date: string; value: number; label?: string }[] {
  const totalDeposits = data.deposits.reduce((s, d) => s + d.amount, 0);
  const initialBase = data.portfolioBaseValue - totalDeposits; // base before tracked deposits

  // Build a unified event list: deposits + closed trades, sorted by date
  type Event = { date: string; delta: number; kind: 'deposit' | 'trade' };
  const events: Event[] = [
    ...data.deposits.map((d) => ({ date: d.date, delta: d.amount, kind: 'deposit' as const })),
    ...data.trades.filter(isClosedTrade).map((t) => ({ date: t.date, delta: getNetProfitLoss(t), kind: 'trade' as const })),
  ].sort((a, b) => a.date.localeCompare(b.date));

  if (events.length === 0) return [];

  // Aggregate same-date events into one point, preserving deposit label
  const byDate = new Map<string, { delta: number; hasDeposit: boolean }>();
  for (const ev of events) {
    const existing = byDate.get(ev.date) ?? { delta: 0, hasDeposit: false };
    byDate.set(ev.date, {
      delta: existing.delta + ev.delta,
      hasDeposit: existing.hasDeposit || ev.kind === 'deposit',
    });
  }

  const curve: { date: string; value: number; label?: string }[] = [];
  let running = initialBase;

  const firstDate = new Date(events[0].date);
  firstDate.setDate(firstDate.getDate() - 1);
  curve.push({ date: firstDate.toISOString().split('T')[0], value: Math.round(running * 100) / 100 });

  for (const [date, { delta, hasDeposit }] of byDate) {
    running += delta;
    curve.push({
      date,
      value: Math.round(running * 100) / 100,
      label: hasDeposit ? 'הפקדה' : undefined,
    });
  }

  return curve;
}

// Chart 2: cumulative P&L from closed trades only (no deposits, no open positions)
export function getPLCurve(data: AppData): { date: string; value: number }[] {
  const sorted = [...data.trades.filter(isClosedTrade)].sort((a, b) => a.date.localeCompare(b.date));
  if (sorted.length === 0) return [];

  // Aggregate same-date trades into one point to avoid Recharts tooltip confusion
  const byDate = new Map<string, number>();
  for (const trade of sorted) {
    byDate.set(trade.date, (byDate.get(trade.date) ?? 0) + getNetProfitLoss(trade));
  }

  const curve: { date: string; value: number }[] = [];
  let running = 0;

  const firstDate = new Date(sorted[0].date);
  firstDate.setDate(firstDate.getDate() - 1);
  curve.push({ date: firstDate.toISOString().split('T')[0], value: 0 });

  for (const [date, dayPL] of byDate) {
    running += dayPL;
    curve.push({ date, value: Math.round(running * 100) / 100 });
  }

  return curve;
}

export function calculateAvgEntryPrice(
  initialEntry: { price: number; quantity: number },
  reinforcements: { price: number; quantity: number }[]
): number {
  let totalCost = initialEntry.price * initialEntry.quantity;
  let totalQty = initialEntry.quantity;
  for (const r of reinforcements) {
    totalCost += r.price * r.quantity;
    totalQty += r.quantity;
  }
  return totalQty > 0 ? totalCost / totalQty : 0;
}

export function formatCurrency(value: number): string {
  const abs = Math.abs(value);
  const formatted = abs.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return (value < 0 ? '-$' : '$') + formatted;
}

export function formatPercent(value: number): string {
  return (value >= 0 ? '+' : '') + value.toFixed(2) + '%';
}

export function formatDate(isoDate: string): string {
  if (!isoDate) return '';
  const [y, m, d] = isoDate.split('-');
  return `${d}/${m}/${y}`;
}
