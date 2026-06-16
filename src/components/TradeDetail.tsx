import type { Trade } from '../types/trade';
import { formatCurrency, formatPercent, formatDate, getNetProfitLoss, getRiskUnits } from '../utils/calculations';
import { ArrowRight, Edit2, TrendingUp, TrendingDown } from 'lucide-react';

interface TradeDetailProps {
  trade: Trade;
  riskUnitValue: number;
  onBack: () => void;
  onEdit: (id: string) => void;
}

const BEHAVIORAL_LABELS: Record<string, { label: string; color: string }> = {
  'good-trade': { label: 'עסקה טובה', color: '#22c55e' },
  'self-analysis': { label: 'ניתוח עצמי', color: '#3b82f6' },
  'by-raz': { label: 'לפי רז', color: '#a78bfa' },
  'by-niv': { label: 'לפי ניב', color: '#fbbf24' },
  FOMO: { label: 'FOMO', color: '#f43f5e' },
  'movement-entry': { label: 'כניסה בתנועה', color: '#f43f5e' },
  'low-confidence': { label: 'כניסה עם ביטחון נמוך', color: '#f43f5e' },
  'early-entry': { label: 'כניסה מוקדמת', color: '#f43f5e' },
  'adding-before-confirmation': { label: 'הוספה לפני אישור', color: '#f43f5e' },
  'unexecuted-limit': { label: 'לימיט שלא בוצע', color: '#f43f5e' },
  'early-exit': { label: 'יציאה מוקדמת', color: '#f43f5e' },
  'late-exit': { label: 'יציאה מאוחרת', color: '#f43f5e' },
  'risk-unit-deviation': { label: 'חריגה מיחידת סיכון', color: '#f43f5e' },
  'missed-key-points': { label: 'פספוס נקודות מפתח', color: '#f43f5e' },
  'profit-to-loss': { label: 'המרת רווח להפסד', color: '#f43f5e' },
  'trade-infatuation': { label: 'התאהבות בעסקה', color: '#f43f5e' },
  'work-after-exit': { label: 'עבודה אחרי יציאה', color: '#f43f5e' },
  'stock-based-management': { label: 'ניהול על בסיס המניה', color: '#f43f5e' },
  'wrong-goal-planning': { label: 'תכנון מטרה שגוי', color: '#f43f5e' },
  'tight-stop-loss': { label: 'סטופ לוס צמוד', color: '#f43f5e' },
  'wrong-share-quantity': { label: 'כמות מניות שגויה', color: '#f43f5e' },
  'poor-management': { label: 'ניהול לקוי', color: '#f43f5e' },
  'no-plan': { label: 'אין תוכנית', color: '#f43f5e' },
  mistake: { label: 'עסקה בטעות', color: '#f43f5e' },
  'no-follow': { label: 'לא עקבתי', color: '#f43f5e' },
};

const card = (extra?: React.CSSProperties): React.CSSProperties => ({
  backgroundColor: '#1e293b',
  borderRadius: '12px',
  border: '1px solid rgba(71,85,105,0.4)',
  padding: '20px',
  ...extra,
});

const labelStyle: React.CSSProperties = { fontSize: '11px', color: '#475569', marginBottom: '4px' };
const valueStyle: React.CSSProperties = { fontSize: '15px', fontWeight: 600, color: '#e2e8f0' };

export default function TradeDetail({ trade, riskUnitValue, onBack, onEdit }: TradeDetailProps) {
  const netPL = getNetProfitLoss(trade);
  const riskUnits = getRiskUnits(trade, riskUnitValue);
  const isProfit = netPL >= 0;
  const plColor = isProfit ? '#22c55e' : '#ef4444';
  const commissions = trade.commissions ?? 0;

  return (
    <div style={{ padding: '28px', direction: 'rtl', maxWidth: '860px' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <button
            onClick={onBack}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: '14px', padding: 0 }}
          >
            <ArrowRight size={16} /> חזרה
          </button>
          <div style={{ width: '1px', height: '24px', backgroundColor: 'rgba(71,85,105,0.4)' }} />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h1 style={{ fontSize: '26px', fontWeight: 800, color: '#f1f5f9', margin: 0 }}>{trade.stockName}</h1>
              <span style={{
                padding: '3px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 700,
                backgroundColor: trade.type === 'long' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                color: trade.type === 'long' ? '#22c55e' : '#ef4444',
              }}>
                {trade.type === 'long' ? 'לונג' : 'שורט'}
              </span>
              <span style={{ fontSize: '13px', color: '#475569' }}>#{trade.serialNumber}</span>
            </div>
            <div style={{ color: '#64748b', fontSize: '13px', marginTop: '4px' }}>{formatDate(trade.date)}</div>
          </div>
        </div>
        <button
          onClick={() => onEdit(trade.id)}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#0284c7', color: 'white', border: 'none', borderRadius: '8px', padding: '9px 16px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}
        >
          <Edit2 size={14} /> ערוך עסקה
        </button>
      </div>

      {/* P&L Banner */}
      <div style={{
        ...card({ marginBottom: '20px', padding: '18px 24px' }),
        backgroundColor: isProfit ? 'rgba(34,197,94,0.07)' : 'rgba(239,68,68,0.07)',
        border: `1px solid ${isProfit ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: isProfit ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {isProfit ? <TrendingUp size={20} color="#22c55e" /> : <TrendingDown size={20} color="#ef4444" />}
          </div>
          <div>
            <div style={{ fontSize: '11px', color: '#64748b' }}>רווח/הפסד נטו</div>
            <div style={{ fontSize: '26px', fontWeight: 800, color: plColor }}>{formatCurrency(netPL)}</div>
            {commissions > 0 && (
              <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                גולמי: {formatCurrency(trade.totalProfitLoss)} | עמלות: {formatCurrency(commissions)}
              </div>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
          {[
            { label: '% מהעסקה', val: formatPercent(trade.totalProfitLossPercent), color: plColor },
            { label: 'R/R', val: trade.rr.toFixed(2), color: trade.rr >= 1 ? '#22c55e' : trade.rr >= 0 ? '#f59e0b' : '#ef4444' },
            ...(riskUnitValue > 0 ? [{ label: 'יחידות סיכון', val: (riskUnits >= 0 ? '+' : '') + riskUnits.toFixed(2) + 'R', color: riskUnits >= 0 ? '#22c55e' : '#ef4444' }] : []),
            { label: 'כניסה ממוצעת', val: formatCurrency(trade.avgEntryPrice), color: '#e2e8f0' },
            { label: 'סה"כ מניות', val: trade.totalShares.toLocaleString(), color: '#e2e8f0' },
            { label: 'סה"כ השקעה', val: formatCurrency(trade.totalInvested), color: '#e2e8f0' },
          ].map((item) => (
            <div key={item.label}>
              <div style={{ fontSize: '11px', color: '#475569', marginBottom: '2px' }}>{item.label}</div>
              <div style={{ fontSize: '15px', fontWeight: 700, color: item.color }}>{item.val}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>

        {/* Initial Entry */}
        <div style={card()}>
          <h2 style={{ fontSize: '14px', fontWeight: 600, color: '#94a3b8', marginTop: 0, marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>כניסה ראשונית</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px' }}>
            <div><div style={labelStyle}>מחיר</div><div style={valueStyle}>{formatCurrency(trade.initialEntry.price)}</div></div>
            <div><div style={labelStyle}>כמות</div><div style={valueStyle}>{trade.initialEntry.quantity.toLocaleString()}</div></div>
            <div><div style={labelStyle}>סה"כ</div><div style={valueStyle}>{formatCurrency(trade.initialEntry.totalAmount)}</div></div>
            {trade.initialEntry.sl ? <div><div style={labelStyle}>Stop Loss</div><div style={{ ...valueStyle, color: '#ef4444' }}>{formatCurrency(trade.initialEntry.sl)}</div></div> : null}
            {trade.initialEntry.tp ? <div><div style={labelStyle}>Take Profit</div><div style={{ ...valueStyle, color: '#22c55e' }}>{formatCurrency(trade.initialEntry.tp)}</div></div> : null}
            {trade.initialEntry.risk ? <div><div style={labelStyle}>סיכון</div><div style={{ ...valueStyle, color: '#f59e0b' }}>{formatCurrency(trade.initialEntry.risk)}</div></div> : null}
          </div>
        </div>

        {/* Reinforcements */}
        <div style={card()}>
          <h2 style={{ fontSize: '14px', fontWeight: 600, color: '#94a3b8', marginTop: 0, marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            חיזוקי פוזיציה ({trade.reinforcements.length})
          </h2>
          {trade.reinforcements.length === 0 ? (
            <div style={{ color: '#475569', fontSize: '13px', paddingTop: '8px' }}>אין חיזוקים לעסקה זו</div>
          ) : (
            trade.reinforcements.map((r, i) => (
              <div key={i} style={{ display: 'flex', gap: '24px', padding: '10px 0', borderBottom: i < trade.reinforcements.length - 1 ? '1px solid rgba(71,85,105,0.2)' : 'none' }}>
                <div style={{ minWidth: '20px', color: '#475569', fontSize: '12px', paddingTop: '2px' }}>#{i + 1}</div>
                <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                  <div><div style={labelStyle}>מחיר</div><div style={valueStyle}>{formatCurrency(r.price)}</div></div>
                  <div><div style={labelStyle}>כמות</div><div style={valueStyle}>{r.quantity.toLocaleString()}</div></div>
                  <div><div style={labelStyle}>סה"כ</div><div style={valueStyle}>{formatCurrency(r.totalAmount)}</div></div>
                  {r.date && <div><div style={labelStyle}>תאריך</div><div style={valueStyle}>{formatDate(r.date)}</div></div>}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Exits */}
      <div style={{ ...card(), marginBottom: '16px' }}>
        <h2 style={{ fontSize: '14px', fontWeight: 600, color: '#94a3b8', marginTop: 0, marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          מימושים ({trade.exits.length})
        </h2>
        {trade.exits.length === 0 ? (
          <div style={{ color: '#475569', fontSize: '13px' }}>אין מימושים רשומים</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
            {trade.exits.map((ex, i) => {
              const exProfit = ex.profitLoss >= 0;
              return (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: '0',
                  padding: '14px 0',
                  borderBottom: i < trade.exits.length - 1 ? '1px solid rgba(71,85,105,0.2)' : 'none',
                }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: exProfit ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, color: exProfit ? '#22c55e' : '#ef4444', flexShrink: 0, marginLeft: '16px' }}>
                    {i + 1}
                  </div>
                  <div style={{ display: 'flex', gap: '28px', flexWrap: 'wrap', flex: 1 }}>
                    <div><div style={labelStyle}>מחיר יציאה</div><div style={valueStyle}>{formatCurrency(ex.price)}</div></div>
                    <div><div style={labelStyle}>כמות</div><div style={valueStyle}>{ex.quantity.toLocaleString()}</div></div>
                    <div><div style={labelStyle}>סה"כ</div><div style={valueStyle}>{formatCurrency(ex.totalAmount)}</div></div>
                    <div><div style={labelStyle}>רווח/הפסד</div><div style={{ ...valueStyle, color: exProfit ? '#22c55e' : '#ef4444', fontSize: '16px' }}>{formatCurrency(ex.profitLoss)}</div></div>
                    <div><div style={labelStyle}>%</div><div style={{ ...valueStyle, color: exProfit ? '#22c55e' : '#ef4444' }}>{formatPercent(ex.profitLossPercent)}</div></div>
                    {ex.date && <div><div style={labelStyle}>תאריך</div><div style={valueStyle}>{formatDate(ex.date)}</div></div>}
                    {ex.notes && <div style={{ flex: 1, minWidth: '140px' }}><div style={labelStyle}>הערות</div><div style={{ ...valueStyle, color: '#94a3b8', fontWeight: 400, fontSize: '13px' }}>{ex.notes}</div></div>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Entry Reason / Exit Reason */}
      {(trade.entryReason || trade.exitReason) && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
          {trade.entryReason && (
            <div style={card()}>
              <h2 style={{ fontSize: '14px', fontWeight: 600, color: '#94a3b8', marginTop: 0, marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>סיבת כניסה</h2>
              <p style={{ margin: 0, color: '#cbd5e1', fontSize: '14px', lineHeight: '1.7' }}>{trade.entryReason}</p>
            </div>
          )}
          {trade.exitReason && (
            <div style={card()}>
              <h2 style={{ fontSize: '14px', fontWeight: 600, color: '#94a3b8', marginTop: 0, marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>סיבת יציאה</h2>
              <p style={{ margin: 0, color: '#cbd5e1', fontSize: '14px', lineHeight: '1.7' }}>{trade.exitReason}</p>
            </div>
          )}
        </div>
      )}

      {/* Conclusions */}
      {trade.conclusions && (
        <div style={{ ...card(), marginBottom: '16px', backgroundColor: 'rgba(14,165,233,0.05)', border: '1px solid rgba(14,165,233,0.2)' }}>
          <h2 style={{ fontSize: '14px', fontWeight: 600, color: '#0ea5e9', marginTop: 0, marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>מסקנות ולקחים</h2>
          <p style={{ margin: 0, color: '#cbd5e1', fontSize: '14px', lineHeight: '1.7' }}>{trade.conclusions}</p>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>

        {/* Behavioral Tags */}
        {trade.behavioralTags.length > 0 && (
          <div style={card()}>
            <h2 style={{ fontSize: '14px', fontWeight: 600, color: '#94a3b8', marginTop: 0, marginBottom: '14px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>תגיות התנהגותיות</h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {trade.behavioralTags.map((tag) => {
                const info = BEHAVIORAL_LABELS[tag] ?? { label: tag, color: '#0ea5e9' };
                return (
                  <span key={tag} style={{
                    padding: '5px 13px',
                    borderRadius: '20px',
                    fontSize: '13px',
                    fontWeight: 600,
                    backgroundColor: `${info.color}20`,
                    color: info.color,
                    border: `1px solid ${info.color}40`,
                  }}>
                    {info.label}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* Notes */}
        {trade.notes && (
          <div style={card()}>
            <h2 style={{ fontSize: '14px', fontWeight: 600, color: '#94a3b8', marginTop: 0, marginBottom: '14px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>הערות</h2>
            <p style={{ margin: 0, color: '#cbd5e1', fontSize: '14px', lineHeight: '1.7' }}>{trade.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
}
