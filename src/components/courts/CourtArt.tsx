import type { Sport, Surface } from "@/types/database";
import { COURT_COLOR_HEX, courtColor } from "@/lib/courtColors";

/** A court seen from above, in its real colour (or its surface's usual one). */
export default function CourtArt({ court }: { court: { color?: string | null; surface: Surface; sport: Sport } }) {
  const c = COURT_COLOR_HEX[courtColor(court)];
  const sport = court.sport;
  // Padel and pickleball courts are shorter; the drawing follows.
  const w = sport === "tennis" ? 150 : 118;
  const x = (200 - w) / 2;
  return (
    <div
      className="h-full w-full"
      style={{
        backgroundColor: c.court,
        backgroundImage:
          "linear-gradient(135deg, rgba(255,255,255,0.18), rgba(0,0,0,0.14))",
      }}
    >
      <svg viewBox="0 0 200 96" aria-hidden="true" className="h-full w-full">
        <g stroke={c.lines} strokeWidth="1.6" fill="none" opacity="0.9">
          <rect x={x} y="14" width={w} height="68" />
          {sport === "tennis" && (
            <>
              <line x1={x} y1="23" x2={x + w} y2="23" />
              <line x1={x} y1="73" x2={x + w} y2="73" />
              <line x1={x + 38} y1="23" x2={x + 38} y2="73" />
              <line x1={x + w - 38} y1="23" x2={x + w - 38} y2="73" />
              <line x1={x + 38} y1="48" x2={x + w - 38} y2="48" />
            </>
          )}
          {sport === "padel" && (
            <>
              <line x1={x + 28} y1="14" x2={x + 28} y2="82" />
              <line x1={x + w - 28} y1="14" x2={x + w - 28} y2="82" />
              <line x1={x + 28} y1="48" x2={x + w - 28} y2="48" />
            </>
          )}
          {sport === "pickleball" && (
            <>
              <line x1={x + 44} y1="14" x2={x + 44} y2="82" />
              <line x1={x + w - 44} y1="14" x2={x + w - 44} y2="82" />
              <line x1={x} y1="48" x2={x + 44} y2="48" />
              <line x1={x + w - 44} y1="48" x2={x + w} y2="48" />
            </>
          )}
        </g>
        {/* The net */}
        <line
          x1="100"
          y1="10"
          x2="100"
          y2="86"
          stroke="#fff"
          strokeWidth="2.4"
        />
      </svg>
    </div>
  );
}
