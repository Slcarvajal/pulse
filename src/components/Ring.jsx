// Ring — the 270° hero gauge. Plain SVG, animated by Framer Motion. No chart library, no gradient. SPEC §7.3.
import { useEffect, useState } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { COLORS, RING, MOTION } from '../theme.js';

function strokeFor(size) {
  if (size >= RING.hero.size) return RING.hero.stroke;
  if (size <= RING.dayStrip.size) return RING.dayStrip.stroke;
  return RING.small.stroke;
}

export default function Ring({ size = RING.hero.size, value = 0, max = 100, stroke, color = COLORS.text, label, sub, children }) {
  const strokeWidth = stroke ?? strokeFor(size);
  const r = (size - strokeWidth) / 2;
  const c = size / 2;
  const C = 2 * Math.PI * r;
  const pct = max ? Math.max(0, Math.min(1, value / max)) : 0;
  const showValue = size >= 80;
  const numClass = size >= RING.hero.size ? 'num-hero' : 'num-card';
  const tuckLabel = size >= 120;

  const [display, setDisplay] = useState(0);
  const progress = useMotionValue(0);
  const dashArray = useTransform(progress, (p) => `${p * RING.arcFraction * C} ${C}`);

  useEffect(() => {
    const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const controls = animate(progress, pct, {
      duration: reduced ? 0 : MOTION.ring.duration,
      ease: reduced ? 'linear' : MOTION.ring.ease,
      onUpdate: (p) => setDisplay(pct ? (p / pct) * value : 0),
    });
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pct, value]);

  return (
    <div className="inline-flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <g transform={`rotate(${RING.rotate} ${c} ${c})`}>
            <circle
              cx={c}
              cy={c}
              r={r}
              fill="none"
              stroke={COLORS.track}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={`${RING.arcFraction * C} ${C}`}
            />
            <motion.circle
              cx={c}
              cy={c}
              r={r}
              fill="none"
              stroke={color}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              style={{ strokeDasharray: dashArray }}
            />
          </g>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-2">
          {showValue && <span className={numClass}>{Math.round(display)}</span>}
          {children}
        </div>
        {tuckLabel && (sub || label) && (
          <div
            className="absolute flex flex-col items-center text-center pointer-events-none"
            style={{ left: '50%', bottom: size * 0.07, transform: 'translateX(-50%)', width: size * 0.32, lineHeight: 1.15 }}
          >
            {sub && <span className="lbl-lg" style={{ color }}>{sub}</span>}
            {label && <span className="lbl">{label}</span>}
          </div>
        )}
      </div>
      {!tuckLabel && label && <span className="lbl mt-2">{label}</span>}
    </div>
  );
}
