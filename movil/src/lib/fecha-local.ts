// ISO yyyy-mm-dd ↔ Date LOCAL, sin pasar por UTC: new Date("2026-07-28")
// interpreta medianoche UTC y en Argentina retrocede un día. El mediodía local
// como ancla esquiva cualquier borde de huso.

export function desdeISO(iso: string): Date {
  const [a, m, d] = iso.split("-").map(Number);
  return new Date(a, m - 1, d, 12, 0, 0);
}

export function aISO(fecha: Date): string {
  const m = String(fecha.getMonth() + 1).padStart(2, "0");
  const d = String(fecha.getDate()).padStart(2, "0");
  return `${fecha.getFullYear()}-${m}-${d}`;
}
