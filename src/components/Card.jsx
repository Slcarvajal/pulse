// Card — the base surface for every metric/section. SPEC §7.4: no gradients, no shadows.
import { COLORS } from '../theme.js';

export default function Card({ label, right, children, className = '', style, ...rest }) {
  return (
    <div
      className={`w-full ${className}`}
      style={{
        background: COLORS.surface,
        borderRadius: 20,
        padding: 16,
        border: `1px solid ${COLORS.hairline}`,
        ...style,
      }}
      {...rest}
    >
      {(label || right) && (
        <div className="w-full flex items-center justify-between mb-3">
          {label && <span className="lbl">{label}</span>}
          {right && <div>{right}</div>}
        </div>
      )}
      {children}
    </div>
  );
}
