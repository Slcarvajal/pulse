// DayStrip — 7-day recovery-band row atop Home. Last item is today. SPEC §7.5.
import Ring from './Ring.jsx';
import { COLORS, RING, band } from '../theme.js';

const INITIALS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export default function DayStrip({ days = [] }) {
  return (
    <div className="w-full flex items-center justify-between">
      {days.map((day, i) => {
        const isToday = i === days.length - 1;
        const hasData = day && day.recovery !== null && day.recovery !== undefined;
        const initial = day?.date ? INITIALS[new Date(`${day.date}T00:00:00`).getDay()] : INITIALS[i];
        const b = hasData ? band(day.recovery) : null;
        const ringColor = hasData ? b.color : COLORS.track;
        const initialColor = isToday && hasData ? b.color : COLORS.dim;

        return (
          <div key={day?.date ?? i} className="relative flex items-center justify-center" style={{ width: RING.dayStrip.size, height: RING.dayStrip.size }}>
            {isToday && hasData && (
              <div
                className="absolute rounded-full"
                style={{
                  width: RING.dayStrip.size,
                  height: RING.dayStrip.size,
                  background: b.color,
                  opacity: 0.18,
                }}
              />
            )}
            <Ring size={RING.dayStrip.size} stroke={RING.dayStrip.stroke} value={hasData ? day.recovery : 0} max={100} color={ringColor}>
              <span className="lbl" style={{ fontSize: 11, color: initialColor }}>{initial}</span>
            </Ring>
          </div>
        );
      })}
    </div>
  );
}
