import React from 'react';
import { BarChart2, List, Plus, TrendingUp, BookOpen, LineChart, Settings } from 'lucide-react';

type Page = 'dashboard' | 'trades' | 'add-trade' | 'statistics' | 'longterm' | 'settings';

interface LayoutProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
  children: React.ReactNode;
}

const navItems = [
  { id: 'dashboard' as Page, label: 'דשבורד', icon: TrendingUp },
  { id: 'trades' as Page, label: 'יומן עסקאות', icon: List },
  { id: 'add-trade' as Page, label: 'עסקה חדשה', icon: Plus },
  { id: 'statistics' as Page, label: 'סטטיסטיקות', icon: BarChart2 },
  { id: 'longterm' as Page, label: 'השקעות ארוכות טווח', icon: LineChart },
  { id: 'settings' as Page, label: 'הגדרות', icon: Settings },
];

export default function Layout({ currentPage, onNavigate, children }: LayoutProps) {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', direction: 'rtl' }}>
      {/* Sidebar */}
      <aside
        style={{
          width: '220px',
          flexShrink: 0,
          backgroundColor: '#0f172a',
          borderLeft: '1px solid rgba(71,85,105,0.4)',
          display: 'flex',
          flexDirection: 'column',
          padding: '24px 0',
          position: 'sticky',
          top: 0,
          height: '100vh',
        }}
      >
        {/* Logo */}
        <div style={{ padding: '0 20px 24px', borderBottom: '1px solid rgba(71,85,105,0.3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #0ea5e9, #0369a1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <BookOpen size={18} color="white" />
            </div>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#f1f5f9' }}>יומן המסחר של יובל</div>
              <div style={{ fontSize: '11px', color: '#64748b' }}>Trading Journal</div>
            </div>
          </div>
        </div>

        {/* Nav Items */}
        <nav style={{ padding: '16px 12px', flex: 1 }}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: 'none',
                  cursor: 'pointer',
                  marginBottom: '4px',
                  backgroundColor: isActive ? 'rgba(14,165,233,0.15)' : 'transparent',
                  color: isActive ? '#0ea5e9' : '#94a3b8',
                  fontWeight: isActive ? 600 : 400,
                  fontSize: '14px',
                  transition: 'all 0.15s',
                  textAlign: 'right',
                  direction: 'rtl',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(71,85,105,0.3)';
                    (e.currentTarget as HTMLButtonElement).style.color = '#e2e8f0';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
                    (e.currentTarget as HTMLButtonElement).style.color = '#94a3b8';
                  }
                }}
              >
                {item.id === 'add-trade' ? (
                  <div
                    style={{
                      width: '22px',
                      height: '22px',
                      borderRadius: '6px',
                      background: isActive ? '#0ea5e9' : '#1e40af',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Icon size={13} color="white" />
                  </div>
                ) : (
                  <Icon size={18} style={{ flexShrink: 0 }} />
                )}
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Footer */}
        <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(71,85,105,0.3)' }}>
          <div style={{ fontSize: '11px', color: '#475569', textAlign: 'center' }}>
            © 2025 יומן המסחר של יובל
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main
        style={{
          flex: 1,
          backgroundColor: '#0f172a',
          minHeight: '100vh',
          overflowY: 'auto',
        }}
      >
        {children}
      </main>
    </div>
  );
}
