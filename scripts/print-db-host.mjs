import fs from "fs";
import path from "path";

const text = fs.readFileSync(path.join(process.cwd(), ".env.local"), "utf8");
for (const line of text.split(/\r?\n/)) {
  if (!line.startsWith("DATABASE_URL=")) continue;
  let val = line.slice("DATABASE_URL=".length).trim();
  if (
    (val.startsWith('"') && val.endsWith('"')) ||
    (val.startsWith("'") && val.endsWith("'"))
  ) {
    val = val.slice(1, -1);
  }
  try {
    const u = new URL(val);
    console.log(
      JSON.stringify({
        protocol: u.protocol,
        hostname: u.hostname,
        port: u.port,
        pathname: u.pathname,
        user: u.username,
      }),
    );
  } catch (e) {
    console.log("parse_error", String(e));
  }
}
if (text.includes("NEXT_PUBLIC_SUPABASE_URL=")) {
  const m = text.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
  console.log("supabase_url", (m?.[1] || "").trim());
}
