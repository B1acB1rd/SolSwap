import axios from 'axios';

type PriceCache = {
  usd: Record<string, number>; // symbol->usd
  ngnFx: number | null;
  fetchedAt: number; // epoch ms
};

const cache: PriceCache = { usd: {}, ngnFx: null, fetchedAt: 0 };
const FRESH_MS = 30_000;

async function fetchUsdPrices(symbols: string[]): Promise<Record<string, number>> {
  // CoinGecko simple price API
  // Map common symbols to coingecko ids
  const idMap: Record<string, string> = { SOL: 'solana', USDC: 'usd-coin', USDT: 'tether' };
  const ids = symbols.map((s) => idMap[s]).filter(Boolean);
  const { data } = await axios.get('https://api.coingecko.com/api/v3/simple/price', {
    params: { ids: ids.join(','), vs_currencies: 'usd' },
    timeout: 10_000,
  });
  const out: Record<string, number> = {};
  for (const sym of symbols) {
    const id = idMap[sym];
    const usd = data?.[id]?.usd;
    if (typeof usd === 'number') out[sym] = usd;
  }
  return out;
}

async function fetchUsdToNgn(): Promise<number> {
  // Use coingecko exchange rates endpoint
  const { data } = await axios.get('https://api.coingecko.com/api/v3/exchange_rates', { timeout: 10_000 });
  const usdRate = data?.rates?.usd?.value;
  const ngnRate = data?.rates?.ngn?.value;
  if (!usdRate || !ngnRate) throw new Error('FX rates unavailable');
  // Rates are in BTC base terms; convert to NGN per USD:
  // ngn_per_usd = (ngn/btc) / (usd/btc)
  return ngnRate / usdRate;
}

export async function getPricing(symbols: string[]): Promise<{ usd: Record<string, number>; ngnFx: number }> {
  const now = Date.now();
  const fresh = now - cache.fetchedAt < FRESH_MS;
  if (fresh && Object.keys(cache.usd).length && cache.ngnFx) {
    return { usd: cache.usd, ngnFx: cache.ngnFx };
  }
  const [usd, ngnFx] = await Promise.all([fetchUsdPrices(symbols), fetchUsdToNgn()]);
  cache.usd = usd;
  cache.ngnFx = ngnFx;
  cache.fetchedAt = now;
  return { usd, ngnFx };
}

export function applySpread(amountNgn: number, spreadBps: number): number {
  const factor = 1 - spreadBps / 10_000;
  return Math.round(amountNgn * factor * 100) / 100; // 2dp
}


