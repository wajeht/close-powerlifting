export interface WeightClass {
  readonly kilograms: number;
  readonly over: boolean;
}

const REGEX_WEIGHT_CLASS = /^(-?\d+(?:\.\d+)?)(\+)?$/;

export function parseWeightClass(value: string | undefined): WeightClass | null {
  const match = value == null ? null : REGEX_WEIGHT_CLASS.exec(value.trim());
  if (match == null) return null;

  const kilograms = Number(match[1]);
  const over = match[2] === "+";
  if (!Number.isFinite(kilograms) || kilograms === 0 || (over && kilograms < 0)) return null;

  return { kilograms, over };
}
