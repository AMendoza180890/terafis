import Image from "next/image";
import Link from "next/link";

import { BRAND_LOGO_ASPECT, BRAND_LOGO_SRC } from "@/lib/brand";

type TerafisLogoProps = {
  href?: string;
  /** Altura visual del logo en px */
  height?: number;
  priority?: boolean;
  className?: string;
};

export function TerafisLogo({
  href,
  height = 40,
  priority = false,
  className = "",
}: TerafisLogoProps) {
  const width = Math.round(height * BRAND_LOGO_ASPECT);

  const image = (
    <Image
      src={BRAND_LOGO_SRC}
      alt="Terafis — Centro de Fisioterapia"
      width={width}
      height={height}
      priority={priority}
      unoptimized
      className={className}
      style={{ width: "auto", height: `${height}px` }}
    />
  );

  if (!href) return image;

  return (
    <Link href={href} className="inline-flex items-center" aria-label="Terafis">
      {image}
    </Link>
  );
}
