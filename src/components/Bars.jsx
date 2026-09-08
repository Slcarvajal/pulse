// Bars — vertical bar chart, 0-based fixed-max domain, mean baseline + AVG label, x-axis label row. Plain SVG. SPEC §7.14 Trends.
import { useEffect, useRef, useState } from 'react';
import { COLORS } from '../theme.js';

function useWidth() {
  const ref = useRef(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([entry]) => setW(entry.contentRect.width));
    ro.observe(ref.current);
    setW(ref.current.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

export default function Bars({
  data = [],
  colorFor,
  mean,
  height = 96,
  max,
  fmt = (v) => Math.round(v * 10) / 10,
  xLabels,
}) {
  const [ref, w] = useWidth();
  const values = data.map((d) => (typeof d === 'number' ? d : d.value));
  const dataMax = values.length ? Math.max(...values) : 0;
  const domainMax = max ?? Math.max(dataMax, mean || 0, 1);
  const n = data.length || 1;
  const slot = w / n;
  const barW = data.length ? Math.max(2, slot * 0.55) : 0;
  const baselineY = mean != null ? height - (mean / domainMax) * height : null;

  return (
    <div>
      <div ref={ref} className="w-full" style={{ position: 'relative' }}>
        <svg width={w} height={height} viewBox={`0 0 ${w || 1} ${height}`} style={{ display: 'block' }}>
          {baselineY != null && w > 0 && (
            <line
              x1={0}
              x2={w}
              y1={baselineY}
              y2={baselineY}
              stroke={COLORS.dim}
              strokeWidth={1}
              strokeDasharray="3,3"
              vectorEffect="non-scaling-stroke"
            />
          )}
          {w > 0 &&
            data.map((d, i) => {
              const v = typeof d === 'number' ? d : d.value;
              const barH = domainMax ? (v / domainMax) * height : 0;
              const x = i * slot + (slot - barW) / 2;
              const color = colorFor ? colorFor(v, i, d) : COLORS.strain;
              const opacity = i === data.length - 1 ? 1 : 0.7;
              return (
                <rect
                  key={i}
                  x={x}
                  y={height - barH}
                  width={barW}
                  height={Math.max(0, barH)}
                  rx={2}
                  fill={color}
                  fillOpacity={opacity}
                />
              );
            })}
        </svg>
        {baselineY != null && w > 0 && (
          <span
            className="lbl"
            style={{ position: 'absolute', right: 0, top: baselineY, transform: 'translateY(-100%)' }}
          >
            AVG {fmt(mean)}
          </span>
        )}
      </div>
      {Array.isArray(xLabels) && xLabels.length > 0 && w > 0 && (
        <div className="flex mt-1" style={{ width: w }}>
          {xLabels.map((lab, i) => (
            <span key={i} className="lbl" style={{ flex: 1, textAlign: 'center' }}>
              {lab}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
