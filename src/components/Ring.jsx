// Ring — plain SVG circle progress ring animated by Framer Motion, no chart library.
import { useEffect, useState } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { COLORS } from '../theme.js';

export default function Ring({ size = 220, value = 0, max = 100, color = COLORS.strainBlue, label, children }) {
  const strokeWidth = Math.max(8, size * 0.07);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = max ? Math.max(0, Math.min(1, value / max)) : 0;

  const [display, setDisplay] = useState(0);
  const progress = useMotionValue(0);
  const dashoffset = useTransform(progress, (p) => circumference * (1 - p));

  useEffect(() => {
    const controls = animate(progress, pct, {
      duration: 0.9,
      ease: 'easeOut',
      onUpdate: (p) => setDisplay(p * value),
    });
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pct, value]);

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={COLORS.surface} strokeWidth={strokeWidth} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          style={{ strokeDashoffset: dashoffset }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-2">
        <span className="tabular-nums font-bold text-text leading-none" style={{ fontSize: size * 0.26 }}>
          {Math.round(display)}
        </span>
        {label && <span className="text-label uppercase text-muted mt-1">{label}</span>}
        {children}
      </div>
    </div>
  );
}
