import React, { useState, useEffect } from 'react';
import type { Trade, TradeEntry, TradeExit } from '../types/trade';
import { generateId } from '../utils/storage';
import { calculateAvgEntryPrice, formatCurrency } from '../utils/calculations';
import { Plus, X, ChevronDown, ChevronUp } from 'lucide-react';

interface TradeFormProps {
  existing?: Trade;
  nextSerial: number;
  defaultCommissionPerAction: number;
  onSave: (trade: Trade) => void;
  onCancel: () => void;
}

const BEHAVIORAL_TAGS = [
  { id: 'good-trade', label: 'עסקה טובה', color: '#22c55e' },
  { id: 'self-analysis', label: 'ניתוח עצמי', color: '#3b82f6' },
  { id: 'by-raz', label: 'לפי רז', color: '#a78bfa' },
  { id: 'by-niv', label: 'לפי ניב', color: '#fbbf24' },
  { id: 'FOMO', label: 'FOMO', color: '#f43f5e' },
  { id: 'movement-entry', label: 'כניסה בתנועה', color: '#f43f5e' },
  { id: 'low-confidence', label: 'כניסה עם ביטחון נמוך', color: '#f43f5e' },
  { id: 'early-entry', label: 'כניסה מוקדמת', color: '#f43f5e' },
  { id: 'adding-before-confirmation', label: 'הוספה לפני אישור', color: '#f43f5e' },
  { id: 'unexecuted-limit', label: 'לימיט שלא בוצע', color: '#f43f5e' },
  { id: 'early-exit', label: 'יציאה מוקדמת', color: '#f43f5e' },
  { id: 'late-exit', label: 'יציאה מאוחרת', color: '#f43f5e' },
  { id: 'risk-unit-deviation', label: 'חריגה מיחידת סיכון', color: '#f43f5e' },
  { id: 'missed-key-points', label: 'פספוס נקודות מפתח', color: '#f43f5e' },
  { id: 'profit-to-loss', label: 'המרת רווח להפסד', color: '#f43f5e' },
  { id: 'trade-infatuation', label: 'התאהבות בעסקה', color: '#f43f5e' },
  { id: 'work-after-exit', label: 'עבודה אחרי יציאה', color: '#f43f5e' },
  { id: 'stock-based-management', label: 'ניהול על בסיס המניה', color: '#f43f5e' },
  { id: 'wrong-goal-planning', label: 'תכנון מטרה שגוי', color: '#f43f5e' },
  { id: 'tight-stop-loss', label: 'סטופ לוס צמוד', color: '#f43f5e' },
  { id: 'wrong-share-quantity', label: 'כמות מניות שגויה', color: '#f43f5e' },
  { id: 'poor-management', label: 'ניהול לקוי', color: '#f43f5e' },
  { id: 'no-plan', label: 'אין תוכנית', color: '#f43f5e' },
  { id: 'mistake', label: 'עסקה בטעות', color: '#f43f5e' },
  { id: 'no-follow', label: 'לא עקבתי אחר התוכנית', color: '#f43f5e' },
];

const inputStyle: React.CSSProperties = {
  backgroundColor: '#0f172a',
  border: '1px solid rgba(71,85,105,0.5)',
  borderRadius: '8px',
  padding: '9px 12px',
  color: '#e2e8f0',
  fontSize: '14px',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
  direction: 'rtl',
};

const labelStyle: React.CSSProperties = {
  fontSize: '12px',
  color: '#94a3b8',
  marginBottom: '5px',
  display: 'block',
};

const sectionStyle: React.CSSProperties = {
  backgroundColor: '#1e293b',
  borderRadius: '12px',
  border: '1px solid rgba(71,85,105,0.4)',
  padding: '20px',
  marginBottom: '16px',
};

const sectionTitle: React.CSSProperties = {
  fontSize: '15px',
  fontWeight: 600,
  color: '#f1f5f9',
  marginBottom: '16px',
  marginTop: 0,
};

function emptyEntry(): TradeEntry {
  return { price: 0, quantity: 0, totalAmount: 0 };
}

function emptyExit(): TradeExit {
  return { price: 0, quantity: 0, totalAmount: 0, profitLoss: 0, profitLossPercent: 0, notes: '' };
}

export default function TradeForm({ existing, nextSerial, defaultCommissionPerAction, onSave, onCancel }: TradeFormProps) {
  const [type, setType] = useState<'long' | 'short'>(existing?.type ?? 'long');
  const [stockName, setStockName] = useState(existing?.stockName ?? '');
  const [date, setDate] = useState(existing?.date ?? new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [entryReason, setEntryReason] = useState(existing?.entryReason ?? '');
  const [exitReason, setExitReason] = useState(existing?.exitReason ?? '');
  const [conclusions, setConclusions] = useState(existing?.conclusions ?? '');
  const [behavioralTags, setBehavioralTags] = useState<string[]>(existing?.behavioralTags ?? []);
  const [showReinforcements, setShowReinforcements] = useState(
    (existing?.reinforcements?.length ?? 0) > 0
  );
  const [commissionsManual, setCommissionsManual] = useState(false);
  const [commissions, setCommissions] = useState(existing?.commissions ?? defaultCommissionPerAction * 2);

  const [initialEntry, setInitialEntry] = useState<TradeEntry>(
    existing?.initialEntry ?? { price: 0, quantity: 0, sl: 0, tp: 0, totalAmount: 0, risk: 0 }
  );
  const [reinforcements, setReinforcements] = useState<TradeEntry[]>(
    existing?.reinforcements ?? []
  );
  const [exits, setExits] = useState<TradeExit[]>(
    existing?.exits?.length ? existing.exits : [emptyExit()]
  );

  // Auto-calc commissions: 1 entry + reinforcements + exits
  useEffect(() => {
    if (!commissionsManual) {
      const legs = 1 + reinforcements.length + exits.filter(e => e.price > 0 && e.quantity > 0).length;
      setCommissions(Math.round(legs * defaultCommissionPerAction * 100) / 100);
    }
  }, [reinforcements.length, exits, commissionsManual, defaultCommissionPerAction]);

  // Live calculations
  const avgEntry = calculateAvgEntryPrice(initialEntry, reinforcements);
  const totalShares =
    initialEntry.quantity + reinforcements.reduce((s, r) => s + r.quantity, 0);
  const totalInvested = avgEntry * totalShares;

  const totalPL = exits.reduce((sum, ex) => {
    if (!ex.price || !ex.quantity) return sum;
    const exitTotal = ex.price * ex.quantity;
    const costBasis = avgEntry * ex.quantity;
    return sum + (type === 'long' ? exitTotal - costBasis : costBasis - exitTotal);
  }, 0);

  const netPL = totalPL - commissions;
  const totalPLPercent = totalInvested > 0 ? (totalPL / totalInvested) * 100 : 0;
  const netPLPercent = totalInvested > 0 ? (netPL / totalInvested) * 100 : 0;

  const risk =
    initialEntry.sl && initialEntry.sl > 0
      ? Math.abs(initialEntry.price - initialEntry.sl) * initialEntry.quantity
      : 0;
  const rr = risk > 0 ? totalPL / risk : 0;

  useEffect(() => {
    setInitialEntry((prev) => ({
      ...prev,
      totalAmount: prev.price * prev.quantity,
      risk:
        prev.sl && prev.sl > 0
          ? Math.abs(prev.price - prev.sl) * prev.quantity
          : 0,
    }));
  }, [initialEntry.price, initialEntry.quantity, initialEntry.sl]);

  const updateReinforcement = (idx: number, field: keyof TradeEntry, value: number) => {
    setReinforcements((prev) => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [field]: value };
      updated[idx].totalAmount = updated[idx].price * updated[idx].quantity;
      return updated;
    });
  };

  const updateExit = (idx: number, field: keyof TradeExit, value: string | number) => {
    setExits((prev) => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [field]: value };
      if (field === 'price' || field === 'quantity') {
        const ex = updated[idx];
        updated[idx].totalAmount = ex.price * ex.quantity;
        const costBasis = avgEntry * ex.quantity;
        updated[idx].profitLoss =
          type === 'long'
            ? ex.price * ex.quantity - costBasis
            : costBasis - ex.price * ex.quantity;
        updated[idx].profitLossPercent =
          costBasis > 0 ? (updated[idx].profitLoss / costBasis) * 100 : 0;
      }
      return updated;
    });
  };

  const handleSave = () => {
    if (!stockName.trim()) {
      alert('נא להזין שם מניה');
      return;
    }
    if (!initialEntry.price || !initialEntry.quantity) {
      alert('נא להזין מחיר וכמות לכניסה הראשונית');
      return;
    }

    const trade: Trade = {
      id: existing?.id ?? generateId(),
      serialNumber: existing?.serialNumber ?? nextSerial,
      type,
      stockName: stockName.toUpperCase().trim(),
      date,
      initialEntry: {
        ...initialEntry,
        totalAmount: initialEntry.price * initialEntry.quantity,
        risk,
      },
      reinforcements: reinforcements.filter((r) => r.price > 0 && r.quantity > 0),
      exits: exits.filter((e) => e.price > 0 && e.quantity > 0),
      totalShares,
      avgEntryPrice: avgEntry,
      totalInvested,
      totalProfitLoss: Math.round(totalPL * 100) / 100,
      totalProfitLossPercent: Math.round(totalPLPercent * 100) / 100,
      rr: Math.round(rr * 100) / 100,
      commissions: Math.round(commissions * 100) / 100,
      entryReason,
      exitReason,
      conclusions,
      notes,
      behavioralTags,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      status: existing?.status,
      ibkrImported: existing?.ibkrImported,
    };
    onSave(trade);
  };

  const toggleTag = (tag: string) => {
    setBehavioralTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  return (
    <div style={{ padding: '28px', direction: 'rtl', maxWidth: '800px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#f1f5f9', margin: 0 }}>
            {existing ? 'עריכת עסקה' : 'עסקה חדשה'}
          </h1>
          <p style={{ color: '#64748b', fontSize: '14px', marginTop: '4px' }}>
            {existing ? `עסקה #${existing.serialNumber}` : 'הוספת עסקה חדשה ליומן'}
          </p>
        </div>
        <button
          onClick={onCancel}
          style={{
            padding: '8px 16px',
            borderRadius: '8px',
            border: '1px solid rgba(71,85,105,0.5)',
            backgroundColor: 'transparent',
            color: '#94a3b8',
            cursor: 'pointer',
            fontSize: '14px',
          }}
        >
          ביטול
        </button>
      </div>

      {/* Section 1: Trade Details */}
      <div style={sectionStyle}>
        <h2 style={sectionTitle}>פרטי עסקה</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '16px' }}>
          <div>
            <label style={labelStyle}>סוג עסקה</label>
            <div style={{ display: 'flex', gap: '0', backgroundColor: '#0f172a', borderRadius: '8px', padding: '3px' }}>
              {(['long', 'short'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  style={{
                    flex: 1,
                    padding: '8px',
                    borderRadius: '6px',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: 600,
                    backgroundColor:
                      type === t
                        ? t === 'long'
                          ? '#15803d'
                          : '#b91c1c'
                        : 'transparent',
                    color: type === t ? 'white' : '#64748b',
                    transition: 'all 0.15s',
                  }}
                >
                  {t === 'long' ? 'לונג' : 'שורט'}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label style={labelStyle}>שם מניה</label>
            <input
              type="text"
              value={stockName}
              onChange={(e) => setStockName(e.target.value.toUpperCase())}
              placeholder="AAPL"
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>תאריך</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>עמלות ($)</label>
            <input
              type="number"
              value={commissions || ''}
              onChange={(e) => {
                setCommissionsManual(true);
                setCommissions(parseFloat(e.target.value) || 0);
              }}
              placeholder="5.00"
              style={inputStyle}
              step="0.01"
            />
          </div>
        </div>
      </div>

      {/* Section 2: Initial Entry */}
      <div style={sectionStyle}>
        <h2 style={sectionTitle}>כניסה ראשונית</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px' }}>
          <div>
            <label style={labelStyle}>מחיר כניסה</label>
            <input
              type="number"
              value={initialEntry.price || ''}
              onChange={(e) =>
                setInitialEntry((p) => ({ ...p, price: parseFloat(e.target.value) || 0 }))
              }
              placeholder="0.00"
              style={inputStyle}
              step="0.01"
            />
          </div>
          <div>
            <label style={labelStyle}>כמות</label>
            <input
              type="number"
              value={initialEntry.quantity || ''}
              onChange={(e) =>
                setInitialEntry((p) => ({ ...p, quantity: parseInt(e.target.value) || 0 }))
              }
              placeholder="0"
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Stop Loss</label>
            <input
              type="number"
              value={initialEntry.sl || ''}
              onChange={(e) =>
                setInitialEntry((p) => ({ ...p, sl: parseFloat(e.target.value) || 0 }))
              }
              placeholder="0.00"
              style={inputStyle}
              step="0.01"
            />
          </div>
          <div>
            <label style={labelStyle}>Take Profit</label>
            <input
              type="number"
              value={initialEntry.tp || ''}
              onChange={(e) =>
                setInitialEntry((p) => ({ ...p, tp: parseFloat(e.target.value) || 0 }))
              }
              placeholder="0.00"
              style={inputStyle}
              step="0.01"
            />
          </div>
          <div>
            <label style={labelStyle}>סה"כ</label>
            <div
              style={{
                ...inputStyle,
                backgroundColor: '#162032',
                color: '#94a3b8',
                cursor: 'default',
              }}
            >
              {formatCurrency(initialEntry.price * initialEntry.quantity)}
            </div>
          </div>
        </div>
        {risk > 0 && (
          <div style={{ marginTop: '12px', padding: '10px', backgroundColor: 'rgba(239,68,68,0.08)', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.2)' }}>
            <span style={{ color: '#94a3b8', fontSize: '13px' }}>סיכון מחושב: </span>
            <span style={{ color: '#ef4444', fontWeight: 700 }}>{formatCurrency(risk)}</span>
          </div>
        )}
      </div>

      {/* Section 3: Reinforcements */}
      <div style={sectionStyle}>
        <button
          onClick={() => setShowReinforcements((p) => !p)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: '#f1f5f9',
            fontSize: '15px',
            fontWeight: 600,
            padding: 0,
            marginBottom: showReinforcements ? '16px' : 0,
          }}
        >
          {showReinforcements ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          חיזוקי פוזיציה ({reinforcements.length})
        </button>
        {showReinforcements && (
          <>
            {reinforcements.map((r, idx) => (
              <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr auto', gap: '12px', marginBottom: '12px', alignItems: 'end' }}>
                <div>
                  <label style={labelStyle}>מחיר חיזוק {idx + 1}</label>
                  <input
                    type="number"
                    value={r.price || ''}
                    onChange={(e) => updateReinforcement(idx, 'price', parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                    style={inputStyle}
                    step="0.01"
                  />
                </div>
                <div>
                  <label style={labelStyle}>כמות</label>
                  <input
                    type="number"
                    value={r.quantity || ''}
                    onChange={(e) => updateReinforcement(idx, 'quantity', parseInt(e.target.value) || 0)}
                    placeholder="0"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>תאריך חיזוק</label>
                  <input
                    type="date"
                    value={r.date || ''}
                    onChange={(e) => setReinforcements((prev) => {
                      const updated = [...prev];
                      updated[idx] = { ...updated[idx], date: e.target.value };
                      return updated;
                    })}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>סה"כ</label>
                  <div style={{ ...inputStyle, backgroundColor: '#162032', color: '#94a3b8', cursor: 'default' }}>
                    {formatCurrency(r.price * r.quantity)}
                  </div>
                </div>
                <button
                  onClick={() => setReinforcements((prev) => prev.filter((_, i) => i !== idx))}
                  style={{
                    padding: '9px',
                    borderRadius: '8px',
                    border: '1px solid rgba(239,68,68,0.3)',
                    backgroundColor: 'transparent',
                    color: '#ef4444',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <X size={14} />
                </button>
              </div>
            ))}
            {reinforcements.length < 3 && (
              <button
                onClick={() => setReinforcements((prev) => [...prev, emptyEntry()])}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 14px',
                  borderRadius: '8px',
                  border: '1px dashed rgba(14,165,233,0.4)',
                  backgroundColor: 'transparent',
                  color: '#0ea5e9',
                  cursor: 'pointer',
                  fontSize: '13px',
                }}
              >
                <Plus size={14} /> הוסף חיזוק
              </button>
            )}
            {avgEntry > 0 && reinforcements.some((r) => r.price > 0) && (
              <div style={{ marginTop: '12px', padding: '10px', backgroundColor: 'rgba(14,165,233,0.08)', borderRadius: '8px', border: '1px solid rgba(14,165,233,0.2)' }}>
                <span style={{ color: '#94a3b8', fontSize: '13px' }}>מחיר כניסה ממוצע מעודכן: </span>
                <span style={{ color: '#0ea5e9', fontWeight: 700 }}>{formatCurrency(avgEntry)}</span>
                <span style={{ color: '#94a3b8', fontSize: '13px', marginRight: '12px' }}>סה"כ מניות: </span>
                <span style={{ color: '#0ea5e9', fontWeight: 700 }}>{totalShares.toLocaleString()}</span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Section 4: Exits */}
      <div style={sectionStyle}>
        <h2 style={sectionTitle}>מימושים</h2>
        {exits.map((ex, idx) => (
          <div key={idx} style={{ marginBottom: '16px', paddingBottom: '16px', borderBottom: idx < exits.length - 1 ? '1px solid rgba(71,85,105,0.3)' : 'none' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <span style={{ color: '#94a3b8', fontSize: '13px', fontWeight: 500 }}>מימוש {idx + 1}</span>
              {exits.length > 1 && (
                <button
                  onClick={() => setExits((prev) => prev.filter((_, i) => i !== idx))}
                  style={{
                    padding: '4px',
                    borderRadius: '6px',
                    border: '1px solid rgba(239,68,68,0.3)',
                    backgroundColor: 'transparent',
                    color: '#ef4444',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <X size={13} />
                </button>
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', gap: '12px' }}>
              <div>
                <label style={labelStyle}>מחיר יציאה</label>
                <input
                  type="number"
                  value={ex.price || ''}
                  onChange={(e) => updateExit(idx, 'price', parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                  style={inputStyle}
                  step="0.01"
                />
              </div>
              <div>
                <label style={labelStyle}>כמות</label>
                <input
                  type="number"
                  value={ex.quantity || ''}
                  onChange={(e) => updateExit(idx, 'quantity', parseInt(e.target.value) || 0)}
                  placeholder="0"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>תאריך מימוש</label>
                <input
                  type="date"
                  value={ex.date || ''}
                  onChange={(e) => updateExit(idx, 'date', e.target.value)}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>רווח/הפסד</label>
                <div
                  style={{
                    ...inputStyle,
                    backgroundColor: '#162032',
                    color: ex.profitLoss >= 0 ? '#22c55e' : '#ef4444',
                    cursor: 'default',
                    fontWeight: 600,
                  }}
                >
                  {ex.price && ex.quantity ? formatCurrency(ex.profitLoss) : '—'}
                </div>
              </div>
              <div>
                <label style={labelStyle}>הערות מימוש</label>
                <input
                  type="text"
                  value={ex.notes}
                  onChange={(e) => updateExit(idx, 'notes', e.target.value)}
                  placeholder="הערה..."
                  style={inputStyle}
                />
              </div>
            </div>
          </div>
        ))}
        {exits.length < 4 && (
          <button
            onClick={() => setExits((prev) => [...prev, emptyExit()])}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '8px',
              border: '1px dashed rgba(34,197,94,0.4)',
              backgroundColor: 'transparent',
              color: '#22c55e',
              cursor: 'pointer',
              fontSize: '13px',
            }}
          >
            <Plus size={14} /> הוסף מימוש
          </button>
        )}
      </div>

      {/* Section 5: Summary */}
      {(initialEntry.price > 0 && initialEntry.quantity > 0) && (
        <div style={{ ...sectionStyle, backgroundColor: 'rgba(30,41,59,0.5)' }}>
          <h2 style={sectionTitle}>סיכום עסקה</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
            {[
              { label: 'מחיר כניסה ממוצע', value: formatCurrency(avgEntry), color: '#e2e8f0' },
              { label: 'סה"כ מניות', value: totalShares.toLocaleString(), color: '#e2e8f0' },
              { label: 'סה"כ השקעה', value: formatCurrency(totalInvested), color: '#e2e8f0' },
              {
                label: 'רווח/הפסד גולמי',
                value: formatCurrency(totalPL) + ' (' + (totalPLPercent >= 0 ? '+' : '') + totalPLPercent.toFixed(1) + '%)',
                color: totalPL >= 0 ? '#22c55e' : '#ef4444',
              },
              { label: 'עמלות', value: formatCurrency(commissions), color: '#f59e0b' },
              {
                label: 'רווח/הפסד נטו',
                value: formatCurrency(netPL) + ' (' + (netPLPercent >= 0 ? '+' : '') + netPLPercent.toFixed(1) + '%)',
                color: netPL >= 0 ? '#22c55e' : '#ef4444',
              },
              { label: 'סיכון ($)', value: formatCurrency(risk), color: '#f59e0b' },
              { label: 'R/R שהושג', value: isFinite(rr) ? rr.toFixed(2) : '—', color: rr >= 1 ? '#22c55e' : rr >= 0 ? '#f59e0b' : '#ef4444' },
            ].map((item, i) => (
              <div key={i} style={{ padding: '12px', backgroundColor: '#0f172a', borderRadius: '8px' }}>
                <div style={{ fontSize: '11px', color: '#475569', marginBottom: '4px' }}>{item.label}</div>
                <div style={{ fontSize: '15px', fontWeight: 700, color: item.color }}>{item.value}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Section 6: Entry Reason */}
      <div style={sectionStyle}>
        <h2 style={sectionTitle}>סיבת כניסה</h2>
        <textarea
          value={entryReason}
          onChange={(e) => setEntryReason(e.target.value)}
          placeholder="מה הסיבה לכניסה לעסקה? מה ראית בגרף?"
          rows={3}
          style={{ ...inputStyle, resize: 'vertical', lineHeight: '1.6' }}
        />
      </div>

      {/* Section 7: Exit Reason */}
      <div style={sectionStyle}>
        <h2 style={sectionTitle}>סיבת יציאה</h2>
        <textarea
          value={exitReason}
          onChange={(e) => setExitReason(e.target.value)}
          placeholder="מה הסיבה ליציאה מהעסקה?"
          rows={3}
          style={{ ...inputStyle, resize: 'vertical', lineHeight: '1.6' }}
        />
      </div>

      {/* Section 8: Behavioral Tags */}
      <div style={sectionStyle}>
        <h2 style={sectionTitle}>תגיות התנהגותיות</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {BEHAVIORAL_TAGS.map((tag) => {
            const active = behavioralTags.includes(tag.id);
            return (
              <button
                key={tag.id}
                onClick={() => toggleTag(tag.id)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '20px',
                  border: active ? `1px solid ${tag.color}40` : '1px solid rgba(71,85,105,0.5)',
                  backgroundColor: active ? `${tag.color}25` : 'transparent',
                  color: active ? tag.color : '#64748b',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: active ? 600 : 400,
                  transition: 'all 0.15s',
                }}
              >
                {tag.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Section 9: Notes */}
      <div style={sectionStyle}>
        <h2 style={sectionTitle}>הערות</h2>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="הוסף הערות לגבי העסקה..."
          rows={3}
          style={{ ...inputStyle, resize: 'vertical', lineHeight: '1.6' }}
        />
      </div>

      {/* Section 10: Conclusions */}
      <div style={sectionStyle}>
        <h2 style={sectionTitle}>מסקנות ולקחים</h2>
        <textarea
          value={conclusions}
          onChange={(e) => setConclusions(e.target.value)}
          placeholder="מה למדת מהעסקה הזו? מה תעשה אחרת בפעם הבאה?"
          rows={3}
          style={{ ...inputStyle, resize: 'vertical', lineHeight: '1.6' }}
        />
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', paddingBottom: '32px' }}>
        <button
          onClick={onCancel}
          style={{
            padding: '11px 24px',
            borderRadius: '8px',
            border: '1px solid rgba(71,85,105,0.5)',
            backgroundColor: 'transparent',
            color: '#94a3b8',
            cursor: 'pointer',
            fontSize: '14px',
          }}
        >
          ביטול
        </button>
        <button
          onClick={handleSave}
          style={{
            padding: '11px 28px',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: '#0284c7',
            color: 'white',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 700,
          }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = '#0ea5e9')}
          onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = '#0284c7')}
        >
          {existing ? 'שמור שינויים' : 'הוסף עסקה'}
        </button>
      </div>
    </div>
  );
}
