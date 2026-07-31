import Image from "next/image";
import Link from "next/link";

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
  // Proporción del logo (1123×794 ≈ 1.414:1)
  const width = Math.round(height * 1.414);

  const image = (
    <Image
      src="/brand/terafis-logo.png"
      alt="Terafis — Centro de Fisioterapia"
      width={width}
      height={height}
      priority={priority}
      className={`h-auto w-auto ${className}`}
      style={{ height, width: "auto" }}
    />
  );

  if (!href) return image;

  return (
    <Link href={href} className="inline-flex items-center" aria-label="Terafis">
      {image}
    </Link>
  );
}
