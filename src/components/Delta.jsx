// Delta — ▲/▼ chip formatting a signed value, green for up / red for down.
export default function Delta({ value, decimals = 0, invert = false }) {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  const rounded = Number(value.toFixed(decimals));
  const isNegative = rounded < 0;
  const isGood = invert ? isNegative : !isNegative;
  const arrow = isNegative ? '▼' : '▲';
  const formatted = `${isNegative ? '' : '+'}${rounded}`;
  return (
    <span
      className={`inline-flex items-center gap-1 text-sm font-semibold tabular-nums ${
        isGood ? 'text-recoveryGreen' : 'text-recoveryRed'
      }`}
    >
      <span>{arrow}</span>
      <span>{formatted}</span>
    </span>
  );
}
