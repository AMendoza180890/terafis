import { z } from "zod";

import { MENU_KEYS } from "@/lib/permissions/menu-catalog";
import { StaffRoleSchema } from "@/lib/roles";

export const SaveRoleMenuPermissionsSchema = z.object({
  rol: StaffRoleSchema,
  allowedKeys: z.array(z.enum(MENU_KEYS)),
});

export type SaveRoleMenuPermissionsInput = z.infer<
  typeof SaveRoleMenuPermissionsSchema
>;

export const SaveStaffMenuOverridesSchema = z.object({
  staffId: z.string().uuid(),
  /** Por cada key: true = forzar sí, false = forzar no. Keys omitidas = heredar rol. */
  overrides: z.record(z.enum(MENU_KEYS), z.boolean()),
});

export type SaveStaffMenuOverridesInput = z.infer<
  typeof SaveStaffMenuOverridesSchema
>;
