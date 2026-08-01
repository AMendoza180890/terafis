import { AppFooter } from "@/components/app/AppFooter";
import { TerafisLogo } from "@/components/brand/TerafisLogo";
import { ActionButton } from "@/components/ui/ActionButton";

export const metadata = {
  title: "Iniciar sesión",
};

export default function LoginPage() {
  return (
    <main className="flex flex-1 flex-col">
      <div className="flex flex-1 items-center justify-center px-6 py-16">
        <div className="border-brand/15 bg-surface w-full max-w-md rounded-xl border p-8 shadow-sm">
          <div className="flex justify-center">
            <TerafisLogo href="/" height={72} priority />
          </div>
          <h1 className="text-foreground mt-6 text-xl font-semibold">Iniciar sesión</h1>
          <p className="text-muted mt-2 text-sm">
            Auth de Supabase + MFA para admin y terapeuta se conectan en esta pantalla
            cuando configures las variables de entorno.
          </p>

          <form className="mt-8 space-y-4" action="/api/auth/login" method="post">
            <label className="block text-sm">
              <span className="text-muted mb-1 block">Correo</span>
              <input
                name="email"
                type="email"
                required
                autoComplete="username"
                className="border-brand/20 bg-background ring-brand w-full rounded-md border px-3 py-2 outline-none focus:ring-2"
              />
            </label>
            <label className="block text-sm">
              <span className="text-muted mb-1 block">Contraseña</span>
              <input
                name="password"
                type="password"
                required
                minLength={8}
                autoComplete="current-password"
                className="border-brand/20 bg-background ring-brand w-full rounded-md border px-3 py-2 outline-none focus:ring-2"
              />
            </label>
            <button
              type="submit"
              className="bg-brand w-full rounded-md px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90"
            >
              Entrar
            </button>
          </form>

          <div className="mt-6 flex justify-center">
            <ActionButton href="/" variant="ghost" inline>
              Volver al inicio
            </ActionButton>
          </div>
        </div>
      </div>

      <AppFooter />
    </main>
  );
}
