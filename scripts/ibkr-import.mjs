// IBKR Flex Web Service import script
// Runs via GitHub Actions every weekday night (00:30 Israel time)
// Fetches closed + open positions from IBKR and merges into Supabase app_state row id=1

class Flex1001Error extends Error {}

const IBKR_FLEX_TOKEN = process.env.IBKR_FLEX_TOKEN;
const IBKR_FLEX_QUERY_ID = process.env.IBKR_FLEX_QUERY_ID;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_ROW_ID = 1;
const DRY_RUN = process.env.DRY_RUN === 'true';

const IBKR_REQUEST_URL = 'https://gdcdyn.interactivebrokers.com/Universal/servlet/FlexStatementService.SendRequest';
const IBKR_DOWNLOAD_URL = 'https://gdcdyn.interactivebrokers.com/Universal/servlet/FlexStatementService.GetStatement';

// ── Supabase ─────────────────────────────────────────────────────────────────

async function supabaseGet() {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/app_state?id=eq.${SUPABASE_ROW_ID}&select=data`,
    {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
    }
  );
  const rows = await res.json();
  if (!rows || rows.length === 0) throw new Error('No data found in Supabase row 1');
  return rows[0].data;
}

async function supabaseSave(data) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/app_state?id=eq.${SUPABASE_ROW_ID}`, {
    method: 'PATCH',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ data, updated_at: new Date().toISOString() }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase save failed: ${res.status} ${text}`);
  }
}

// ── IBKR Flex API ─────────────────────────────────────────────────────────────

async function fetchFlexReport() {
  console.log('Requesting IBKR Flex report...');

  // Step 1: request report generation (retry up to 5x on error 1001)
  const STEP1_MAX_ATTEMPTS = 5;
  const STEP1_RETRY_DELAY_MS = 30_000;
  let refCode = null;

  for (let attempt = 1; attempt <= STEP1_MAX_ATTEMPTS; attempt++) {
    if (attempt > 1) {
      console.log(`Step 1 retry ${attempt}/${STEP1_MAX_ATTEMPTS} — waiting ${STEP1_RETRY_DELAY_MS / 1000}s...`);
      await new Promise(r => setTimeout(r, STEP1_RETRY_DELAY_MS));
    }

    const reqRes = await fetch(
      `${IBKR_REQUEST_URL}?t=${IBKR_FLEX_TOKEN}&q=${IBKR_FLEX_QUERY_ID}&v=3`
    );
    const reqText = await reqRes.text();

    refCode = extractAttr(reqText, 'ReferenceCode');
    if (refCode) break;

    const status = extractAttr(reqText, 'Status') || '';
    const errorCode = extractAttr(reqText, 'ErrorCode') || '';
    const errorMsg = extractAttr(reqText, 'ErrorMessage') || '';
    console.log(`IBKR Step 1 response: Status="${status}", ErrorCode="${errorCode}", Message="${errorMsg}"`);

    if (errorCode !== '1001') {
      throw new Error(`IBKR request failed: ${status} (${errorCode}: ${errorMsg})`);
    }

    if (attempt === STEP1_MAX_ATTEMPTS) {
      throw new Flex1001Error(
        `IBKR returned 1001 for ${STEP1_MAX_ATTEMPTS} consecutive attempts. ` +
        'Token may have expired — log into IBKR → Account Management → Flex Web Service → regenerate token → update GitHub Secret IBKR_FLEX_TOKEN.'
      );
    }
  }

  console.log(`Got reference code: ${refCode}`);

  // Step 2: poll until report is ready (max 30 seconds)
  for (let attempt = 0; attempt < 15; attempt++) {
    await new Promise(r => setTimeout(r, 2000));
    const dlRes = await fetch(
      `${IBKR_DOWNLOAD_URL}?t=${IBKR_FLEX_TOKEN}&q=${refCode}&v=3`
    );
    const dlText = await dlRes.text();

    if (dlText.includes('<FlexQueryResponse')) {
      console.log('Report downloaded successfully.');
      return dlText;
    }

    const status = extractAttr(dlText, 'Status') || '';
    if (status === 'Statement generation in progress' || status === 'Initial run') {
      console.log(`Waiting for report... (attempt ${attempt + 1})`);
      continue;
    }
    throw new Error(`IBKR download failed: ${status || dlText.slice(0, 200)}`);
  }
  throw new Error('IBKR report timed out after 30 seconds');
}

// ── XML Parsing (no external dependencies) ───────────────────────────────────

function extractAttr(xml, tagName) {
  const match = xml.match(new RegExp(`<${tagName}>([^<]*)<\/${tagName}>`));
  return match ? match[1].trim() : null;
}

function parseAttrString(attrStr) {
  const attrs = {};
  const re = /(\w+)="([^"]*)"/g;
  let m;
  while ((m = re.exec(attrStr)) !== null) {
    attrs[m[1]] = m[2];
  }
  return attrs;
}

function parseExecutions(xml) {
  const orderRe = /<Trade\s([^>]+?)\/>/g;
  const results = [];
  let m;
  while ((m = orderRe.exec(xml)) !== null) {
    const attrs = parseAttrString(m[1]);
    // Only import US stocks
    if (attrs.assetCategory !== 'STK' || attrs.currency !== 'USD') {
      if (attrs.symbol) console.log(`  Skip ${attrs.symbol}: category=${attrs.assetCategory}, currency=${attrs.currency}`);
      continue;
    }
    if (!attrs.symbol || !attrs.buySell || !attrs.quantity || !attrs.tradePrice) {
      console.log(`  Skip incomplete: symbol=${attrs.symbol || '?'}, buySell=${attrs.buySell || '?'}`);
      continue;
    }

    const rawDate = attrs.tradeDate || '';
    const dateISO = rawDate.length === 8
      ? `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`
      : rawDate;

    // orderTime format: "20250115;093045"
    const rawTime = attrs.orderTime || attrs.tradeDate || '';
    const timeISO = rawTime.includes(';')
      ? `${dateISO}T${rawTime.split(';')[1].replace(/(\d{2})(\d{2})(\d{2})/, '$1:$2:$3')}`
      : `${dateISO}T00:00:00`;

    results.push({
      symbol: attrs.symbol.toUpperCase(),
      side: attrs.buySell === 'BUY' ? 'BUY' : 'SELL',
      quantity: Math.abs(parseFloat(attrs.quantity)),
      price: parseFloat(attrs.tradePrice),
      commission: Math.abs(parseFloat(attrs.ibCommission || '0')),
      dateISO,
      timeISO,
      openClose: attrs.openCloseIndicator || 'A',
    });
  }

  // Sort by time ascending
  results.sort((a, b) => a.timeISO.localeCompare(b.timeISO));
  console.log(`Parsed ${results.length} STK/USD executions from IBKR`);
return results;
}

// ── Position Lifecycle Tracking ───────────────────────────────────────────────

function groupExecutionsIntoPositions(executions) {
  const openPositions = new Map(); // symbol -> PositionState
  const completedTrades = [];

  for (const ex of executions) {
    const existing = openPositions.get(ex.symbol);

    if (!existing) {
      // New position
      openPositions.set(ex.symbol, {
        symbol: ex.symbol,
        type: ex.side === 'BUY' ? 'long' : 'short',
        entries: [ex],
        exits: [],
        openQty: ex.quantity,
        openedAt: ex.timeISO,
      });
    } else {
      const isSameDirection =
        (existing.type === 'long' && ex.side === 'BUY') ||
        (existing.type === 'short' && ex.side === 'SELL');

      if (isSameDirection) {
        // Reinforcement
        existing.entries.push(ex);
        existing.openQty += ex.quantity;
      } else {
        // Exit (partial or full)
        existing.exits.push(ex);
        existing.openQty -= ex.quantity;

        if (Math.abs(existing.openQty) < 0.001) {
          // Position fully closed
          completedTrades.push({ ...existing, status: 'closed' });
          openPositions.delete(ex.symbol);
        } else if (existing.openQty < -0.001) {
          // Position flipped (rare) — close current, open reverse
          completedTrades.push({ ...existing, status: 'closed' });
          const newType = existing.type === 'long' ? 'short' : 'long';
          const flipQty = Math.abs(existing.openQty);
          openPositions.set(ex.symbol, {
            symbol: ex.symbol,
            type: newType,
            entries: [{ ...ex, quantity: flipQty }],
            exits: [],
            openQty: flipQty,
            openedAt: ex.timeISO,
          });
        }
      }
    }
  }

  // Remaining open positions
  for (const pos of openPositions.values()) {
    completedTrades.push({ ...pos, status: 'open' });
  }

  return completedTrades;
}

// ── Trade Mapping ─────────────────────────────────────────────────────────────

function djb2(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function generateId(pos) {
  const seed = [
    pos.symbol,
    pos.type,
    pos.entries[0].dateISO,
    pos.entries[0].price.toFixed(4),
    pos.entries[0].quantity,
  ].join('|');
  return 'ibkr-' + djb2(seed);
}

function calcAvgEntry(entries) {
  const totalCost = entries.reduce((s, e) => s + e.price * e.quantity, 0);
  const totalQty = entries.reduce((s, e) => s + e.quantity, 0);
  return totalQty > 0 ? totalCost / totalQty : 0;
}

function mapPositionToTrade(pos, serialNumber) {
  const avgEntry = calcAvgEntry(pos.entries);
  const totalShares = pos.entries.reduce((s, e) => s + e.quantity, 0);
  const totalInvested = avgEntry * totalShares;

  const initialEntry = {
    price: pos.entries[0].price,
    quantity: pos.entries[0].quantity,
    totalAmount: pos.entries[0].price * pos.entries[0].quantity,
    date: pos.entries[0].dateISO,
  };

  const reinforcements = pos.entries.slice(1, 4).map(e => ({
    price: e.price,
    quantity: e.quantity,
    totalAmount: e.price * e.quantity,
    date: e.dateISO,
  }));

  const exits = pos.exits.slice(0, 4).map(e => {
    const costBasis = avgEntry * e.quantity;
    const pl = pos.type === 'long'
      ? e.price * e.quantity - costBasis
      : costBasis - e.price * e.quantity;
    return {
      price: e.price,
      quantity: e.quantity,
      totalAmount: e.price * e.quantity,
      profitLoss: Math.round(pl * 100) / 100,
      profitLossPercent: costBasis > 0 ? Math.round((pl / costBasis) * 10000) / 100 : 0,
      notes: '',
      date: e.dateISO,
    };
  });

  const totalPL = exits.reduce((s, e) => s + e.profitLoss, 0);
  const totalCommissions =
    pos.entries.reduce((s, e) => s + e.commission, 0) +
    pos.exits.reduce((s, e) => s + e.commission, 0);

  return {
    id: generateId(pos),
    serialNumber,
    type: pos.type,
    stockName: pos.symbol,
    date: pos.entries[0].dateISO,
    initialEntry,
    reinforcements,
    exits,
    totalShares,
    avgEntryPrice: Math.round(avgEntry * 10000) / 10000,
    totalInvested: Math.round(totalInvested * 100) / 100,
    totalProfitLoss: Math.round(totalPL * 100) / 100,
    totalProfitLossPercent: totalInvested > 0 ? Math.round((totalPL / totalInvested) * 10000) / 100 : 0,
    rr: 0,
    commissions: Math.round(totalCommissions * 100) / 100,
    entryReason: '',
    exitReason: '',
    conclusions: '',
    notes: '[Imported from IBKR]',
    behavioralTags: [],
    createdAt: new Date().toISOString(),
    status: pos.status,
    ibkrImported: true,
  };
}

// ── Merge Logic ───────────────────────────────────────────────────────────────

function mergeIntoAppData(appData, ibkrTrades) {
  const trades = [...(appData.trades || [])];
  let newCount = 0;
  let updatedCount = 0;

  for (const ibkrTrade of ibkrTrades) {
    const existingIdx = trades.findIndex(t => t.id === ibkrTrade.id);

    if (existingIdx === -1) {
      // New trade — assign next serial number
      const maxSerial = trades.length > 0
        ? Math.max(...trades.map(t => t.serialNumber || 0))
        : 0;
      ibkrTrade.serialNumber = maxSerial + 1;
      trades.push(ibkrTrade);
      newCount++;
      console.log(`  + New ${ibkrTrade.status} trade: ${ibkrTrade.stockName} (${ibkrTrade.date})`);
    } else if (trades[existingIdx].status === 'open' && ibkrTrade.status === 'closed') {
      // Position closed — update exits + status, preserve manual fields
      trades[existingIdx] = {
        ...trades[existingIdx],
        exits: ibkrTrade.exits,
        totalProfitLoss: ibkrTrade.totalProfitLoss,
        totalProfitLossPercent: ibkrTrade.totalProfitLossPercent,
        commissions: ibkrTrade.commissions,
        status: 'closed',
      };
      updatedCount++;
      console.log(`  ✓ Closed trade: ${ibkrTrade.stockName} (${ibkrTrade.date}) P&L: ${ibkrTrade.totalProfitLoss}`);
    } else if (trades[existingIdx].status === 'open' && ibkrTrade.status === 'open') {
      // Still open — sync exits/shares in case of partial sell or position add
      const prevExits = (trades[existingIdx].exits || []).length;
      const newExits = (ibkrTrade.exits || []).length;
      const sharesChanged = trades[existingIdx].totalShares !== ibkrTrade.totalShares;
      if (newExits !== prevExits || sharesChanged) {
        trades[existingIdx] = {
          ...trades[existingIdx],
          exits: ibkrTrade.exits,
          totalShares: ibkrTrade.totalShares,
          avgEntryPrice: ibkrTrade.avgEntryPrice,
          totalInvested: ibkrTrade.totalInvested,
          totalProfitLoss: ibkrTrade.totalProfitLoss,
          totalProfitLossPercent: ibkrTrade.totalProfitLossPercent,
          commissions: ibkrTrade.commissions,
          reinforcements: ibkrTrade.reinforcements,
        };
        updatedCount++;
        const soldQty = ibkrTrade.exits.reduce((s, e) => s + e.quantity, 0);
        const openQty = ibkrTrade.totalShares - soldQty;
        console.log(`  ~ Updated open position: ${ibkrTrade.stockName} (exits: ${prevExits}→${newExits}, open: ${openQty}/${ibkrTrade.totalShares})`);
      }
    }
    // else: already closed → skip (preserve manual edits)
  }

  if (newCount === 0 && updatedCount === 0) {
    console.log('No changes — all trades already up to date.');
    return null;
  }

  console.log(`Summary: ${newCount} new, ${updatedCount} updated.`);
  return { ...appData, trades };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== IBKR Import Script ===');
  console.log('Time (UTC):', new Date().toISOString());
  if (DRY_RUN) console.log('DRY RUN MODE — no data will be saved');

  const LOCAL_XML_FILE = process.env.LOCAL_XML_FILE;

  if (!LOCAL_XML_FILE && (!IBKR_FLEX_TOKEN || !IBKR_FLEX_QUERY_ID)) {
    throw new Error('Missing IBKR_FLEX_TOKEN or IBKR_FLEX_QUERY_ID');
  }
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY');
  }

  // 1. Fetch XML from IBKR (or read from local file)
  let xml;
  if (LOCAL_XML_FILE) {
    const { readFileSync } = await import('fs');
    xml = readFileSync(LOCAL_XML_FILE, 'utf8');
    console.log('Reading from local file:', LOCAL_XML_FILE);
  } else {
    xml = await fetchFlexReport();
  }

  // 2. Parse executions
  const executions = parseExecutions(xml);
  if (executions.length === 0) {
    console.log('No eligible executions found — nothing to import.');
    return;
  }

  // 3. Group into positions
  const positions = groupExecutionsIntoPositions(executions);
  console.log(`Grouped into ${positions.length} positions (${positions.filter(p => p.status === 'closed').length} closed, ${positions.filter(p => p.status === 'open').length} open)`);

  // 4. Map to Trade objects
  const ibkrTrades = positions.map((pos, i) => mapPositionToTrade(pos, i + 1));

  // 5. Load existing data from Supabase
  const appData = await supabaseGet();
  if (!appData || typeof appData !== 'object') throw new Error('Invalid app data from Supabase');

  // 6. Merge
  const merged = mergeIntoAppData(appData, ibkrTrades);
  if (!merged) {
    console.log('No trade changes — updating sync timestamp only.');
  }

  // 7. Save (always update ibkrLastSync so the UI reflects when sync ran)
  const toSave = { ...(merged ?? appData), ibkrLastSync: new Date().toISOString() };

  if (DRY_RUN) {
    console.log('DRY RUN: would save', toSave.trades.length, 'total trades, ibkrLastSync:', toSave.ibkrLastSync);
    return;
  }

  await supabaseSave(toSave);
  console.log('Saved to Supabase successfully.');
}

main().catch((err) => {
  if (err instanceof Flex1001Error) {
    console.warn('⚠️  ' + err.message);
    process.exit(0);
  }
  console.error('Error:', err.message);
  process.exit(1);
});
