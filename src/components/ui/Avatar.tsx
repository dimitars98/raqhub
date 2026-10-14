import Image from "next/image";
import { avatarColor, initials } from "@/lib/avatar";

/**
 * A round profile photo, or the person's initials on a colour that stays the
 * same for them. `className` sets the size, e.g. "size-12 text-sm".
 */
export default function Avatar({
  id,
  name,
  src,
  className = "size-12 text-sm",
  px = 48,
}: {
  /** Picks the colour, so the same person always gets the same one. */
  id: string;
  name: string | null | undefined;
  src?: string | null;
  className?: string;
  /** Image size to load, in pixels. */
  px?: number;
}) {
  if (src) {
    return (
      <Image
        src={src}
        alt=""
        width={px}
        height={px}
        className={`shrink-0 rounded-full object-cover ${className}`}
      />
    );
  }
  return (
    <div
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-full font-semibold ${avatarColor(id)} ${className}`}
    >
      {initials(name)}
    </div>
  );
}
