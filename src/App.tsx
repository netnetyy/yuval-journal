import { useState, useCallback, useEffect } from 'react';
import './index.css';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import TradeLog from './components/TradeLog';
import TradeForm from './components/TradeForm';
import Statistics from './components/Statistics';
import TradeDetail from './components/TradeDetail';
import LongTermInvestments from './components/LongTermInvestments';
import Settings from './components/Settings';
import type { AppData, Trade, PortfolioDeposit } from './types/trade';
import { loadData, saveData, generateId } from './utils/storage';

type Page = 'dashboard' | 'trades' | 'add-trade' | 'statistics' | 'edit-trade' | 'trade-detail' | 'longterm' | 'settings';

function App() {
  const [data, setData] = useState<AppData | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState<Page>('dashboard');
  const [editTradeId, setEditTradeId] = useState<string | null>(null);

  useEffect(() => {
    loadData().then((d) => {
      setData(d);
      setLoading(false);
    });
  }, []);

  const navigate = useCallback((p: Page, tradeId?: string) => {
    setPage(p);
    if (tradeId) setEditTradeId(tradeId);
    else if (p !== 'edit-trade') setEditTradeId(null);
  }, []);

  const persist = useCallback((updater: (prev: AppData) => AppData) => {
    setData((prev) => {
      if (!prev) return prev;
      const updated = updater(prev);
      saveData(updated); // fire-and-forget, UI updates instantly
      return updated;
    });
  }, []);

  const handleSaveTrade = (trade: Trade) => {
    persist((prev) => {
      const exists = prev.trades.find((t) => t.id === trade.id);
      return exists
        ? { ...prev, trades: prev.trades.map((t) => (t.id === trade.id ? trade : t)) }
        : { ...prev, trades: [...prev.trades, trade] };
    });
    setPage('trades');
    setEditTradeId(null);
  };

  const handleDeleteTrade = (id: string) => {
    persist((prev) => ({ ...prev, trades: prev.trades.filter((t) => t.id !== id) }));
  };

  const handleSetPortfolioBase = (value: number) => {
    persist((prev) => ({ ...prev, portfolioBaseValue: value }));
  };

  const handleAddDeposit = (amount: number, date: string, note: string) => {
    const deposit: PortfolioDeposit = { id: generateId(), amount, date, note };
    persist((prev) => ({
      ...prev,
      deposits: [...prev.deposits, deposit],
      portfolioBaseValue: prev.portfolioBaseValue + amount,
    }));
  };

  const handleSetRiskUnit = (value: number) => {
    persist((prev) => ({ ...prev, riskUnitValue: value }));
  };

  const handleSetDefaultCommission = (value: number) => {
    persist((prev) => ({ ...prev, defaultCommissionPerAction: value }));
  };

  const handleDeleteDeposit = (id: string) => {
    persist((prev) => {
      const dep = prev.deposits.find((d) => d.id === id);
      if (!dep) return prev;
      return {
        ...prev,
        deposits: prev.deposits.filter((d) => d.id !== id),
        portfolioBaseValue: prev.portfolioBaseValue - dep.amount,
      };
    });
  };

  if (loading || !data) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', backgroundColor: '#0f172a', flexDirection: 'column', gap: '16px' }}>
        <div style={{ width: '40px', height: '40px', border: '3px solid rgba(14,165,233,0.2)', borderTopColor: '#0ea5e9', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <span style={{ color: '#475569', fontSize: '14px' }}>טוען את היומן...</span>
      </div>
    );
  }

  const editTrade = editTradeId ? data.trades.find((t) => t.id === editTradeId) : undefined;
  const nextSerial = data.trades.length > 0 ? Math.max(...data.trades.map((t) => t.serialNumber)) + 1 : 1;

  const renderPage = () => {
    switch (page) {
      case 'dashboard':
        return (
          <Dashboard
            data={data}
            onNavigate={navigate}
            onSetPortfolioBase={handleSetPortfolioBase}
            onAddDeposit={handleAddDeposit}
            onDeleteDeposit={handleDeleteDeposit}
            onSetRiskUnit={handleSetRiskUnit}
            onSetDefaultCommission={handleSetDefaultCommission}
          />
        );
      case 'trades':
        return (
          <TradeLog
            data={data}
            onEdit={(id) => navigate('edit-trade', id)}
            onDelete={handleDeleteTrade}
            onAdd={() => navigate('add-trade')}
            onView={(id) => navigate('trade-detail', id)}
          />
        );
      case 'trade-detail': {
        const viewTrade = editTradeId ? data.trades.find((t) => t.id === editTradeId) : undefined;
        return viewTrade ? (
          <TradeDetail
            trade={viewTrade}
            riskUnitValue={data.riskUnitValue ?? 100}
            onBack={() => navigate('trades')}
            onEdit={(id) => navigate('edit-trade', id)}
          />
        ) : <div />;
      }
      case 'add-trade':
        return (
          <TradeForm
            nextSerial={nextSerial}
            defaultCommissionPerAction={data.defaultCommissionPerAction ?? 2.5}
            onSave={handleSaveTrade}
            onCancel={() => navigate('trades')}
          />
        );
      case 'edit-trade':
        return (
          <TradeForm
            existing={editTrade}
            nextSerial={nextSerial}
            defaultCommissionPerAction={data.defaultCommissionPerAction ?? 2.5}
            onSave={handleSaveTrade}
            onCancel={() => navigate('trades')}
          />
        );
      case 'statistics':
        return <Statistics data={data} onView={(id) => navigate('trade-detail', id)} />;
      case 'longterm':
        return <LongTermInvestments />;
      case 'settings':
        return <Settings />;
      default:
        return (
          <Dashboard
            data={data}
            onNavigate={navigate}
            onSetPortfolioBase={handleSetPortfolioBase}
            onAddDeposit={handleAddDeposit}
            onDeleteDeposit={handleDeleteDeposit}
            onSetRiskUnit={handleSetRiskUnit}
            onSetDefaultCommission={handleSetDefaultCommission}
          />
        );
    }
  };

  // Map edit-trade to 'trades' for nav highlight
  const navPage: 'dashboard' | 'trades' | 'add-trade' | 'statistics' | 'longterm' | 'settings' =
    page === 'edit-trade' || page === 'trade-detail' ? 'trades' : (page as 'dashboard' | 'trades' | 'add-trade' | 'statistics' | 'longterm' | 'settings');

  return (
    <Layout currentPage={navPage} onNavigate={(p) => navigate(p)}>
      {renderPage()}
    </Layout>
  );
}

export default App;
