// Skeleton — card-shaped loading placeholders, no gradient shimmer (SPEC §7.11).
import { COLORS } from '../theme.js';

function Block({ style }) {
  return (
    <div
      style={{
        background: COLORS.surface2,
        borderRadius: 20,
        animation: 'pulse 1.4s ease-in-out infinite',
        ...style,
      }}
    />
  );
}

export default function Skeleton() {
  return (
    <div
      className="px-4 pb-24 flex flex-col items-center gap-8 min-h-screen"
      style={{ paddingTop: 'calc(env(safe-area-inset-top) + 24px)' }}
    >
      <div className="w-full flex items-center justify-between">
        <Block style={{ width: 64, height: 12 }} />
        <Block style={{ width: 20, height: 20, borderRadius: 999 }} />
      </div>
      <Block style={{ width: 220, height: 220, borderRadius: 999 }} />
      <div className="flex gap-3">
        <Block style={{ width: 104, height: 104, borderRadius: 999 }} />
        <Block style={{ width: 104, height: 104, borderRadius: 999 }} />
      </div>
      <div className="grid grid-cols-2 gap-3 w-full">
        {[0, 1, 2, 3].map((i) => (
          <Block key={i} style={{ height: 80 }} />
        ))}
      </div>
    </div>
  );
}
