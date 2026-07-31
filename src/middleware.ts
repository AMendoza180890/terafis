import { type NextRequest } from "next/server";

import { applySecurityHeaders } from "@/lib/security/headers";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  const response = await updateSession(request);
  return applySecurityHeaders(response);
}

export const config = {
  matcher: [
    /*
     * Excluir estáticos y assets de Next.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mp3)$).*)",
  ],
};
