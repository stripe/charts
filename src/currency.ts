// Minor units: how many decimal places a currency's amounts carry when they
// are given as integers in the smallest unit, as the Stripe API reports them
// (1999 USD cents is $19.99).
//
// This follows Stripe's documented rules rather than Intl: Intl reports
// display digits from CLDR, which differ from API amounts for some
// currencies (Intl shows HUF, IDR and COP with no decimals, but their API
// amounts carry two). Source: https://docs.stripe.com/currencies, sections
// "Zero-decimal currencies", "Three-decimal currencies" and "Special cases".

// "Currencies are two-decimal currencies unless otherwise specified."
const DEFAULT_EXPONENT = 2;

// Zero-decimal currencies: "the charge and the amount are the same".
const ZERO_DECIMAL = new Set([
  'BIF',
  'CLP',
  'DJF',
  'GNF',
  'JPY',
  'KMF',
  'KRW',
  'MGA',
  'PYG',
  'RWF',
  'VND',
  'VUV',
  'XAF',
  'XOF',
  'XPF',
]);

// Three-decimal currencies: the smallest unit is 0.001. LYD is 3 in ISO
// 4217 but not on Stripe's three-decimal list, so it gets the default 2.
const THREE_DECIMAL = new Set(['BHD', 'JOD', 'KWD', 'OMR', 'TND']);

// ISK and UGX "transitioned to a zero-decimal currency, but backward
// compatibility requires you to represent it as a two-decimal value", so
// their amounts carry two decimals (500 is 5 ISK) and they are left out of
// the zero-decimal set above. HUF and TWD charge two-decimal amounts too.

const EXPONENTS: Readonly<Record<number, ReadonlySet<string>>> = {
  0: ZERO_DECIMAL,
  3: THREE_DECIMAL,
};

/** Decimal places in a currency's minor unit: 2 for USD, 0 for JPY, 3 for KWD. */
export function minorUnitExponent(currency: string): number {
  const code = currency.toUpperCase();
  const match = Object.entries(EXPONENTS).find(([, codes]) => codes.has(code));
  return match ? Number(match[0]) : DEFAULT_EXPONENT;
}

/**
 * Converts an amount in minor units to major units: 1999 USD is 19.99.
 * Dividing by an exact power of ten is correctly rounded, so the result is
 * the same double as the major-unit literal (19.99); multiplying by 0.01
 * would not be (19.990000000000002), and could shift ticks and labels.
 */
export function minorToMajor(amount: number, currency: string): number {
  return amount / 10 ** minorUnitExponent(currency);
}
