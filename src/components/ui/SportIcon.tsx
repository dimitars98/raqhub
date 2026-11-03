import type { Sport } from "@/types/database";

// Small drawings for each sport, used where the app once showed emojis:
// a tennis ball, a padel racket and a pickleball paddle with its ball. They
// use the sports' chart colours (tennis lime, padel blue, pickleball amber),
// so they look the same on every phone and computer, unlike emojis.

const HOLES_PADEL: [number, number][] = [
  [9.3, 5.6], [12, 4.7], [14.7, 5.6],
  [8.4, 8.5], [11, 7.8], [13.6, 7.8], [15.6, 8.5],
  [9.6, 11.2], [12.3, 10.8], [14.8, 11.4],
];
const HOLES_PICKLE: [number, number][] = [
  [17.2, 16.2], [19.9, 16.6], [18.2, 18.6], [16.4, 19.4], [19.8, 19.6],
];

/**
 * A sport's icon. `size` is in pixels; decorative by default (the sport's
 * name is next to it), give `title` when it stands alone.
 */
export default function SportIcon({
  sport,
  size = 16,
  className = "",
  title,
}: {
  sport: Sport | string;
  size?: number;
  className?: string;
  title?: string;
}) {
  const a11y = title ? { role: "img", "aria-label": title } : { "aria-hidden": true as const };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={`inline-block shrink-0 ${className}`} {...a11y}>
      {sport === "padel" ? (
        <g transform="rotate(-38 12 12)">
          <path
            d="M12 .6c4.8 0 7.6 3.4 7.6 7.9 0 4.1-2.5 7-5.6 8.1l-.6 1.5h-2.8l-.6-1.5C6.9 15.5 4.4 12.6 4.4 8.5 4.4 4 7.2.6 12 .6Z"
            fill="#378add"
          />
          <rect x="10.5" y="17.7" width="3" height="5.8" rx="1.4" fill="#111c0a" />
          <g fill="#ffffff" fillOpacity="0.9">
            {HOLES_PADEL.map(([cx, cy]) => (
              <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="0.9" />
            ))}
          </g>
        </g>
      ) : sport === "pickleball" ? (
        <>
          <g transform="rotate(-32 10 10)">
            <rect x="2.6" y="0.4" width="13.4" height="13.6" rx="5" fill="#f59e0b" />
            <rect x="8" y="13.4" width="2.6" height="7.2" rx="1.2" fill="#111c0a" />
          </g>
          <circle cx="18.2" cy="17.9" r="4.9" fill="#fde68a" stroke="#d99a06" strokeWidth="0.9" />
          <g fill="#d99a06">
            {HOLES_PICKLE.map(([cx, cy]) => (
              <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="0.85" />
            ))}
          </g>
        </>
      ) : (
        <>
          <circle cx="12" cy="12" r="10.5" fill="#a8d832" stroke="#7aad12" strokeWidth="1" />
          <path
            d="M4.9 4.4c3.6 3.8 3.6 11.4 0 15.2M19.1 4.4c-3.6 3.8-3.6 11.4 0 15.2"
            fill="none"
            stroke="#ffffff"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </>
      )}
      {title && <title>{title}</title>}
    </svg>
  );
}
