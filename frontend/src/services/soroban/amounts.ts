export type AmountInput = string | number | bigint;

const decimalPattern = /^(\d+)(?:\.(\d+))?$/;

const decimalText = (value: AmountInput, decimals: number): string => {
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 0) {
      throw new Error('Amount must be a finite positive decimal.');
    }
    return value.toFixed(decimals + 1).replace(/0+$/, '').replace(/\.$/, '');
  }
  const text = value.trim();
  if (!text || text.startsWith('-')) {
    throw new Error('Amount must be a finite positive decimal.');
  }
  return text;
};

export const decimalToScaledBigInt = (
  value: AmountInput,
  decimals: number,
  rounding: 'round' | 'ceil' | 'floor' = 'round'
): bigint => {
  const text = decimalText(value, decimals);
  const match = text.match(decimalPattern);
  if (!match) {
    throw new Error('Amount must use plain decimal notation.');
  }

  const [, wholeText, fractionText = ''] = match;
  const scale = 10n ** BigInt(decimals);
  let units = BigInt(wholeText) * scale;
  const paddedFraction = fractionText.padEnd(decimals, '0');
  const keptFraction = paddedFraction.slice(0, decimals);
  if (keptFraction) {
    units += BigInt(keptFraction);
  }

  const discarded = fractionText.slice(decimals);
  if (discarded && /[1-9]/.test(discarded)) {
    if (rounding === 'ceil' || (rounding === 'round' && Number(discarded[0]) >= 5)) {
      units += 1n;
    }
  }

  return units;
};

export const scaledBigIntToDecimalString = (value: AmountInput, decimals: number): string => {
  const raw = typeof value === 'bigint' ? value : BigInt(String(value));
  const scale = 10n ** BigInt(decimals);
  const whole = raw / scale;
  const fraction = raw % scale;
  const fractionText = fraction.toString().padStart(decimals, '0').replace(/0+$/, '');
  return fractionText ? `${whole.toString()}.${fractionText}` : whole.toString();
};

export const decimalToStellarAmount = (
  value: AmountInput,
  decimals: number,
  rounding: 'round' | 'ceil' | 'floor' = 'round'
): string => {
  const units = decimalToScaledBigInt(value, decimals, rounding);
  if (units <= 0n) {
    throw new Error(`Amount is below the Stellar minimum precision of 1e-${decimals}.`);
  }
  return scaledBigIntToDecimalString(units, decimals);
};
