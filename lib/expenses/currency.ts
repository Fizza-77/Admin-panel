import { parseAmountInput, parseNonNegativeAmountInput } from '@/lib/expenses/types';

export type MoneyCurrency = 'PKR' | 'USD';

const envRate = Number(process.env.USD_TO_PKR_RATE ?? process.env.NEXT_PUBLIC_USD_TO_PKR_RATE);

export const DEFAULT_USD_TO_PKR_RATE = Number.isFinite(envRate) && envRate > 0 ? envRate : 278;

export function convertAmountToPkr(amount: number, currency: MoneyCurrency, usdToPkrRate: number): number {
  if (currency === 'PKR') {
    return amount;
  }
  return Math.round(amount * usdToPkrRate * 100) / 100;
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

  const rate = DEFAULT_USD_TO_PKR_RATE;
  const pkr = convertAmountToPkr(amount, 'USD', rate);
  if (!options?.allowZero && pkr <= 0) {
    return { error: 'Converted PKR amount must be greater than 0' };
  }

  return { pkr };
}

/** Parse amount from API body; converts USD to PKR using the default rate. */
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

  const currency: MoneyCurrency = body.amount_currency === 'USD' ? 'USD' : 'PKR';
  return resolveAmountInPkr(String(raw), currency, options);
}
