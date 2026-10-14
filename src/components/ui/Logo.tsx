// Temporary ServeTime mark: a lime tennis ball with dark seams.
// The same drawing is used for the browser tab icon in src/app/icon.svg.

export function LogoMark({ className = "size-7" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={`shrink-0 ${className}`}
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="16" cy="16" r="14.5" fill="#a8d832" stroke="#111c0a" strokeWidth="2" />
      <path
        d="M6.2 5.6C11.6 10.6 11.6 21.4 6.2 26.4M25.8 5.6C20.4 10.6 20.4 21.4 25.8 26.4"
        fill="none"
        stroke="#111c0a"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
