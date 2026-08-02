/**
 * Establece contraseña de un usuario staff vía service role.
 * Uso: node scripts/set-admin-password.mjs --email=usuario@clinica.com "TuPasswordSegura8+"
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

function parseArgs(argv) {
  const emailArg = argv.find((a) => a.startsWith("--email="));
  const email = emailArg ? emailArg.slice("--email=".length).trim().toLowerCase() : null;
  const password = argv.find((a) => !a.startsWith("--"));
  return { email, password };
}

const { email, password } = parseArgs(process.argv.slice(2));

if (!email || !password || password.length < 8) {
  console.error(
    'Uso: node scripts/set-admin-password.mjs --email=usuario@clinica.com "TuPasswordSegura8+"',
  );
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

const { data: staffRow, error: staffError } = await sb
  .from("staff")
  .select("id, auth_user_id, email")
  .ilike("email", email)
  .is("deleted_at", null)
  .maybeSingle();

if (staffError) {
  console.error("Error buscando staff:", staffError.message);
  process.exit(1);
}
if (!staffRow) {
  console.error("No se encontró staff activo con el correo:", email);
  process.exit(1);
}

const { data, error } = await sb.auth.admin.updateUserById(staffRow.auth_user_id, {
  password,
  email_confirm: true,
});

if (error) {
  console.error("Error:", error.message);
  process.exit(1);
}

console.log("OK: contraseña actualizada para", data.user?.email ?? staffRow.email);
console.log("Ya puedes iniciar sesión en /login con ese email y la nueva contraseña.");
