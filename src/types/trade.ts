export interface TradeEntry {
  price: number;
  quantity: number;
  sl?: number;
  tp?: number;
  totalAmount: number;
  risk?: number;
  date?: string; // optional date for reinforcements
  commission?: number; // per-action commission (from broker import or manual)
}

export interface TradeExit {
  price: number;
  quantity: number;
  totalAmount: number;
  profitLoss: number;
  profitLossPercent: number;
  notes: string;
  date?: string; // optional exit date
  commission?: number; // per-action commission (from broker import or manual)
}

export interface Trade {
  id: string;
  serialNumber: number;
  type: 'long' | 'short';
  stockName: string;
  date: string; // ISO date
  initialEntry: TradeEntry;
  reinforcements: TradeEntry[]; // up to 3
  exits: TradeExit[]; // up to 3
  totalShares: number;
  avgEntryPrice: number;
  totalInvested: number;
  totalProfitLoss: number;
  totalProfitLossPercent: number;
  rr: number; // risk/reward ratio achieved
  commissions: number; // total commissions (buy + sell legs)
  entryReason: string;
  exitReason: string;
  conclusions: string;
  notes: string;
  behavioralTags: string[];
  createdAt: string;
  status?: 'open' | 'closed'; // undefined = closed (backward-compat)
  ibkrImported?: boolean;
}

export interface PortfolioDeposit {
  id: string;
  amount: number;
  date: string;
  note: string;
}

export interface AppData {
  trades: Trade[];
  deposits: PortfolioDeposit[];
  portfolioBaseValue: number; // manually-editable base (initial capital + all deposits)
  defaultCommissionPerAction: number; // $ per buy/sell leg, default 2.5
  riskUnitValue: number; // $ value of one risk unit, user-defined
  ibkrLastSync?: string; // ISO timestamp of last successful IBKR import
  commissionsFixed?: boolean; // one-time migration flag: true after * 2 bug correction
}
