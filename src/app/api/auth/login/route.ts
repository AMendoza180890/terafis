import { NextResponse } from "next/server";

import { LoginSchema } from "@/lib/auth/schemas";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const formData = await request.formData();
  const parsed = LoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return NextResponse.redirect(new URL("/login?error=credenciales", request.url), {
      status: 303,
    });
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword(parsed.data);

    if (error) {
      return NextResponse.redirect(new URL("/login?error=auth", request.url), {
        status: 303,
      });
    }

    return NextResponse.redirect(new URL("/app", request.url), { status: 303 });
  } catch {
    return NextResponse.redirect(new URL("/login?error=config", request.url), {
      status: 303,
    });
  }
}
