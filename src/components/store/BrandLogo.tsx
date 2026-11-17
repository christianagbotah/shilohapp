import Image from "next/image";
import { cn } from "@/lib/utils";

export const WCI_LOGO_SRC = "/images/wci-logo.png";
export const SHILOH_FLYER_SRC = "/images/shiloh-flyer.jpg";

/**
 * Official Winners Chapel International logo mark (red flame over shield & globe).
 * The emblem sits on a black tile — matching the original artwork — framed with a
 * subtle gold ring so it stays crisp on the site's dark surfaces.
 */
export function BrandLogo({
  size = 40,
  className,
  priority = false,
}: {
  size?: number;
  className?: string;
  priority?: boolean;
}) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-black ring-1 ring-gold/40 shadow-[0_6px_20px_-8px_rgba(0,0,0,0.9)]",
        className
      )}
      style={{ height: size, width: size }}
    >
      <Image
        src={WCI_LOGO_SRC}
        alt="Winners Chapel International logo"
        width={size}
        height={size}
        priority={priority}
        className="h-full w-full object-cover"
      />
    </span>
  );
}
