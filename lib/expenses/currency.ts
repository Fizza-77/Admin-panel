import { parseAmountInput, parseNonNegativeAmountInput } from '@/lib/expenses/types';

export const EXPENSE_MONEY_CURRENCIES = [
  { value: 'PKR', label: 'PKR' },
  { value: 'USD', label: 'USD' },
  { value: 'AUD', label: 'AUD' },
  { value: 'SAR', label: 'SAR' },
  { value: 'BD', label: 'BD' },
] as const;

export type MoneyCurrency = (typeof EXPENSE_MONEY_CURRENCIES)[number]['value'];

type ForeignCurrency = Exclude<MoneyCurrency, 'PKR'>;

const FOREIGN_CURRENCY_ENV: Record<ForeignCurrency, string> = {
  USD: 'USD_TO_PKR_RATE',
  AUD: 'AUD_TO_PKR_RATE',
  SAR: 'SAR_TO_PKR_RATE',
  BD: 'BD_TO_PKR_RATE',
};

const DEFAULT_RATES_TO_PKR: Record<ForeignCurrency, number> = {
  USD: 278,
  AUD: 180,
  SAR: 74,
  BD: 2.3,
};

function readRateFromEnv(envKey: string, fallback: number): number {
  const envRate = Number(process.env[envKey] ?? process.env[`NEXT_PUBLIC_${envKey}`]);
  return Number.isFinite(envRate) && envRate > 0 ? envRate : fallback;
}

export const DEFAULT_USD_TO_PKR_RATE = readRateFromEnv(FOREIGN_CURRENCY_ENV.USD, DEFAULT_RATES_TO_PKR.USD);

function getRateToPkr(currency: ForeignCurrency): number {
  return readRateFromEnv(FOREIGN_CURRENCY_ENV[currency], DEFAULT_RATES_TO_PKR[currency]);
}

export function getExchangeRateToPkr(currency: MoneyCurrency): number {
  if (currency === 'PKR') {
    return 1;
  }
  return getRateToPkr(currency);
}

/** Convert stored PKR amount to selected display currency. */
export function convertPkrToCurrency(pkrAmount: number, currency: MoneyCurrency): number {
  if (currency === 'PKR') {
    return pkrAmount;
  }
  const rate = getRateToPkr(currency);
  return Math.round((pkrAmount / rate) * 100) / 100;
}

function intlCurrencyCode(currency: MoneyCurrency): string {
  return currency === 'BD' ? 'BDT' : currency;
}

export function getCurrencySymbol(currency: MoneyCurrency): string {
  const symbols: Record<MoneyCurrency, string> = {
    PKR: 'Rs',
    USD: '$',
    AUD: 'A$',
    SAR: 'SR',
    BD: '৳',
  };
  return symbols[currency];
}

export function formatDisplayAmount(pkrAmount: number, currency: MoneyCurrency): string {
  const amount = convertPkrToCurrency(pkrAmount, currency);
  if (currency === 'PKR') {
    return new Intl.NumberFormat('en-PK', {
      style: 'currency',
      currency: 'PKR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: intlCurrencyCode(currency),
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDisplayAmountShort(pkrAmount: number, currency: MoneyCurrency): string {
  return `${getCurrencySymbol(currency)}${formatCompactNumber(convertPkrToCurrency(pkrAmount, currency))}`;
}

export function formatCompactCurrencyAmount(pkrAmount: number, currency: MoneyCurrency): string {
  return formatCompactNumber(convertPkrToCurrency(pkrAmount, currency));
}

function formatCompactNumber(amount: number): string {
  const abs = Math.abs(amount);
  if (abs >= 1_000_000) {
    const value = amount / 1_000_000;
    return `${value >= 10 ? Math.round(value) : value.toFixed(1).replace(/\.0$/, '')}M`;
  }
  if (abs >= 10_000) {
    return `${Math.round(amount / 1000)}K`;
  }
  if (abs >= 1000) {
    const value = amount / 1000;
    return `${value >= 10 ? Math.round(value) : value.toFixed(1).replace(/\.0$/, '')}K`;
  }
  return String(Math.round(amount));
}

export function isMoneyCurrency(value: unknown): value is MoneyCurrency {
  return typeof value === 'string' && EXPENSE_MONEY_CURRENCIES.some((item) => item.value === value);
}

export function parseMoneyCurrency(value: unknown): MoneyCurrency {
  if (typeof value !== 'string') {
    return 'PKR';
  }
  const normalized = value.trim().toUpperCase();
  if (normalized === 'BDT') {
    return 'BD';
  }
  return isMoneyCurrency(normalized) ? normalized : 'PKR';
}

export function convertAmountToPkr(amount: number, currency: MoneyCurrency, usdToPkrRate?: number): number {
  if (currency === 'PKR') {
    return amount;
  }
  if (currency === 'USD' && usdToPkrRate != null && Number.isFinite(usdToPkrRate) && usdToPkrRate > 0) {
    return Math.round(amount * usdToPkrRate * 100) / 100;
  }
  const rate = getRateToPkr(currency);
  return Math.round(amount * rate * 100) / 100;
}

export function resolveAmountInPkr(
  amountInput: string,
  currency: MoneyCurrency,
  options?: { allowZero?: boolean; optional?: boolean },
): { pkr: number | null } | { error: string } {
  const trimmed = amountInput.trim();
  if (!trimmed) {
    if (options?.optional) {
      return { pkr: null };
    }
    return { error: 'Amount is required' };
  }

  const parse = options?.allowZero ? parseNonNegativeAmountInput : parseAmountInput;
  const amount = parse(trimmed);
  if (amount === null) {
    return { error: options?.allowZero ? 'Enter a valid amount (0 or more)' : 'Enter a valid amount greater than 0' };
  }

  if (currency === 'PKR') {
    return { pkr: amount };
  }

  const pkr = convertAmountToPkr(amount, currency);
  if (!options?.allowZero && pkr <= 0) {
    return { error: 'Converted PKR amount must be greater than 0' };
  }

  return { pkr };
}

/** Parse amount from API body; converts foreign currency to PKR using configured rates. */
export function parseIncomingAmountPkr(
  body: { amount?: unknown; monthly_amount?: unknown; amount_currency?: unknown },
  options?: { allowZero?: boolean; optional?: boolean },
): { pkr: number | null } | { error: string } {
  const raw = body.amount !== undefined ? body.amount : body.monthly_amount;
  if (raw === undefined || raw === null || raw === '') {
    if (options?.optional) {
      return { pkr: null };
    }
    return { error: 'Amount is required' };
  }

  const currency = parseMoneyCurrency(body.amount_currency);
  return resolveAmountInPkr(String(raw), currency, options);
}
