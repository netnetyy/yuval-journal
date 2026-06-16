import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import type { AppData } from '../types/trade';
import {
  getPortfolioValue,
  getTotalNetProfitLoss,
  getWinRate,
  getEquityCurve,
  getPLCurve,
  formatCurrency,
  formatPercent,
  formatDate,
  getNetProfitLoss,
  isClosedTrade,
  getOpenShares,
} from '../utils/calculations';
import { TrendingUp, TrendingDown, Activity, DollarSign, Percent, Hash, Edit2, Plus, Trash2, X, RefreshCw, ClipboardList } from 'lucide-react';

const FINNHUB_KEY_STORAGE = 'finnhub_api_key';

interface DashboardProps {
  data: AppData;
  onNavigate: (page: 'dashboard' | 'trades' | 'add-trade' | 'statistics' | 'edit-trade', tradeId?: string) => void;
  onSetPortfolioBase: (value: number) => void;
  onAddDeposit: (amount: number, date: string, note: string) => void;
  onDeleteDeposit: (id: string) => void;
  onSetRiskUnit: (value: number) => void;
  onSetDefaultCommission: (value: number) => void;
}

const card = (style?: React.CSSProperties): React.CSSProperties => ({
  backgroundColor: '#1e293b',
  borderRadius: '12px',
  border: '1px solid rgba(71,85,105,0.4)',
  padding: '20px',
  ...style,
});

const inputStyle: React.CSSProperties = {
  backgroundColor: '#0f172a',
  border: '1px solid rgba(71,85,105,0.5)',
  borderRadius: '8px',
  padding: '8px 12px',
  color: '#e2e8f0',
  fontSize: '14px',
  outline: 'none',
  direction: 'rtl',
  width: '100%',
  boxSizing: 'border-box',
};

export default function Dashboard({ data, onNavigate, onSetPortfolioBase, onAddDeposit, onDeleteDeposit, onSetRiskUnit, onSetDefaultCommission }: DashboardProps) {
  const closedTrades = useMemo(() => data.trades.filter(isClosedTrade), [data.trades]);
  const openPositions = useMemo(() => data.trades.filter(t => t.status === 'open'), [data.trades]);
  const portfolioValue = getPortfolioValue(data);
  const totalPL = getTotalNetProfitLoss(closedTrades);
  const winRate = getWinRate(closedTrades);
  const equityCurve = getEquityCurve(data);
  const plCurve = getPLCurve(data);
  const recentTrades = [...closedTrades]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);

  // Open positions: current prices + unrealized P&L
  const [openPrices, setOpenPrices] = useState<Record<string, number>>({});
  const [loadingPrices, setLoadingPrices] = useState(false);
  const [showFinnhubInput, setShowFinnhubInput] = useState(false);
  const [finnhubKeyInput, setFinnhubKeyInput] = useState('');
  const [hasFinnhubKey, setHasFinnhubKey] = useState(() => !!localStorage.getItem(FINNHUB_KEY_STORAGE));
  const [priceStatus, setPriceStatus] = useState<string | null>(null);

  const fetchOpenPrices = useCallback(async () => {
    if (openPositions.length === 0) return;
    const apiKey = localStorage.getItem(FINNHUB_KEY_STORAGE);
    if (!apiKey) return;
    setLoadingPrices(true);
    const result: Record<string, number> = {};
    try {
      for (const pos of openPositions) {
        try {
          const res = await fetch(`https://finnhub.io/api/v1/quote?symbol=${pos.stockName.toUpperCase()}&token=${apiKey}`);
          const json = await res.json();
          if (json.c && json.c > 0) result[pos.id] = json.c;
          else if (json.error) setPriceStatus(`שגיאה: ${json.error}`);
        } catch { /* ignore single symbol error */ }
        await new Promise(r => setTimeout(r, 300));
      }
      setOpenPrices(result);
      const found = Object.keys(result).length;
      setPriceStatus(found > 0 ? `עודכנו ${found} מניות` : 'לא נמצאו מחירים — בדוק API Key');
    } finally {
      setLoadingPrices(false);
    }
  }, [openPositions]);

  useEffect(() => { fetchOpenPrices(); }, [fetchOpenPrices]);

  // Edit portfolio modal state
  const [showEditPortfolio, setShowEditPortfolio] = useState(false);
  const [editPortfolioVal, setEditPortfolioVal] = useState('');

  // Add deposit modal state
  const [showAddDeposit, setShowAddDeposit] = useState(false);
  const [depositAmount, setDepositAmount] = useState('');
  const [depositDate, setDepositDate] = useState(new Date().toISOString().split('T')[0]);
  const [depositNote, setDepositNote] = useState('');
  const [confirmDeleteDeposit, setConfirmDeleteDeposit] = useState<string | null>(null);

  const [editingRiskUnit, setEditingRiskUnit] = useState(false);
  const [riskUnitVal, setRiskUnitVal] = useState('');
  const [editingCommission, setEditingCommission] = useState(false);
  const [commissionVal, setCommissionVal] = useState('');

  const handleSavePortfolio = () => {
    const val = parseFloat(editPortfolioVal.replace(/,/g, ''));
    if (!isNaN(val) && val >= 0) {
      onSetPortfolioBase(val - totalPL); // base = desired total - current PL
      setShowEditPortfolio(false);
      setEditPortfolioVal('');
    }
  };

  const handleSaveDeposit = () => {
    const amount = parseFloat(depositAmount.replace(/,/g, ''));
    if (!isNaN(amount) && amount > 0 && depositDate) {
      onAddDeposit(amount, depositDate, depositNote);
      setDepositAmount('');
      setDepositNote('');
      setDepositDate(new Date().toISOString().split('T')[0]);
      setShowAddDeposit(false);
    }
  };

  const plColor = totalPL >= 0 ? '#22c55e' : '#ef4444';
  const plPercent = data.portfolioBaseValue > 0 ? (totalPL / data.portfolioBaseValue) * 100 : 0;

  const unreviewedCount = closedTrades.filter((t) => !t.conclusions?.trim()).length;

  const statCards = [
    {
      title: 'ערך תיק כולל',
      value: formatCurrency(portfolioValue),
      icon: DollarSign,
      color: '#0ea5e9',
      bg: 'rgba(14,165,233,0.1)',
      editable: true,
    },
    {
      title: 'רווח/הפסד כולל',
      value: formatCurrency(totalPL),
      sub: formatPercent(plPercent) + ' מהבסיס',
      icon: totalPL >= 0 ? TrendingUp : TrendingDown,
      color: plColor,
      bg: totalPL >= 0 ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
    },
    {
      title: 'אחוז הצלחה',
      value: winRate.toFixed(1) + '%',
      sub: `${closedTrades.filter((t) => t.totalProfitLoss > 0).length} מתוך ${closedTrades.length}`,
      icon: Percent,
      color: winRate >= 50 ? '#22c55e' : '#f59e0b',
      bg: winRate >= 50 ? 'rgba(34,197,94,0.1)' : 'rgba(245,158,11,0.1)',
    },
    {
      title: 'עסקאות סגורות',
      value: closedTrades.length.toString(),
      sub: `${closedTrades.filter((t) => t.type === 'long').length} לונג | ${closedTrades.filter((t) => t.type === 'short').length} שורט`,
      icon: Hash,
      color: '#facc15',
      bg: 'rgba(250,204,21,0.1)',
    },
    {
      title: 'עסקאות לתחקור',
      value: unreviewedCount.toString(),
      sub: `מתוך ${closedTrades.length} עסקאות סגורות`,
      icon: ClipboardList,
      color: unreviewedCount > 0 ? '#f59e0b' : '#10b981',
      bg: unreviewedCount > 0 ? 'rgba(245,158,11,0.1)' : 'rgba(16,185,129,0.1)',
    },
  ];

  return (
    <div style={{ padding: '28px', direction: 'rtl' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#f1f5f9', margin: 0 }}>דשבורד</h1>
        <p style={{ color: '#64748b', fontSize: '14px', marginTop: '4px' }}>
          סקירת תיק ההשקעות שלך
        </p>
      </div>

      {/* Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px', marginBottom: '24px' }}>
        {statCards.map((sc, i) => {
          const Icon = sc.icon;
          return (
            <div key={i} style={card()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                    <span style={{ fontSize: '12px', color: '#64748b' }}>{sc.title}</span>
                    {sc.editable && (
                      <button
                        onClick={() => {
                          setEditPortfolioVal(portfolioValue.toFixed(2));
                          setShowEditPortfolio(true);
                        }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: '#475569', display: 'flex' }}
                        title="ערוך ערך תיק"
                      >
                        <Edit2 size={11} />
                      </button>
                    )}
                  </div>
                  <div style={{ fontSize: '22px', fontWeight: 700, color: sc.color }}>{sc.value}</div>
                  {sc.sub && (
                    <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>{sc.sub}</div>
                  )}
                </div>
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: sc.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon size={20} color={sc.color} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Trading Settings Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
        {/* Risk Unit Setting */}
        <div style={card({ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px' })}>
          <div>
            <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>יחידת סיכון (R)</div>
            {editingRiskUnit ? (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  type="number"
                  value={riskUnitVal}
                  onChange={(e) => setRiskUnitVal(e.target.value)}
                  style={{ ...inputStyle, width: '100px', padding: '6px 10px', fontSize: '14px' }}
                  autoFocus
                  placeholder="100"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { const v = parseFloat(riskUnitVal); if (!isNaN(v) && v > 0) { onSetRiskUnit(v); setEditingRiskUnit(false); } }
                    if (e.key === 'Escape') setEditingRiskUnit(false);
                  }}
                />
                <button onClick={() => { const v = parseFloat(riskUnitVal); if (!isNaN(v) && v > 0) { onSetRiskUnit(v); setEditingRiskUnit(false); } }} style={{ backgroundColor: '#0284c7', color: 'white', border: 'none', borderRadius: '6px', padding: '6px 12px', fontSize: '13px', cursor: 'pointer' }}>שמור</button>
                <button onClick={() => setEditingRiskUnit(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}><X size={14} /></button>
              </div>
            ) : (
              <div style={{ fontSize: '20px', fontWeight: 700, color: '#f59e0b' }}>
                {formatCurrency(data.riskUnitValue ?? 100)}
                <span style={{ fontSize: '12px', color: '#64748b', marginRight: '6px' }}>לכל R</span>
              </div>
            )}
          </div>
          {!editingRiskUnit && (
            <button onClick={() => { setRiskUnitVal(String(data.riskUnitValue ?? 100)); setEditingRiskUnit(true); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569' }}>
              <Edit2 size={14} />
            </button>
          )}
        </div>

        {/* Commission Setting */}
        <div style={card({ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px' })}>
          <div>
            <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>עמלה ברירת מחדל לפעולה</div>
            {editingCommission ? (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  type="number"
                  value={commissionVal}
                  onChange={(e) => setCommissionVal(e.target.value)}
                  style={{ ...inputStyle, width: '100px', padding: '6px 10px', fontSize: '14px' }}
                  autoFocus
                  placeholder="2.5"
                  step="0.5"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { const v = parseFloat(commissionVal); if (!isNaN(v) && v >= 0) { onSetDefaultCommission(v); setEditingCommission(false); } }
                    if (e.key === 'Escape') setEditingCommission(false);
                  }}
                />
                <button onClick={() => { const v = parseFloat(commissionVal); if (!isNaN(v) && v >= 0) { onSetDefaultCommission(v); setEditingCommission(false); } }} style={{ backgroundColor: '#0284c7', color: 'white', border: 'none', borderRadius: '6px', padding: '6px 12px', fontSize: '13px', cursor: 'pointer' }}>שמור</button>
                <button onClick={() => setEditingCommission(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}><X size={14} /></button>
              </div>
            ) : (
              <div style={{ fontSize: '20px', fontWeight: 700, color: '#a78bfa' }}>
                {formatCurrency(data.defaultCommissionPerAction ?? 2.5)}
                <span style={{ fontSize: '12px', color: '#64748b', marginRight: '6px' }}>לקנייה / מכירה</span>
              </div>
            )}
          </div>
          {!editingCommission && (
            <button onClick={() => { setCommissionVal(String(data.defaultCommissionPerAction ?? 2.5)); setEditingCommission(true); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569' }}>
              <Edit2 size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Equity Curve — total portfolio value */}
      <div style={{ ...card(), marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#f1f5f9', margin: 0 }}>עקומת הון כוללת</h2>
            <p style={{ fontSize: '12px', color: '#475569', margin: '4px 0 0' }}>ערך התיק לאורך זמן — כולל הפקדות ורווחים</p>
          </div>
          <div style={{ fontSize: '13px', fontWeight: 700, color: '#0ea5e9' }}>{formatCurrency(portfolioValue)}</div>
        </div>
        {equityCurve.length > 1 ? (
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={equityCurve} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
              <defs>
                <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(71,85,105,0.3)" />
              <XAxis dataKey="date" tickFormatter={(v) => formatDate(v)} tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={(v) => '$' + v.toLocaleString()} tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} width={80} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid rgba(71,85,105,0.5)', borderRadius: '8px', color: '#e2e8f0' }}
                formatter={(value, _name, props) => [
                  formatCurrency(Number(value)),
                  props.payload?.label === 'הפקדה' ? 'הפקדה + עדכון' : 'ערך תיק',
                ]}
                labelFormatter={(label) => formatDate(label)}
              />
              <Area type="monotone" dataKey="value" stroke="#0ea5e9" strokeWidth={2} fill="url(#equityGrad)" dot={(props) => {
                if (props.payload?.label === 'הפקדה') {
                  return <circle key={props.key} cx={props.cx} cy={props.cy} r={5} fill="#fbbf24" stroke="#1e293b" strokeWidth={2} />;
                }
                return <circle key={props.key} cx={0} cy={0} r={0} fill="none" />;
              }} />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div style={{ height: '240px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569' }}>
            <Activity size={40} style={{ opacity: 0.3 }} />
            <span style={{ marginRight: '12px' }}>אין מספיק נתונים להצגת גרף</span>
          </div>
        )}
        {equityCurve.some((p) => p.label === 'הפקדה') && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '10px' }}>
            <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#fbbf24' }} />
            <span style={{ fontSize: '11px', color: '#64748b' }}>נקודה צהובה = הפקדת הון</span>
          </div>
        )}
      </div>

      {/* P&L Curve — trades only */}
      <div style={{ ...card(), marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#f1f5f9', margin: 0 }}>רווח/הפסד מעסקאות</h2>
            <p style={{ fontSize: '12px', color: '#475569', margin: '4px 0 0' }}>תנועת P&L מצטברת מעסקאות בלבד — ללא הפקדות</p>
          </div>
          <div style={{ fontSize: '13px', fontWeight: 700, color: totalPL >= 0 ? '#22c55e' : '#ef4444' }}>
            {formatCurrency(totalPL)}
          </div>
        </div>
        {plCurve.length > 1 ? (
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={plCurve} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
              <defs>
                <linearGradient id="plGradPos" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="plGradNeg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.02} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0.25} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(71,85,105,0.3)" />
              <XAxis dataKey="date" tickFormatter={(v) => formatDate(v)} tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={(v) => (v >= 0 ? '+$' : '-$') + Math.abs(v).toLocaleString()} tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} width={86} />
              <ReferenceLine y={0} stroke="rgba(71,85,105,0.6)" strokeDasharray="4 4" />
              <Tooltip
                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid rgba(71,85,105,0.5)', borderRadius: '8px', color: '#e2e8f0' }}
                formatter={(value) => [formatCurrency(Number(value)), 'P&L מצטבר']}
                labelFormatter={(label) => formatDate(label)}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke={totalPL >= 0 ? '#22c55e' : '#ef4444'}
                strokeWidth={2}
                fill={totalPL >= 0 ? 'url(#plGradPos)' : 'url(#plGradNeg)'}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div style={{ height: '240px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569' }}>
            <Activity size={40} style={{ opacity: 0.3 }} />
            <span style={{ marginRight: '12px' }}>אין מספיק נתונים להצגת גרף</span>
          </div>
        )}
      </div>

      {/* Open Positions Card */}
      {openPositions.length > 0 && (
        <div style={{ ...card(), marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#f1f5f9', margin: 0 }}>
                פוזיציות פתוחות
                <span style={{ marginRight: '8px', fontSize: '12px', fontWeight: 600, color: '#d97706', backgroundColor: 'rgba(217,119,6,0.15)', padding: '2px 8px', borderRadius: '4px', border: '1px solid rgba(217,119,6,0.3)' }}>{openPositions.length}</span>
              </h2>
              <p style={{ fontSize: '12px', color: '#475569', margin: '4px 0 0' }}>P&L לא ממומש — לפי מחיר שוק נוכחי</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {priceStatus && (
                <span style={{ fontSize: '12px', color: priceStatus.startsWith('שגיאה') || priceStatus.includes('בדוק') ? '#ef4444' : '#22c55e' }}>
                  {priceStatus}
                </span>
              )}
              <button
                onClick={() => {
                  if (!localStorage.getItem(FINNHUB_KEY_STORAGE)) {
                    setShowFinnhubInput(true);
                  } else {
                    setPriceStatus(null);
                    fetchOpenPrices();
                  }
                }}
                disabled={loadingPrices}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: 'rgba(71,85,105,0.2)', color: '#94a3b8', border: '1px solid rgba(71,85,105,0.4)', borderRadius: '8px', padding: '7px 14px', fontSize: '13px', cursor: loadingPrices ? 'default' : 'pointer', opacity: loadingPrices ? 0.6 : 1 }}
              >
                <RefreshCw size={13} />
                {loadingPrices ? 'טוען...' : 'רענן מחירים'}
              </button>
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(71,85,105,0.4)' }}>
                  {['מניה', 'סוג', 'כמות', 'כניסה ממוצעת', 'מחיר נוכחי', 'P&L לא ממומש', '%'].map((h) => (
                    <th key={h} style={{ padding: '8px 12px', color: '#64748b', fontWeight: 500, textAlign: 'right' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {openPositions.map((pos) => {
                  const currentPrice = openPrices[pos.id];
                  const openShares = getOpenShares(pos);
                  const unrealizedPL = currentPrice
                    ? pos.type === 'long'
                      ? (currentPrice - pos.avgEntryPrice) * openShares
                      : (pos.avgEntryPrice - currentPrice) * openShares
                    : null;
                  const unrealizedPct = unrealizedPL !== null && pos.totalInvested > 0
                    ? (unrealizedPL / pos.totalInvested) * 100
                    : null;
                  const isGain = unrealizedPL !== null && unrealizedPL >= 0;
                  return (
                    <tr
                      key={pos.id}
                      style={{ borderBottom: '1px solid rgba(71,85,105,0.2)', backgroundColor: unrealizedPL !== null ? (isGain ? 'rgba(34,197,94,0.05)' : 'rgba(239,68,68,0.05)') : 'rgba(217,119,6,0.04)', cursor: 'pointer' }}
                      onClick={() => onNavigate('edit-trade', pos.id)}
                    >
                      <td style={{ padding: '10px 12px', color: '#f1f5f9', fontWeight: 700 }}>
                        {pos.stockName}
                        {pos.ibkrImported && <span style={{ marginRight: '6px', fontSize: '10px', color: '#64748b' }}>IBKR</span>}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600, backgroundColor: pos.type === 'long' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', color: pos.type === 'long' ? '#22c55e' : '#ef4444' }}>
                          {pos.type === 'long' ? 'לונג' : 'שורט'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', color: '#e2e8f0' }}>{openShares.toLocaleString()}</td>
                      <td style={{ padding: '10px 12px', color: '#e2e8f0' }}>{formatCurrency(pos.avgEntryPrice)}</td>
                      <td style={{ padding: '10px 12px', color: currentPrice ? '#f1f5f9' : '#475569' }}>
                        {currentPrice ? formatCurrency(currentPrice) : '—'}
                      </td>
                      <td style={{ padding: '10px 12px', color: unrealizedPL !== null ? (isGain ? '#22c55e' : '#ef4444') : '#475569', fontWeight: unrealizedPL !== null ? 700 : 400 }}>
                        {unrealizedPL !== null ? formatCurrency(unrealizedPL) : '—'}
                      </td>
                      <td style={{ padding: '10px 12px', color: unrealizedPct !== null ? (isGain ? '#22c55e' : '#ef4444') : '#475569' }}>
                        {unrealizedPct !== null ? formatPercent(unrealizedPct) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!hasFinnhubKey && !showFinnhubInput && (
            <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '12px', color: '#475569' }}>להצגת מחיר חי נדרש Finnhub API Key</span>
              <button
                onClick={() => setShowFinnhubInput(true)}
                style={{ fontSize: '12px', color: '#0ea5e9', background: 'none', border: '1px solid rgba(14,165,233,0.4)', borderRadius: '6px', padding: '3px 10px', cursor: 'pointer' }}
              >
                הוסף מפתח
              </button>
            </div>
          )}
          {showFinnhubInput && (
            <div style={{ marginTop: '12px', display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                type="text"
                value={finnhubKeyInput}
                onChange={(e) => setFinnhubKeyInput(e.target.value)}
                placeholder="Finnhub API Key"
                style={{ ...inputStyle, maxWidth: '280px', direction: 'ltr' }}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && finnhubKeyInput.trim()) {
                    localStorage.setItem(FINNHUB_KEY_STORAGE, finnhubKeyInput.trim());
                    setHasFinnhubKey(true);
                    setShowFinnhubInput(false);
                    setFinnhubKeyInput('');
                    fetchOpenPrices();
                  }
                  if (e.key === 'Escape') setShowFinnhubInput(false);
                }}
              />
              <button
                onClick={() => {
                  if (finnhubKeyInput.trim()) {
                    localStorage.setItem(FINNHUB_KEY_STORAGE, finnhubKeyInput.trim());
                    setHasFinnhubKey(true);
                    setShowFinnhubInput(false);
                    setFinnhubKeyInput('');
                    fetchOpenPrices();
                  }
                }}
                style={{ backgroundColor: '#0284c7', color: 'white', border: 'none', borderRadius: '6px', padding: '6px 14px', fontSize: '13px', cursor: 'pointer' }}
              >
                שמור
              </button>
              <button onClick={() => setShowFinnhubInput(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                <X size={14} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Two columns: Recent Trades + Deposits */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '20px' }}>

        {/* Recent Trades */}
        <div style={card()}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#f1f5f9', margin: 0 }}>עסקאות אחרונות</h2>
            <button onClick={() => onNavigate('trades')} style={{ fontSize: '13px', color: '#0ea5e9', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px' }}>
              הצג הכל
            </button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(71,85,105,0.4)' }}>
                  {['תאריך', 'מניה', 'סוג', 'רווח/הפסד', '%'].map((h) => (
                    <th key={h} style={{ padding: '8px 12px', color: '#64748b', fontWeight: 500, textAlign: 'right' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentTrades.map((trade) => {
                  const netPL = getNetProfitLoss(trade);
                  const isProfit = netPL >= 0;
                  return (
                    <tr
                      key={trade.id}
                      style={{ borderBottom: '1px solid rgba(71,85,105,0.2)', backgroundColor: isProfit ? 'rgba(34,197,94,0.04)' : 'rgba(239,68,68,0.04)', cursor: 'pointer' }}
                      onClick={() => onNavigate('edit-trade', trade.id)}
                    >
                      <td style={{ padding: '10px 12px', color: '#94a3b8' }}>{formatDate(trade.date)}</td>
                      <td style={{ padding: '10px 12px', color: '#f1f5f9', fontWeight: 600 }}>{trade.stockName}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600, backgroundColor: trade.type === 'long' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', color: trade.type === 'long' ? '#22c55e' : '#ef4444' }}>
                          {trade.type === 'long' ? 'לונג' : 'שורט'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', color: isProfit ? '#22c55e' : '#ef4444', fontWeight: 600 }}>
                        {formatCurrency(netPL)}
                      </td>
                      <td style={{ padding: '10px 12px', color: isProfit ? '#22c55e' : '#ef4444' }}>
                        {formatPercent(trade.totalProfitLossPercent)}
                      </td>
                    </tr>
                  );
                })}
                {recentTrades.length === 0 && (
                  <tr><td colSpan={5} style={{ textAlign: 'center', padding: '40px', color: '#475569' }}>אין עסקאות עדיין</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Deposits Panel */}
        <div style={card({ display: 'flex', flexDirection: 'column' })}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#f1f5f9', margin: 0 }}>הפקדות הון</h2>
            <button
              onClick={() => setShowAddDeposit(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: '#0284c7', color: 'white', border: 'none', borderRadius: '7px', padding: '6px 12px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
            >
              <Plus size={13} /> הוסף
            </button>
          </div>

          {/* Summary */}
          <div style={{ backgroundColor: '#0f172a', borderRadius: '8px', padding: '12px', marginBottom: '14px', display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#64748b', fontSize: '13px' }}>סה"כ הופקד</span>
            <span style={{ color: '#0ea5e9', fontWeight: 700, fontSize: '14px' }}>{formatCurrency(data.portfolioBaseValue)}</span>
          </div>

          {/* Deposits list */}
          <div style={{ flex: 1, overflowY: 'auto', maxHeight: '260px' }}>
            {[...data.deposits].sort((a, b) => b.date.localeCompare(a.date)).map((dep) => (
              <div key={dep.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid rgba(71,85,105,0.2)' }}>
                <div>
                  <div style={{ color: '#22c55e', fontWeight: 600, fontSize: '14px' }}>+{formatCurrency(dep.amount)}</div>
                  <div style={{ color: '#475569', fontSize: '11px', marginTop: '2px' }}>
                    {formatDate(dep.date)}{dep.note ? ` · ${dep.note}` : ''}
                  </div>
                </div>
                {confirmDeleteDeposit === dep.id ? (
                  <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', color: '#ef4444' }}>למחוק?</span>
                    <button onClick={() => { onDeleteDeposit(dep.id); setConfirmDeleteDeposit(null); }} style={{ padding: '3px 8px', borderRadius: '4px', border: 'none', backgroundColor: '#ef4444', color: 'white', fontSize: '11px', cursor: 'pointer' }}>כן</button>
                    <button onClick={() => setConfirmDeleteDeposit(null)} style={{ padding: '3px 8px', borderRadius: '4px', border: '1px solid rgba(71,85,105,0.5)', backgroundColor: 'transparent', color: '#94a3b8', fontSize: '11px', cursor: 'pointer' }}>לא</button>
                  </div>
                ) : (
                  <button onClick={() => setConfirmDeleteDeposit(dep.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569', padding: '4px', display: 'flex' }}>
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            ))}
            {data.deposits.length === 0 && (
              <div style={{ textAlign: 'center', padding: '32px 0', color: '#475569', fontSize: '13px' }}>אין הפקדות עדיין</div>
            )}
          </div>
        </div>
      </div>

      {/* Edit Portfolio Modal */}
      {showEditPortfolio && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: '#1e293b', borderRadius: '16px', border: '1px solid rgba(71,85,105,0.5)', padding: '28px', width: '360px', direction: 'rtl' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, color: '#f1f5f9', fontSize: '18px' }}>עריכת ערך התיק</h3>
              <button onClick={() => setShowEditPortfolio(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}><X size={20} /></button>
            </div>
            <p style={{ color: '#64748b', fontSize: '13px', marginTop: 0, marginBottom: '16px' }}>
              הכנס את ערך התיק הנוכחי כפי שמופיע אצל הברוקר שלך. הבסיס יתעדכן בהתאם.
            </p>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', color: '#94a3b8', fontSize: '13px', marginBottom: '6px' }}>ערך תיק כולל ($)</label>
              <input
                type="number"
                value={editPortfolioVal}
                onChange={(e) => setEditPortfolioVal(e.target.value)}
                style={inputStyle}
                placeholder="לדוגמה: 15000"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleSavePortfolio()}
              />
              <div style={{ fontSize: '12px', color: '#475569', marginTop: '6px' }}>
                ערך נוכחי: {formatCurrency(portfolioValue)}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={handleSavePortfolio} style={{ flex: 1, backgroundColor: '#0284c7', color: 'white', border: 'none', borderRadius: '8px', padding: '10px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
                שמור
              </button>
              <button onClick={() => setShowEditPortfolio(false)} style={{ flex: 1, backgroundColor: 'transparent', color: '#94a3b8', border: '1px solid rgba(71,85,105,0.5)', borderRadius: '8px', padding: '10px', fontSize: '14px', cursor: 'pointer' }}>
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Deposit Modal */}
      {showAddDeposit && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: '#1e293b', borderRadius: '16px', border: '1px solid rgba(71,85,105,0.5)', padding: '28px', width: '360px', direction: 'rtl' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, color: '#f1f5f9', fontSize: '18px' }}>הוספת הפקדה</h3>
              <button onClick={() => setShowAddDeposit(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}><X size={20} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
              <div>
                <label style={{ display: 'block', color: '#94a3b8', fontSize: '13px', marginBottom: '6px' }}>סכום ($)</label>
                <input type="number" value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} style={inputStyle} placeholder="לדוגמה: 2000" autoFocus />
              </div>
              <div>
                <label style={{ display: 'block', color: '#94a3b8', fontSize: '13px', marginBottom: '6px' }}>תאריך</label>
                <input type="date" value={depositDate} onChange={(e) => setDepositDate(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={{ display: 'block', color: '#94a3b8', fontSize: '13px', marginBottom: '6px' }}>הערה (אופציונלי)</label>
                <input type="text" value={depositNote} onChange={(e) => setDepositNote(e.target.value)} style={inputStyle} placeholder="לדוגמה: הפקדה חודשית" onKeyDown={(e) => e.key === 'Enter' && handleSaveDeposit()} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={handleSaveDeposit} style={{ flex: 1, backgroundColor: '#16a34a', color: 'white', border: 'none', borderRadius: '8px', padding: '10px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
                הוסף הפקדה
              </button>
              <button onClick={() => setShowAddDeposit(false)} style={{ flex: 1, backgroundColor: 'transparent', color: '#94a3b8', border: '1px solid rgba(71,85,105,0.5)', borderRadius: '8px', padding: '10px', fontSize: '14px', cursor: 'pointer' }}>
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
