import Decimal from "decimal.js";

export interface RabCalculationItemInput {
  volume: number;
  materialUnitCost: number;
  laborUnitCost: number;
  equipmentUnitCost: number;
}

export interface RabCalculationInput {
  items: RabCalculationItemInput[];
  profitType: "MARKUP" | "GROSS_MARGIN";
  profitPercentage: number;
  overheadPercentage: number;
  contingencyPercentage: number;
  taxPercentage: number;
}

export interface RabCalculationResult {
  totalMaterialHpp: number;
  totalLaborHpp: number;
  totalEquipmentHpp: number;
  totalHpp: number;
  overheadAmount: number;
  contingencyAmount: number;
  profitAmount: number;
  subtotalBeforeTax: number;
  taxAmount: number;
  grandTotal: number;
  itemPrices: Array<{ unitHpp: number; totalHpp: number; unitPrice: number; totalPrice: number }>;
}

function percentage(value: number, label: string, maximum = 100): Decimal {
  if (!Number.isFinite(value) || value < 0 || value > maximum) {
    throw new Error(`${label} harus berada di antara 0 dan ${maximum} persen.`);
  }
  return new Decimal(value);
}

export function calculateRab(input: RabCalculationInput): RabCalculationResult {
  const profitRate = percentage(
    input.profitPercentage,
    "Persentase profit",
    input.profitType === "GROSS_MARGIN" ? 99.99 : Number.MAX_SAFE_INTEGER,
  );
  const overheadRate = percentage(input.overheadPercentage, "Persentase overhead");
  const contingencyRate = percentage(input.contingencyPercentage, "Persentase contingency");
  const taxRate = percentage(input.taxPercentage, "Persentase pajak");

  const itemCosts = input.items.map((item) => {
    if (
      !Number.isFinite(item.volume) || item.volume < 0 ||
      !Number.isFinite(item.materialUnitCost) || item.materialUnitCost < 0 ||
      !Number.isFinite(item.laborUnitCost) || item.laborUnitCost < 0 ||
      !Number.isFinite(item.equipmentUnitCost) || item.equipmentUnitCost < 0
    ) {
      throw new Error("Volume dan biaya item RAB harus berupa angka valid dan tidak negatif.");
    }

    const volume = new Decimal(item.volume);
    const material = new Decimal(item.materialUnitCost).mul(volume).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    const labor = new Decimal(item.laborUnitCost).mul(volume).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    const equipment = new Decimal(item.equipmentUnitCost).mul(volume).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    return {
      volume,
      hpp: material.plus(labor).plus(equipment),
      unitHpp: new Decimal(item.materialUnitCost).plus(item.laborUnitCost).plus(item.equipmentUnitCost),
      material,
      labor,
      equipment,
    };
  });

  const roundMoney = (value: Decimal) => value.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const totalMaterialHpp = roundMoney(Decimal.sum(...itemCosts.map((item) => item.material)));
  const totalLaborHpp = roundMoney(Decimal.sum(...itemCosts.map((item) => item.labor)));
  const totalEquipmentHpp = roundMoney(Decimal.sum(...itemCosts.map((item) => item.equipment)));
  const totalHpp = roundMoney(Decimal.sum(...itemCosts.map((item) => item.hpp)));
  const overheadAmount = roundMoney(totalHpp.mul(overheadRate).div(100));
  const contingencyAmount = roundMoney(totalHpp.mul(contingencyRate).div(100));
  const costBeforeProfit = totalHpp.plus(overheadAmount).plus(contingencyAmount);
  const profitAmount = input.profitType === "MARKUP"
    ? roundMoney(costBeforeProfit.mul(profitRate).div(100))
    : roundMoney(costBeforeProfit.mul(profitRate).div(new Decimal(100).minus(profitRate)));
  const subtotalBeforeTax = roundMoney(costBeforeProfit.plus(profitAmount));
  const taxAmount = roundMoney(subtotalBeforeTax.mul(taxRate).div(100));
  const grandTotal = roundMoney(subtotalBeforeTax.plus(taxAmount));

  const lastAllocatableIndex = itemCosts.reduce(
    (lastIndex, item, index) => item.volume.gt(0) && item.hpp.gt(0) ? index : lastIndex,
    -1,
  );
  let allocatedTotal = new Decimal(0);
  const itemPrices = itemCosts.map((item, index) => {
    if (item.volume.isZero() || item.hpp.isZero() || totalHpp.isZero()) {
      return {
        unitHpp: roundMoney(item.unitHpp).toNumber(),
        totalHpp: roundMoney(item.hpp).toNumber(),
        unitPrice: 0,
        totalPrice: 0,
      };
    }
    const totalPrice = index === lastAllocatableIndex
      ? grandTotal.minus(allocatedTotal)
      : roundMoney(grandTotal.mul(item.hpp).div(totalHpp));
    allocatedTotal = allocatedTotal.plus(totalPrice);
    return {
      unitHpp: roundMoney(item.unitHpp).toNumber(),
      totalHpp: roundMoney(item.hpp).toNumber(),
      unitPrice: roundMoney(totalPrice.div(item.volume)).toNumber(),
      totalPrice: totalPrice.toNumber(),
    };
  });

  return {
    totalMaterialHpp: totalMaterialHpp.toNumber(),
    totalLaborHpp: totalLaborHpp.toNumber(),
    totalEquipmentHpp: totalEquipmentHpp.toNumber(),
    totalHpp: totalHpp.toNumber(),
    overheadAmount: overheadAmount.toNumber(),
    contingencyAmount: contingencyAmount.toNumber(),
    profitAmount: profitAmount.toNumber(),
    subtotalBeforeTax: subtotalBeforeTax.toNumber(),
    taxAmount: taxAmount.toNumber(),
    grandTotal: grandTotal.toNumber(),
    itemPrices,
  };
}
