/**
 * Reexport público seguro para el cliente.
 * Para secretos use `@/lib/env/server` (solo servidor).
 */
export { getPublicEnv } from "@/lib/env/public";
export type { PublicEnv } from "@/lib/env/public";
