import Link from "next/link";

import { AppFooter } from "@/components/app/AppFooter";
import { TerafisLogo } from "@/components/brand/TerafisLogo";

export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-end px-4 py-6 sm:px-6">
        <Link
          href="/login"
          className="bg-brand inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          Iniciar sesión
        </Link>
      </header>

      <section className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-4 pb-16 sm:px-6">
        <TerafisLogo href="/" height={140} priority />
        <h1 className="text-foreground mt-10 max-w-2xl font-serif text-4xl leading-tight md:text-5xl">
          Tu bienestar, nuestra prioridad
        </h1>
        <p className="text-muted mt-4 max-w-xl text-lg">
          En TERAFIS, te ayudamos a vivir mejor. ¡Tu salud en buenas manos!
        </p>
        <div className="mt-8 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-3">
          <Link
            href="/login"
            className="bg-brand inline-flex w-full items-center justify-center rounded-md px-5 py-3 text-center text-sm font-semibold text-white hover:opacity-90 sm:w-auto"
          >
            Entrar al sistema
          </Link>
        </div>
      </section>

      <AppFooter />
    </main>
  );
}
