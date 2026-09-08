// HRTimeline — full-day heart-rate line with zone hairlines and a strain overlay. Plain SVG. SPEC §7.9.
import { useEffect, useMemo, useRef, useState } from 'react';
import { COLORS } from '../theme.js';

const HEIGHT = 120;
const DAY_MS = 24 * 60 * 60000;

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

function minutesAgo(iso) {
  if (!iso) return null;
  return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
}

export default function HRTimeline({ hrDay = [], hrZones = [], latestHr }) {
  const [ref, w] = useWidth();

  const points = useMemo(
    () => hrDay.filter((p) => p && p.avg != null).map((p) => ({ t: new Date(p.t).getTime(), avg: p.avg })),
    [hrDay]
  );

  const bucketMs = useMemo(() => {
    let min = Infinity;
    for (let i = 1; i < points.length; i++) {
      const d = points[i].t - points[i - 1].t;
      if (d > 0 && d < min) min = d;
    }
    return Number.isFinite(min) ? min : 5 * 60000;
  }, [points]);

  const dayStart = useMemo(() => {
    if (!points.length) return 0;
    const d = new Date(points[0].t);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }, [points]);

  const moderateMin = hrZones.find((z) => z.type === 'MODERATE')?.min ?? Infinity;

  const avgValues = points.map((p) => p.avg);
  const zoneMins = hrZones.map((z) => z.min);
  const zoneMaxes = hrZones.map((z) => z.max);
  const domainMin = Math.min(30, ...zoneMins, ...avgValues);
  const domainMax = Math.max(190, ...zoneMaxes, ...avgValues);
  const span = Math.max(1, domainMax - domainMin);

  const x = (t) => ((t - dayStart) / DAY_MS) * w;
  const y = (v) => HEIGHT - ((v - domainMin) / span) * HEIGHT;

  const runs = useMemo(() => {
    const out = [];
    let current = [];
    for (let i = 0; i < points.length; i++) {
      if (i > 0) {
        const gapBuckets = Math.round((points[i].t - points[i - 1].t) / bucketMs) - 1;
        if (gapBuckets > 2) {
          if (current.length) out.push(current);
          current = [];
        }
      }
      current.push(points[i]);
    }
    if (current.length) out.push(current);
    return out;
  }, [points, bucketMs]);

  const pathFor = (run) => run.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.t).toFixed(1)},${y(p.avg).toFixed(1)}`).join(' ');

  const strainRuns = useMemo(() => {
    const segs = [];
    runs.forEach((run) => {
      let seg = [];
      run.forEach((p, i) => {
        const hot = p.avg >= moderateMin;
        if (hot) {
          if (!seg.length && i > 0) seg.push(run[i - 1]);
          seg.push(p);
        } else if (seg.length) {
          segs.push(seg);
          seg = [];
        }
      });
      if (seg.length) segs.push(seg);
    });
    return segs;
  }, [runs, moderateMin]);

  const ago = latestHr ? minutesAgo(latestHr.at) : null;

  return (
    <div className="relative w-full">
      <style>{`
        @keyframes hrPulseDot { 0%, 100% { opacity: 1 } 50% { opacity: 0.35 } }
        .hr-pulse-dot { animation: hrPulseDot 2s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .hr-pulse-dot { animation: none; }
        }
      `}</style>
      {latestHr && (
        <div className="flex items-baseline gap-1 mb-2">
          <span className="num-2">{Math.round(latestHr.bpm)}</span>
          <span
            className="hr-pulse-dot inline-block rounded-full"
            style={{ width: 6, height: 6, background: COLORS.strain }}
          />
          <span className="lbl">BPM{ago != null ? ` · ${ago} MIN AGO` : ''}</span>
        </div>
      )}
      <div ref={ref} className="relative w-full" style={{ height: HEIGHT }}>
        <svg width={w} height={HEIGHT} viewBox={`0 0 ${w || 1} ${HEIGHT}`} style={{ display: 'block' }}>
          {w > 0 &&
            hrZones.map((z) => (
              <line
                key={z.type}
                x1={0}
                x2={w}
                y1={y(z.min)}
                y2={y(z.min)}
                stroke={COLORS.hairline}
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
              />
            ))}
          {w > 0 &&
            runs.map((run, i) => (
              <path
                key={`base-${i}`}
                d={pathFor(run)}
                fill="none"
                stroke={COLORS.muted}
                strokeWidth={1.5}
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            ))}
          {w > 0 &&
            strainRuns.map((seg, i) => (
              <path
                key={`strain-${i}`}
                d={pathFor(seg)}
                fill="none"
                stroke={COLORS.strain}
                strokeWidth={1.5}
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            ))}
        </svg>
        {hrZones.map((z) => (
          <span
            key={z.type}
            className="lbl absolute"
            style={{ right: 0, top: y(z.min), transform: 'translateY(-100%)' }}
          >
            {z.type}
          </span>
        ))}
      </div>
    </div>
  );
}
