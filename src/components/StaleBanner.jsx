// StaleBanner — full-width cached-data notice (SPEC §7.11).
import { COLORS } from '../theme.js';

export default function StaleBanner() {
  return (
    <div
      className="w-full flex items-center justify-center"
      style={{ height: 28, background: 'rgba(245,166,35,0.10)', borderBottom: `1px solid ${COLORS.hairline}` }}
    >
      <span className="lbl" style={{ color: COLORS.temp }}>SHOWING CACHED DATA</span>
    </div>
  );
}
