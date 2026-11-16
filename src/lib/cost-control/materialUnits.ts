export interface MaterialUnitDefinition {
  purchaseUnit: string;
  usageUnit: string;
  conversionFactor: number;
}

export function convertMaterialQuantityToUsageUnit(
  quantity: number,
  unit: string,
  material: MaterialUnitDefinition,
): number {
  if (!Number.isFinite(quantity) || quantity < 0) {
    throw new Error("Kuantitas material harus berupa angka valid dan tidak negatif.");
  }
  if (!Number.isFinite(material.conversionFactor) || material.conversionFactor <= 0) {
    throw new Error("Faktor konversi material tidak valid.");
  }

  const normalizedUnit = unit.trim().toLowerCase();
  if (normalizedUnit === material.usageUnit.trim().toLowerCase()) return quantity;
  if (normalizedUnit === material.purchaseUnit.trim().toLowerCase()) {
    return quantity * material.conversionFactor;
  }
  throw new Error(`Satuan '${unit}' tidak dapat dikonversi ke '${material.usageUnit}'.`);
}

export function getUsageUnitPrice(purchaseUnitPrice: number, conversionFactor: number): number {
  if (!Number.isFinite(purchaseUnitPrice) || purchaseUnitPrice < 0) {
    throw new Error("Harga satuan beli harus berupa angka valid dan tidak negatif.");
  }
  if (!Number.isFinite(conversionFactor) || conversionFactor <= 0) {
    throw new Error("Faktor konversi material tidak valid.");
  }
  return purchaseUnitPrice / conversionFactor;
}
