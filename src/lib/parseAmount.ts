export function parseAmountInput(value: string): number | null {
  const cleaned = value.trim().replace(/^Rp\s*/i, "").replace(/\s/g, "");
  const match = cleaned.match(/^([+-]?)(\d[\d.,]*)$/);
  if (!match) return null;

  const [, sign, numericPart] = match;
  const hasComma = numericPart.includes(",");
  const hasDot = numericPart.includes(".");
  let normalized: string;

  if (hasComma && hasDot) {
    const decimalSeparator =
      numericPart.lastIndexOf(",") > numericPart.lastIndexOf(".") ? "," : ".";
    const groupingSeparator = decimalSeparator === "," ? "." : ",";
    const [integerPart, fractionalPart] = numericPart.split(decimalSeparator);
    if (
      !fractionalPart ||
      fractionalPart.length > 2 ||
      fractionalPart.includes(groupingSeparator)
    ) {
      return null;
    }

    const validInteger =
      /^\d+$/.test(integerPart) ||
      new RegExp(`^\\d{1,3}(?:\\${groupingSeparator}\\d{3})+$`).test(integerPart);
    if (!validInteger) return null;
    normalized = `${integerPart.replace(new RegExp(`\\${groupingSeparator}`, "g"), "")}.${fractionalPart}`;
  } else if (hasComma || hasDot) {
    const separator = hasComma ? "," : ".";
    const parts = numericPart.split(separator);
    if (parts.length === 2) {
      const [integerPart, fractionalPart] = parts;
      if (!fractionalPart) return null;

      if (fractionalPart.length <= 2) {
        normalized = `${integerPart}.${fractionalPart}`;
      } else if (
        fractionalPart.length === 3 &&
        /^\d{1,3}$/.test(integerPart)
      ) {
        normalized = `${integerPart}${fractionalPart}`;
      } else {
        return null;
      }
    } else if (
      /^\d{1,3}(?:[.,]\d{3})+$/.test(numericPart)
    ) {
      normalized = numericPart.replace(/[.,]/g, "");
    } else {
      return null;
    }
  } else {
    normalized = numericPart;
  }

  const amount = Number(`${sign}${normalized}`);
  return Number.isFinite(amount) ? amount : null;
}
