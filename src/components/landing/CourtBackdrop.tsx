/**
 * The background of the sports section: an original drawing in RaqHub's
 * colours instead of a stock photo. A court seen from above in fine lime
 * lines, a ball flying across it, and two soft glows, on the dark forest
 * green. Pure SVG: sharp on any screen and only a few kilobytes.
 */
export default function CourtBackdrop() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 1600 1200"
      preserveAspectRatio="xMidYMid slice"
      className="absolute inset-0 h-full w-full"
    >
      <defs>
        <radialGradient id="cb-glow-lime" cx="18%" cy="22%" r="55%">
          <stop offset="0" stopColor="#a8d832" stopOpacity="0.22" />
          <stop offset="1" stopColor="#a8d832" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="cb-glow-blue" cx="88%" cy="85%" r="50%">
          <stop offset="0" stopColor="#378add" stopOpacity="0.16" />
          <stop offset="1" stopColor="#378add" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="cb-ball" cx="35%" cy="30%" r="70%">
          <stop offset="0" stopColor="#e4f7b8" />
          <stop offset="1" stopColor="#a8d832" />
        </radialGradient>
      </defs>

      <rect width="1600" height="1200" fill="#111c0a" />
      <rect width="1600" height="1200" fill="url(#cb-glow-lime)" />
      <rect width="1600" height="1200" fill="url(#cb-glow-blue)" />

      {/* The court, tilted, bigger than the section so it runs off the edges */}
      <g transform="translate(800 600) rotate(-14) translate(-620 -1000)" fill="none" stroke="#d6f09a" strokeLinecap="round">
        <g strokeOpacity="0.16" strokeWidth="3">
          {/* Outer lines and doubles alleys */}
          <rect x="0" y="0" width="1240" height="2000" rx="4" />
          <line x1="150" y1="0" x2="150" y2="2000" />
          <line x1="1090" y1="0" x2="1090" y2="2000" />
          {/* Service lines and the centre line between them */}
          <line x1="150" y1="540" x2="1090" y2="540" />
          <line x1="150" y1="1460" x2="1090" y2="1460" />
          <line x1="620" y1="540" x2="620" y2="1460" />
          {/* Centre marks on the baselines */}
          <line x1="620" y1="0" x2="620" y2="40" />
          <line x1="620" y1="1960" x2="620" y2="2000" />
        </g>
        {/* The net */}
        <line x1="-60" y1="1000" x2="1300" y2="1000" stroke="#ffffff" strokeOpacity="0.28" strokeWidth="6" />
        <g stroke="#ffffff" strokeOpacity="0.1" strokeWidth="2">
          {Array.from({ length: 34 }, (_, i) => (
            <line key={i} x1={-60 + i * 40} y1="988" x2={-60 + i * 40} y2="1012" />
          ))}
        </g>
      </g>

      {/* A ball flying across: dotted path, then the ball and its shadow */}
      <path
        d="M 110 1060 C 370 620, 820 340, 1255 355"
        fill="none"
        stroke="#a8d832"
        strokeOpacity="0.55"
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray="2 22"
      />
      <ellipse cx="1305" cy="455" rx="34" ry="9" fill="#000000" fillOpacity="0.35" />
      <g transform="translate(1290 362)">
        <circle r="30" fill="url(#cb-ball)" />
        <path d="M -21 -21 C -6 -8, -6 8, -21 21" fill="none" stroke="#ffffff" strokeOpacity="0.85" strokeWidth="3" />
        <path d="M 21 -21 C 6 -8, 6 8, 21 21" fill="none" stroke="#ffffff" strokeOpacity="0.85" strokeWidth="3" />
      </g>

      {/* A few quiet dots, like court lights far away */}
      <g fill="#d6f09a" fillOpacity="0.25">
        <circle cx="1420" cy="140" r="3" />
        <circle cx="1480" cy="210" r="2" />
        <circle cx="180" cy="1080" r="3" />
        <circle cx="260" cy="1130" r="2" />
      </g>
    </svg>
  );
}
