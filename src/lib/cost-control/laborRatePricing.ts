export interface LaborRatePricingInput {
  standard_rate: number;
  mandor_rates?: Array<{ mandor_name: string; rate: number }>;
}

export function resolveLaborRatePrice(
  rate: LaborRatePricingInput,
  mandorName: string,
): { unitRate: number; source: "MANDOR" | "STANDARD" } {
  const mandorKey = mandorName.trim().toLocaleLowerCase();
  const mandorRates = rate.mandor_rates || [];
  const matchingRates = mandorKey
    ? mandorRates.filter((mandorRate) => mandorRate.mandor_name.trim().toLocaleLowerCase() === mandorKey)
    : [];
  const applicableRates = matchingRates.length > 0 ? matchingRates : mandorRates;

  if (applicableRates.length > 0) {
    const average = Math.round(
      applicableRates.reduce((total, mandorRate) => total + mandorRate.rate, 0) / applicableRates.length,
    );
    return { unitRate: average, source: matchingRates.length > 0 ? "MANDOR" : "STANDARD" };
  }

  return { unitRate: rate.standard_rate, source: "STANDARD" };
}
