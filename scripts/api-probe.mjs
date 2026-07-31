import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
const sb = createClient(url, key, { auth: { persistSession: false } });

const tables = [
  "clinics",
  "staff",
  "products",
  "inventory_movements",
  "payments",
  "appointments",
];

for (const t of tables) {
  const { error, count } = await sb.from(t).select("*", { count: "exact", head: true });
  if (error) console.log(t, "→", error.message);
  else console.log(t, "→ OK count=", count);
}

const { data: staff } = await sb
  .from("staff")
  .select("id, email, rol, auth_user_id, activo")
  .eq("auth_user_id", "72c19433-8fef-43dd-a9e8-f7f2a6ac3dbd");
console.log("staff bootstrap:", staff);
