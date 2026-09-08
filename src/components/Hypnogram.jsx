// Hypnogram — 4-lane sleep stage timeline. Plain SVG, no chart library. SPEC §7.8.
import { useEffect, useRef, useState } from 'react';
import { COLORS } from '../theme.js';

const LANES = ['AWAKE', 'REM', 'LIGHT', 'DEEP'];
const LANE_H = 18;
const LANE_GAP = 4;
const GUTTER = 44;
const BAR_H = 12;
const STAGE_COLOR = {
  DEEP: '#7BA1BB',
  REM: 'rgba(123,161,187,0.75)',
  LIGHT: 'rgba(123,161,187,0.45)',
  AWAKE: '#3A3F47',
};
const CHART_H = LANES.length * LANE_H + (LANES.length - 1) * LANE_GAP;

function fmtClock(iso) {
  if (!iso) return '';
  return new Date(iso)
    .toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    .toUpperCase();
}

export default function Hypnogram({ segments = [], start, end }) {
  const ref = useRef(null);
  const [w, setW] = useState(0);

  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([entry]) => setW(entry.contentRect.width));
    ro.observe(ref.current);
    setW(ref.current.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, []);

  const domainStart = start ? new Date(start).getTime() : null;
  const domainEnd = end ? new Date(end).getTime() : null;
  const span = domainStart != null && domainEnd != null ? domainEnd - domainStart : 0;

  return (
    <div>
      <div className="w-full flex">
        <div style={{ width: GUTTER, flexShrink: 0 }}>
          {LANES.map((lane, i) => (
            <div
              key={lane}
              className="lbl"
              style={{
                height: LANE_H,
                marginBottom: i < LANES.length - 1 ? LANE_GAP : 0,
                display: 'flex',
                alignItems: 'center',
              }}
            >
              {lane}
            </div>
          ))}
        </div>
        <div ref={ref} className="w-full">
          <svg width={w} height={CHART_H} viewBox={`0 0 ${w || 1} ${CHART_H}`} style={{ display: 'block' }}>
            {w > 0 &&
              span > 0 &&
              (() => {
                const rendered = segments
                  .map((seg) => {
                    const laneIdx = LANES.indexOf(seg.type);
                    if (laneIdx === -1) return null;
                    const segStart = new Date(seg.start).getTime();
                    const segEnd = new Date(seg.end).getTime();
                    const x0 = ((segStart - domainStart) / span) * w;
                    const x1 = Math.max(x0 + 1, ((segEnd - domainStart) / span) * w);
                    const y0 = laneIdx * (LANE_H + LANE_GAP) + (LANE_H - BAR_H) / 2;
                    const y1 = y0 + BAR_H;
                    return { laneIdx, x0, x1, y0, y1, type: seg.type };
                  })
                  .filter(Boolean);
                const connectors = [];
                for (let i = 1; i < rendered.length; i++) {
                  const prev = rendered[i - 1];
                  const curr = rendered[i];
                  if (curr.laneIdx === prev.laneIdx) continue;
                  const cx = prev.x1;
                  const cy1 = curr.laneIdx > prev.laneIdx ? prev.y1 : prev.y0;
                  const cy2 = curr.laneIdx > prev.laneIdx ? curr.y0 : curr.y1;
                  connectors.push({ x: cx, y1: cy1, y2: cy2 });
                }
                return (
                  <>
                    {rendered.map((r, i) => (
                      <rect
                        key={i}
                        x={r.x0}
                        y={r.y0}
                        width={r.x1 - r.x0}
                        height={BAR_H}
                        rx={1}
                        fill={STAGE_COLOR[r.type] || COLORS.dim}
                      />
                    ))}
                    {connectors.map((c, i) => (
                      <line
                        key={`c-${i}`}
                        x1={c.x}
                        x2={c.x}
                        y1={c.y1}
                        y2={c.y2}
                        stroke={COLORS.dim}
                        strokeWidth={1}
                        vectorEffect="non-scaling-stroke"
                      />
                    ))}
                  </>
                );
              })()}
          </svg>
        </div>
      </div>
      <div className="flex justify-between mt-2" style={{ marginLeft: GUTTER }}>
        <span className="lbl">{fmtClock(start)}</span>
        <span className="lbl">{fmtClock(end)}</span>
      </div>
    </div>
  );
}
