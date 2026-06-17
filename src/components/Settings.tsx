import React, { useState, useRef } from 'react';
import { Settings as SettingsIcon, Zap, CheckCircle, Circle, ExternalLink, ChevronDown, ChevronUp, Database, Upload } from 'lucide-react';
import type { ColmexImportResult } from '../utils/colmexImport';

const card: React.CSSProperties = {
  backgroundColor: '#1e293b',
  borderRadius: '12px',
  border: '1px solid rgba(71,85,105,0.4)',
  padding: '24px',
  marginBottom: '20px',
};

const sectionTitle: React.CSSProperties = {
  fontSize: '18px',
  fontWeight: 700,
  color: '#f1f5f9',
  marginBottom: '6px',
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
};

const badge = (color: string): React.CSSProperties => ({
  display: 'inline-block',
  padding: '2px 10px',
  borderRadius: '20px',
  fontSize: '11px',
  fontWeight: 600,
  backgroundColor: color === 'blue' ? 'rgba(14,165,233,0.15)' : 'rgba(148,163,184,0.1)',
  color: color === 'blue' ? '#38bdf8' : '#94a3b8',
  border: `1px solid ${color === 'blue' ? 'rgba(14,165,233,0.3)' : 'rgba(148,163,184,0.2)'}`,
  marginRight: '8px',
});

const stepRow: React.CSSProperties = {
  display: 'flex',
  gap: '14px',
  marginBottom: '16px',
  alignItems: 'flex-start',
};

const stepNum = (color: string): React.CSSProperties => ({
  width: '28px',
  height: '28px',
  borderRadius: '50%',
  backgroundColor: color,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  fontSize: '13px',
  fontWeight: 700,
  color: 'white',
  marginTop: '1px',
});

const pathArrow: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  backgroundColor: 'rgba(14,165,233,0.08)',
  border: '1px solid rgba(14,165,233,0.2)',
  borderRadius: '6px',
  padding: '4px 10px',
  fontSize: '13px',
  color: '#7dd3fc',
  fontFamily: 'monospace',
  margin: '2px 4px',
};

function NavPath({ steps }: { steps: string[] }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px', margin: '8px 0' }}>
      {steps.map((s, i) => (
        <React.Fragment key={i}>
          <span style={pathArrow}>{s}</span>
          {i < steps.length - 1 && <span style={{ color: '#475569', fontSize: '14px' }}>›</span>}
        </React.Fragment>
      ))}
    </div>
  );
}

function StatusDot({ active }: { active: boolean }) {
  return active
    ? <CheckCircle size={16} color="#22c55e" style={{ flexShrink: 0 }} />
    : <Circle size={16} color="#475569" style={{ flexShrink: 0 }} />;
}

interface SettingsProps {
  onImportColmex?: (csvText: string) => ColmexImportResult;
}

export default function Settings({ onImportColmex }: SettingsProps) {
  const [finnhubOpen, setFinnhubOpen] = useState(true);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ColmexImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const finnhubKey = typeof window !== 'undefined' ? localStorage.getItem('finnhub_api_key') : null;

  async function handleColmexFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file
    if (!file || !onImportColmex) return;
    setImporting(true);
    setImportError(null);
    setImportResult(null);
    try {
      const text = await file.text();
      const result = onImportColmex(text);
      setImportResult(result);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'שגיאה בקריאת הקובץ.');
    } finally {
      setImporting(false);
    }
  }

  function toggleSection(setter: React.Dispatch<React.SetStateAction<boolean>>) {
    setter(v => !v);
  }

  const sectionHeader = (
    title: string,
    icon: React.ReactNode,
    isOpen: boolean,
    setter: React.Dispatch<React.SetStateAction<boolean>>,
    badgeText?: string
  ) => (
    <button
      onClick={() => toggleSection(setter)}
      style={{
        width: '100%',
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: isOpen ? '20px' : 0,
      }}
    >
      <div style={sectionTitle}>
        {icon}
        {title}
        {badgeText && <span style={badge('gray')}>{badgeText}</span>}
      </div>
      {isOpen ? <ChevronUp size={18} color="#475569" /> : <ChevronDown size={18} color="#475569" />}
    </button>
  );

  return (
    <div style={{ padding: '32px', direction: 'rtl', maxWidth: '860px', margin: '0 auto' }}>
      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '28px' }}>
        <div style={{
          width: '44px', height: '44px', borderRadius: '12px',
          background: 'linear-gradient(135deg, #0ea5e9, #0369a1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <SettingsIcon size={22} color="white" />
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 700, color: '#f1f5f9' }}>הגדרות וייבוא</h1>
          <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
            ייבוא עסקאות מקולמקס פרו, ועדכון מחירים עם Finnhub
          </p>
        </div>
      </div>

      {/* Colmex Pro import */}
      <div style={{ ...card, border: '1px solid rgba(14,165,233,0.35)', background: 'linear-gradient(180deg, rgba(14,165,233,0.06), #1e293b)' }}>
        <div style={sectionTitle}>
          <Upload size={20} color="#38bdf8" />
          ייבוא עסקאות מקולמקס פרו
        </div>
        <p style={{ fontSize: '13px', color: '#94a3b8', margin: '4px 0 16px', lineHeight: 1.7 }}>
          ייצא מקולמקס פרו את <strong style={{ color: '#cbd5e1' }}>היסטוריית המסחר</strong> כקובץ <strong style={{ color: '#cbd5e1' }}>CSV</strong>,
          והעלה אותו כאן. המערכת מקבצת את הביצועים לעסקאות וממזגת אותן ליומן.
          אפשר להעלות ייצוא מלא שוב ושוב — עסקאות קיימות לא ישוכפלו, ועסקאות שנסגרו יתעדכנו.
        </p>

        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          onChange={handleColmexFile}
          style={{ display: 'none' }}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={importing}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '10px',
            background: importing ? '#334155' : 'linear-gradient(135deg, #0ea5e9, #0369a1)',
            color: 'white', border: 'none', borderRadius: '8px',
            padding: '11px 20px', fontSize: '14px', fontWeight: 600,
            cursor: importing ? 'default' : 'pointer',
          }}
        >
          <Upload size={16} />
          {importing ? 'מייבא…' : 'בחר קובץ CSV מקולמקס'}
        </button>

        {importResult && (
          <div style={{
            marginTop: '16px', padding: '14px 16px', borderRadius: '8px',
            backgroundColor: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)',
            fontSize: '13px', color: '#86efac', lineHeight: 1.8,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, color: '#22c55e' }}>
              <CheckCircle size={16} /> הייבוא הושלם
            </div>
            <div style={{ color: '#cbd5e1', marginTop: '6px' }}>
              נקראו {importResult.parsedExecutions} ביצועים → {importResult.positions} עסקאות.{' '}
              <strong style={{ color: '#86efac' }}>{importResult.newCount} חדשות</strong>,{' '}
              <strong style={{ color: '#7dd3fc' }}>{importResult.updatedCount} עודכנו</strong>.
              {importResult.newCount === 0 && importResult.updatedCount === 0 && ' היומן כבר היה מעודכן.'}
            </div>
          </div>
        )}
        {importError && (
          <div style={{
            marginTop: '16px', padding: '14px 16px', borderRadius: '8px',
            backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
            fontSize: '13px', color: '#fca5a5', lineHeight: 1.7,
          }}>
            {importError}
          </div>
        )}
      </div>

      {/* Status Overview */}
      <div style={{ ...card, display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '28px' }}>
        <StatusDot active={!!finnhubKey} />
        <div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#cbd5e1' }}>Finnhub API</div>
          <div style={{ fontSize: '11px', color: finnhubKey ? '#22c55e' : '#475569' }}>
            {finnhubKey ? 'מפתח מוגדר' : 'לא מוגדר עדיין'}
          </div>
        </div>
      </div>

      {/* ─── Finnhub Section ─── */}
      <div style={card}>
        {sectionHeader(
          'Finnhub — מחירים בזמן אמת',
          <Zap size={20} color="#fbbf24" />,
          finnhubOpen,
          setFinnhubOpen,
          'אופציונלי'
        )}

        {finnhubOpen && (
          <>
            <p style={{ margin: '0 0 16px', fontSize: '13px', color: '#94a3b8', lineHeight: 1.6 }}>
              Finnhub מספק מחירי מניות בזמן אמת ישירות בדשבורד (פוזיציות פתוחות + השקעות ארוכות טווח).
              ההרשמה חינמית.
            </p>

            <div style={stepRow}>
              <div style={stepNum('#92400e')}>1</div>
              <div style={{ fontSize: '13px', color: '#94a3b8', lineHeight: 1.6 }}>
                היכנס לאתר{' '}
                <a
                  href="https://finnhub.io"
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: '#fbbf24', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                >
                  finnhub.io <ExternalLink size={12} />
                </a>
                {' '}והירשם חינם.
              </div>
            </div>
            <div style={stepRow}>
              <div style={stepNum('#92400e')}>2</div>
              <div style={{ fontSize: '13px', color: '#94a3b8', lineHeight: 1.6 }}>
                לאחר הרשמה, עבור אל Dashboard:
                <NavPath steps={['Dashboard', 'API Keys']} />
                העתק את ה-API Key (מחרוזת אלפאנומרית).
              </div>
            </div>
            <div style={{ ...stepRow, marginBottom: 0 }}>
              <div style={stepNum('#92400e')}>3</div>
              <div style={{ fontSize: '13px', color: '#94a3b8', lineHeight: 1.6 }}>
                חזור ליומן המסחר → <strong style={{ color: '#e2e8f0' }}>דשבורד</strong> → גלול למטה לתיבת
                {' '}<strong style={{ color: '#e2e8f0' }}>"Finnhub API Key"</strong> → הכנס את המפתח ולחץ שמור.
                <br />המחירים יתעדכנו מיד בטבלת הפוזיציות הפתוחות.
              </div>
            </div>
          </>
        )}
      </div>

      {/* ─── Supabase Note ─── */}
      <div style={{
        ...card,
        backgroundColor: 'rgba(30,41,59,0.5)',
        border: '1px solid rgba(71,85,105,0.2)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
          <Database size={18} color="#475569" />
          <span style={{ fontSize: '14px', fontWeight: 600, color: '#64748b' }}>Supabase (מנוהל ע"י המנהל)</span>
        </div>
        <p style={{ margin: 0, fontSize: '12px', color: '#475569', lineHeight: 1.6 }}>
          ה-database של היומן מנוהל ע"י מי שהגדיר לך את היומן. אין צורך בפעולה מצדך.
          אם תרצה גיבוי של הנתונים שלך — פנה אליו.
        </p>
      </div>
    </div>
  );
}
