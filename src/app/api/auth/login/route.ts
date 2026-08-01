import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

import { LoginSchema } from "@/lib/auth/schemas";
import { getPublicEnv } from "@/lib/env";

function redirectWithError(request: NextRequest, code: string) {
  return NextResponse.redirect(new URL(`/login?error=${code}`, request.url), {
    status: 303,
  });
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const parsed = LoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return redirectWithError(request, "credenciales");
  }

  const { supabaseUrl, supabaseAnonKey } = getPublicEnv();
  if (!supabaseUrl || !supabaseAnonKey) {
    return redirectWithError(request, "config");
  }

  // Crear la respuesta de éxito primero y escribir cookies ahí.
  // En App Router, cookies().set() no siempre viaja con NextResponse.redirect().
  const successRedirect = NextResponse.redirect(new URL("/app", request.url), {
    status: 303,
  });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          successRedirect.cookies.set(name, value, options);
        });
      },
    },
  });

  try {
    const { error } = await supabase.auth.signInWithPassword(parsed.data);

    if (error) {
      const msg = (error.message ?? "").toLowerCase();
      const status = error.status;

      if (
        status === 522 ||
        status === 502 ||
        status === 503 ||
        status === 504 ||
        msg.includes("fetch failed") ||
        msg.includes("network") ||
        msg.includes("timeout") ||
        msg.includes("<!doctype")
      ) {
        return redirectWithError(request, "servicio");
      }

      if (
        msg.includes("invalid login") ||
        msg.includes("invalid credentials") ||
        status === 400
      ) {
        return redirectWithError(request, "credenciales");
      }

      return redirectWithError(request, "auth");
    }

    return successRedirect;
  } catch (err) {
    const msg = err instanceof Error ? err.message.toLowerCase() : "";
    if (
      msg.includes("fetch failed") ||
      msg.includes("network") ||
      msg.includes("timeout") ||
      msg.includes("enotfound")
    ) {
      return redirectWithError(request, "servicio");
    }
    return redirectWithError(request, "config");
  }
}
