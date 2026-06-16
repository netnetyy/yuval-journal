// Scheduled price update script
// Runs via GitHub Actions every weekday at 23:00 Israel time
// Fetches current prices from Finnhub and saves to Supabase

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY;
const SUPABASE_ROW_ID = 2;

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
  if (!rows || rows.length === 0) throw new Error('No data found in Supabase row 2');
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

async function fetchPrice(symbol) {
  try {
    const res = await fetch(
      `https://finnhub.io/api/v1/quote?symbol=${symbol.toUpperCase()}&token=${FINNHUB_API_KEY}`
    );
    const json = await res.json();
    if (json.c && json.c > 0) return json.c;
    return null;
  } catch {
    return null;
  }
}

function parseStored(raw) {
  if (Array.isArray(raw)) return { investments: raw, snapshots: [] };
  if (raw && typeof raw === 'object' && 'investments' in raw) return raw;
  return { investments: [], snapshots: [] };
}

async function main() {
  console.log('Starting scheduled price update...');
  console.log('Time (UTC):', new Date().toISOString());

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !FINNHUB_API_KEY) {
    throw new Error('Missing required environment variables');
  }

  // Load investments from Supabase
  const raw = await supabaseGet();
  const stored = parseStored(raw);
  const { investments, snapshots } = stored;

  if (investments.length === 0) {
    console.log('No investments found, nothing to update.');
    return;
  }

  console.log(`Found ${investments.length} investments to update.`);

  // Fetch current prices for all investments
  const updated = [...investments];
  for (const inv of updated) {
    const price = await fetchPrice(inv.symbol);
    if (price !== null) {
      inv.currentPrice = price;
      inv.lastPriceUpdate = new Date().toISOString();
      console.log(`✓ ${inv.symbol}: ${price}`);
    } else {
      console.log(`✗ ${inv.symbol}: could not fetch price`);
    }
    // Small delay to avoid API rate limits
    await new Promise((r) => setTimeout(r, 300));
  }

  // Save portfolio value snapshot (one per day)
  const today = new Date().toISOString().slice(0, 10);
  const totalValue = updated.reduce((s, inv) => {
    const shares = inv.purchases.reduce((a, p) => a + p.shares, 0);
    return s + shares * (inv.currentPrice ?? 0);
  }, 0);

  const updatedSnapshots = [
    ...snapshots.filter((s) => s.date !== today),
    { date: today, value: +totalValue.toFixed(2) },
  ].sort((a, b) => a.date.localeCompare(b.date));

  console.log(`Portfolio value today (${today}): ${totalValue.toFixed(2)}`);

  // Save back to Supabase
  await supabaseSave({ investments: updated, snapshots: updatedSnapshots });
  console.log('Prices saved to Supabase successfully.');
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
