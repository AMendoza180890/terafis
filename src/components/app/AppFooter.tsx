import {
  APP_NAME,
  APP_VERSION,
  copyrightYears,
  DEVELOPER,
} from "@/lib/app-version";

type AppFooterProps = {
  className?: string;
};

export function AppFooter({ className = "" }: AppFooterProps) {
  const years = copyrightYears();

  return (
    <footer
      className={[
        "border-brand/15 bg-surface/90 text-muted border-t px-4 py-3 text-center text-xs print:hidden",
        className,
      ].join(" ")}
    >
      <p className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
        <span>
          {APP_NAME} v{APP_VERSION}
        </span>
        <span aria-hidden>·</span>
        <span>© {years} {APP_NAME}. Todos los derechos reservados.</span>
        <span aria-hidden>·</span>
        <span>
          Desarrollo por{" "}
          <a
            href={DEVELOPER.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand font-medium underline-offset-2 hover:underline"
          >
            {DEVELOPER.name}
          </a>
        </span>
      </p>
    </footer>
  );
}
