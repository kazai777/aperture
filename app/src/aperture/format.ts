export const fmt = (n: bigint) => n.toLocaleString("en-US");
export const short = (s: string, n = 8) =>
  s.length > 2 * n ? `${s.slice(0, n)}…${s.slice(-n)}` : s;
