export const STANDARD_AHSP_CATEGORIES = [
  "Pekerjaan Persiapan dan Bongkaran",
  "Pekerjaan Struktural",
  "Pekerjaan Arsitektural",
  "Pekerjaan Atap",
  "Pekerjaan Mechanical, Elektrikal, dan Plumbing",
  "Pekerjaan Interior & Furniture",
] as const;

export type StandardAhspCategory = (typeof STANDARD_AHSP_CATEGORIES)[number];

export function normalizeAhspCategory(cat?: string | null): string {
  const c = (cat || "").trim();
  if (!c) return "Pekerjaan Arsitektural";
  if (c.includes("Persiapan") || c.includes("Bongkaran")) {
    return "Pekerjaan Persiapan dan Bongkaran";
  }
  if (c.includes("Struktur")) {
    return "Pekerjaan Struktural";
  }
  if (c.includes("Atap") || c.includes("Genteng")) {
    return "Pekerjaan Atap";
  }
  if (
    c.includes("Mekanikal") ||
    c.includes("Elektrikal") ||
    c.includes("Plumbing") ||
    c.includes("MEP") ||
    c.includes("Mechanical")
  ) {
    return "Pekerjaan Mechanical, Elektrikal, dan Plumbing";
  }
  if (c.includes("Interior") || c.includes("Furniture")) {
    return "Pekerjaan Interior & Furniture";
  }
  if (
    c.includes("Arsitektur") ||
    c.includes("Dinding") ||
    c.includes("Plafon") ||
    c.includes("Partisi") ||
    c.includes("Lantai") ||
    c.includes("Keramik") ||
    c.includes("Pengecatan") ||
    c.includes("Vendor") ||
    c.includes("Pintu") ||
    c.includes("Jendela")
  ) {
    return "Pekerjaan Arsitektural";
  }
  return c;
}
