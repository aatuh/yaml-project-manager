export type JEVM = {
  joy: number;
  energy: number;
  value: number;
  market: number;
};

export function summarizeJEVM(p?: JEVM) {
  if (!p) return { sum: 0, avg: 0 };
  const sum = p.joy + p.energy + p.value + p.market;
  return { sum, avg: Math.round((sum / 4) * 10) / 10 };
}
