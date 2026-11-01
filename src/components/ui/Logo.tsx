import Image from "next/image";

// RaqHub mark: the "RH" hexagon from public/raqhub.png.
// The browser tab icon is src/app/icon.png (same drawing).

export function LogoMark({ className = "size-7" }: { className?: string }) {
  return (
    <Image
      src="/raqhub.png"
      alt=""
      aria-hidden="true"
      width={64}
      height={64}
      className={`shrink-0 object-contain ${className}`}
    />
  );
}
