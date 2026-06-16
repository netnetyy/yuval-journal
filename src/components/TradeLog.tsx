import React, { useState } from 'react';
import type { AppData } from '../types/trade';
import { formatCurrency, formatPercent, formatDate, getPLPercentOfPortfolio, getNetProfitLoss, getRiskUnits, isClosedTrade, getOpenShares } from '../utils/calculations';
import { Trash2, Search, ChevronUp, ChevronDown, Eye, RefreshCw, CheckCircle, ClipboardList } from 'lucide-react';

interface TradeLogProps {
  data: AppData;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onAdd: () => void;
  onView: (id: string) => void;
}

type SortField = 'date' | 'stockName' | 'totalProfitLoss' | 'totalProfitLossPercent' | 'rr' | 'avgEntryPrice' | 'totalShares';
type SortDir = 'asc' | 'desc';

function formatSyncTime(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  const date = d.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: '2-digit' });
  const time = d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${date} · ${time}`;
}

export default function TradeLog({ data, onEdit, onDelete, onAdd, onView }: TradeLogProps) {
  const trades = data.trades;
  const [filter, setFilter] = useState<'all' | 'long' | 'short'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'closed'>('all');
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const filtered = trades
    .filter((t) => filter === 'all' || t.type === filter)
    .filter((t) => statusFilter === 'all' || (statusFilter === 'open' ? t.status === 'open' : isClosedTrade(t)))
    .filter((t) => !search || t.stockName.toLowerCase().includes(search.toLowerCase()))
    .filter((t) => !dateFrom || t.date >= dateFrom)
    .filter((t) => !dateTo || t.date <= dateTo)
    .sort((a, b) => {
      let av: number | string = a[sortField] as number | string;
      let bv: number | string = b[sortField] as number | string;
      if (typeof av === 'string') av = av.toLowerCase();
      if (typeof bv === 'string') bv = bv.toLowerCase();
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ChevronDown size={12} style={{ opacity: 0.3 }} />;
    return sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />;
  };

  const inputStyle: React.CSSProperties = {
    backgroundColor: '#0f172a',
    border: '1px solid rgba(71,85,105,0.5)',
    borderRadius: '8px',
    padding: '8px 12px',
    color: '#e2e8f0',
    fontSize: '13px',
    outline: 'none',
    direction: 'rtl',
  };

  const thStyle: React.CSSProperties = {
    padding: '10px 12px',
    color: '#64748b',
    fontWeight: 500,
    textAlign: 'right',
    fontSize: '12px',
    cursor: 'pointer',
    userSelect: 'none',
    whiteSpace: 'nowrap',
  };

  return (
    <div style={{ padding: '28px', direction: 'rtl' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#f1f5f9', margin: 0 }}>יומן עסקאות</h1>
          <p style={{ color: '#64748b', fontSize: '14px', marginTop: '4px' }}>
            {filtered.length} עסקאות מוצגות
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
          <button
            onClick={onAdd}
            style={{
              backgroundColor: '#0284c7',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              padding: '10px 20px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = '#0ea5e9')}
            onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = '#0284c7')}
          >
            + עסקה חדשה
          </button>
          <div
            title="סנכרון אוטומטי מ-Interactive Brokers"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              backgroundColor: '#1e293b',
              border: '1px solid rgba(71,85,105,0.5)',
              borderRadius: '6px',
              padding: '4px 10px',
              fontSize: '11px',
              color: data.ibkrLastSync ? '#64748b' : '#334155',
              whiteSpace: 'nowrap',
            }}
          >
            <RefreshCw size={10} style={{ color: data.ibkrLastSync ? '#38bdf8' : '#334155', flexShrink: 0 }} />
            <span style={{ color: '#475569', fontWeight: 500 }}>IBKR</span>
            <span>{data.ibkrLastSync ? formatSyncTime(data.ibkrLastSync) : 'טרם סונכרן'}</span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div
        style={{
          backgroundColor: '#1e293b',
          borderRadius: '12px',
          border: '1px solid rgba(71,85,105,0.4)',
          padding: '16px',
          marginBottom: '16px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '12px',
          alignItems: 'center',
        }}
      >
        {/* Type Filter */}
        <div style={{ display: 'flex', gap: '4px', backgroundColor: '#0f172a', borderRadius: '8px', padding: '3px' }}>
          {(['all', 'long', 'short'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: '5px 14px',
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 500,
                backgroundColor: filter === f ? '#0284c7' : 'transparent',
                color: filter === f ? 'white' : '#64748b',
                transition: 'all 0.15s',
              }}
            >
              {f === 'all' ? 'הכל' : f === 'long' ? 'לונג' : 'שורט'}
            </button>
          ))}
        </div>

        {/* Status Filter */}
        <div style={{ display: 'flex', gap: '4px', backgroundColor: '#0f172a', borderRadius: '8px', padding: '3px' }}>
          {(['all', 'closed', 'open'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              style={{
                padding: '5px 14px',
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 500,
                backgroundColor: statusFilter === f ? (f === 'open' ? '#d97706' : '#0284c7') : 'transparent',
                color: statusFilter === f ? 'white' : '#64748b',
                transition: 'all 0.15s',
              }}
            >
              {f === 'all' ? 'הכל' : f === 'closed' ? 'סגורות' : 'פתוחות'}
            </button>
          ))}
        </div>

        {/* Search */}
        <div style={{ position: 'relative', flex: 1, minWidth: '160px' }}>
          <Search size={14} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: '#475569' }} />
          <input
            type="text"
            placeholder="חיפוש מניה..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ ...inputStyle, width: '100%', paddingRight: '32px', boxSizing: 'border-box' }}
          />
        </div>

        {/* Date range */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ color: '#64748b', fontSize: '13px' }}>מ:</span>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={inputStyle} />
          <span style={{ color: '#64748b', fontSize: '13px' }}>עד:</span>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={inputStyle} />
        </div>

        {(search || dateFrom || dateTo || filter !== 'all' || statusFilter !== 'all') && (
          <button
            onClick={() => { setSearch(''); setDateFrom(''); setDateTo(''); setFilter('all'); setStatusFilter('all'); }}
            style={{ ...inputStyle, cursor: 'pointer', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}
          >
            נקה פילטרים
          </button>
        )}
      </div>

      {/* Table */}
      <div
        style={{
          backgroundColor: '#1e293b',
          borderRadius: '12px',
          border: '1px solid rgba(71,85,105,0.4)',
          overflow: 'hidden',
        }}
      >
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ backgroundColor: '#0f172a', borderBottom: '1px solid rgba(71,85,105,0.4)' }}>
                <th style={thStyle}>#</th>
                <th style={thStyle} onClick={() => handleSort('date')}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    תאריך <SortIcon field="date" />
                  </span>
                </th>
                <th style={thStyle} onClick={() => handleSort('stockName')}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    מניה <SortIcon field="stockName" />
                  </span>
                </th>
                <th style={thStyle}>סוג</th>
                <th style={thStyle} onClick={() => handleSort('avgEntryPrice')}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    כניסה ממוצעת <SortIcon field="avgEntryPrice" />
                  </span>
                </th>
                <th style={thStyle} onClick={() => handleSort('totalShares')}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    כמות <SortIcon field="totalShares" />
                  </span>
                </th>
                <th style={thStyle} onClick={() => handleSort('totalProfitLoss')}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    רווח/הפסד נטו <SortIcon field="totalProfitLoss" />
                  </span>
                </th>
                <th style={thStyle} onClick={() => handleSort('totalProfitLossPercent')}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    % מהעסקה <SortIcon field="totalProfitLossPercent" />
                  </span>
                </th>
                <th style={{ ...thStyle, color: '#a78bfa' }}>% מהתיק</th>
                <th style={thStyle} onClick={() => handleSort('rr')}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    R/R <SortIcon field="rr" />
                  </span>
                </th>
                {data.riskUnitValue > 0 && <th style={{ ...thStyle, color: '#f59e0b' }}>יחידות R</th>}
                <th style={thStyle}>הערות</th>
                <th style={thStyle}>פעולות</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((trade, idx) => {
                const isOpen = trade.status === 'open';
                const netPL = getNetProfitLoss(trade);
                const isProfit = netPL >= 0;
                const isDeleting = confirmDelete === trade.id;
                return (
                  <tr
                    key={trade.id}
                    style={{
                      borderBottom: '1px solid rgba(71,85,105,0.2)',
                      backgroundColor: trade.status === 'open' ? 'rgba(217,119,6,0.06)' : isProfit ? 'rgba(34,197,94,0.04)' : 'rgba(239,68,68,0.04)',
                      cursor: 'pointer',
                    }}
                    onClick={() => onView(trade.id)}
                  >
                    <td style={{ padding: '10px 12px', color: '#475569' }}>{idx + 1}</td>
                    <td style={{ padding: '10px 12px', color: '#94a3b8', whiteSpace: 'nowrap' }}>
                      {formatDate(trade.date)}
                    </td>
                    <td style={{ padding: '10px 12px', color: '#f1f5f9', fontWeight: 700, fontSize: '14px' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {trade.stockName}
                        {trade.status === 'open' && (
                          <span style={{ fontSize: '10px', fontWeight: 600, color: '#d97706', backgroundColor: 'rgba(217,119,6,0.15)', padding: '1px 6px', borderRadius: '4px', border: '1px solid rgba(217,119,6,0.3)' }}>פתוחה</span>
                        )}
                        {trade.ibkrImported && (
                          <span style={{ fontSize: '10px', color: '#64748b' }}>IBKR</span>
                        )}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <span
                        style={{
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: 700,
                          backgroundColor: trade.type === 'long' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                          color: trade.type === 'long' ? '#22c55e' : '#ef4444',
                        }}
                      >
                        {trade.type === 'long' ? 'לונג' : 'שורט'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', color: '#e2e8f0' }}>
                      {formatCurrency(trade.avgEntryPrice)}
                    </td>
                    <td style={{ padding: '10px 12px', color: '#e2e8f0' }}>
                      {(isOpen ? getOpenShares(trade) : trade.totalShares).toLocaleString()}
                    </td>
                    <td
                      style={{ padding: '10px 12px', color: isOpen ? '#64748b' : isProfit ? '#22c55e' : '#ef4444', fontWeight: 700 }}
                      title={isOpen ? 'פוזיציה פתוחה — אין P&L ממומש' : `גולמי: ${formatCurrency(trade.totalProfitLoss)} | עמלות: ${formatCurrency(trade.commissions ?? 0)}`}
                    >
                      {isOpen ? '—' : formatCurrency(netPL)}
                    </td>
                    <td style={{ padding: '10px 12px', color: isOpen ? '#64748b' : isProfit ? '#22c55e' : '#ef4444' }}>
                      {isOpen ? '—' : formatPercent(trade.totalProfitLossPercent)}
                    </td>
                    <td
                      style={{
                        padding: '10px 12px',
                        color: isOpen ? '#64748b' : isProfit ? '#86efac' : '#fca5a5',
                        fontWeight: 600,
                      }}
                      title={isOpen ? 'פוזיציה פתוחה' : 'אחוז מגודל התיק הכולל בזמן העסקה'}
                    >
                      {isOpen ? '—' : formatPercent(getPLPercentOfPortfolio(data, trade))}
                    </td>
                    <td style={{ padding: '10px 12px', color: isOpen ? '#64748b' : trade.rr >= 1 ? '#22c55e' : trade.rr >= 0 ? '#f59e0b' : '#ef4444' }}>
                      {isOpen ? '—' : trade.rr.toFixed(2)}
                    </td>
                    {data.riskUnitValue > 0 && (() => {
                      const ru = getRiskUnits(trade, data.riskUnitValue);
                      return (
                        <td style={{ padding: '10px 12px', color: isOpen ? '#64748b' : ru >= 0 ? '#22c55e' : '#ef4444', fontWeight: 600 }}>
                          {isOpen ? '—' : (ru >= 0 ? '+' : '') + ru.toFixed(2) + 'R'}
                        </td>
                      );
                    })()}
                    <td
                      style={{ padding: '10px 12px', color: '#64748b', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                      title={trade.notes}
                    >
                      {trade.notes || '—'}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      {isDeleting ? (
                        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }} onClick={(e) => e.stopPropagation()}>
                          <span style={{ fontSize: '12px', color: '#ef4444' }}>למחוק?</span>
                          <button
                            onClick={(e) => { e.stopPropagation(); onDelete(trade.id); setConfirmDelete(null); }}
                            style={{ padding: '3px 8px', borderRadius: '4px', border: 'none', backgroundColor: '#ef4444', color: 'white', fontSize: '11px', cursor: 'pointer' }}
                          >
                            כן
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setConfirmDelete(null); }}
                            style={{ padding: '3px 8px', borderRadius: '4px', border: '1px solid rgba(71,85,105,0.5)', backgroundColor: 'transparent', color: '#94a3b8', fontSize: '11px', cursor: 'pointer' }}
                          >
                            לא
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }} onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={(e) => { e.stopPropagation(); onView(trade.id); }}
                            style={{ padding: '5px', borderRadius: '6px', border: '1px solid rgba(14,165,233,0.3)', backgroundColor: 'transparent', color: '#0ea5e9', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                            title="צפה בפרטים"
                          >
                            <Eye size={13} />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setConfirmDelete(trade.id); }}
                            style={{ padding: '5px', borderRadius: '6px', border: '1px solid rgba(239,68,68,0.3)', backgroundColor: 'transparent', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                            title="מחק"
                          >
                            <Trash2 size={13} />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); onEdit(trade.id); }}
                            style={{ padding: '5px', borderRadius: '6px', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                            title={trade.conclusions?.trim() ? 'תחקורת — לחץ לעריכה' : 'לא תחקורת — לחץ לעריכה'}
                          >
                            {trade.conclusions?.trim()
                              ? <CheckCircle size={13} color="#3b82f6" />
                              : <ClipboardList size={13} color="#9ca3af" />
                            }
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={13} style={{ textAlign: 'center', padding: '48px', color: '#475569' }}>
                    אין עסקאות להצגה
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
