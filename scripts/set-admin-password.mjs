/**
 * Establece contraseña del admin Auth vía service role.
 * Uso: node scripts/set-admin-password.mjs "TuPasswordSegura8+"
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const password = process.argv[2];
if (!password || password.length < 8) {
  console.error('Uso: node scripts/set-admin-password.mjs "TuPasswordSegura8+"');
  process.exit(1);
}

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const userId = "72c19433-8fef-43dd-a9e8-f7f2a6ac3dbd";

const { data, error } = await sb.auth.admin.updateUserById(userId, {
  password,
  email_confirm: true,
});

if (error) {
  console.error("Error:", error.message);
  process.exit(1);
}

console.log("OK: contraseña actualizada para", data.user?.email);
console.log("Ya puedes iniciar sesión en /login con ese email y la nueva contraseña.");
