export interface MaterialPriceSummary {
  minPrice: number;
  maxPrice: number;
  averagePrice: number;
}

export function summarizeMaterialPrices(prices: number[]): MaterialPriceSummary {
  const validPrices = prices.filter((price) => Number.isFinite(price) && price > 0);
  if (validPrices.length === 0) {
    return { minPrice: 0, maxPrice: 0, averagePrice: 0 };
  }

  const minPrice = Math.min(...validPrices);
  const maxPrice = Math.max(...validPrices);
  return {
    minPrice,
    maxPrice,
    averagePrice: Math.round((minPrice + maxPrice) / 2),
  };
}
