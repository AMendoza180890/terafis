import { describe, expect, it } from "vitest";

import {
  formatCedulaNiInput,
  isValidCedulaNi,
} from "@/lib/validation/cedula-ni";

describe("cédula Nicaragua", () => {
  it("aplica máscara mientras escribe", () => {
    expect(formatCedulaNiInput("001")).toBe("001");
    expect(formatCedulaNiInput("0011402")).toBe("001-1402");
    expect(formatCedulaNiInput("001140290")).toBe("001-140290");
    expect(formatCedulaNiInput("0011402900050")).toBe("001-140290-0050");
    expect(formatCedulaNiInput("0011402900050a")).toBe("001-140290-0050A");
    expect(formatCedulaNiInput("001-140290-0050a")).toBe("001-140290-0050A");
  });

  it("valida formato completo", () => {
    expect(isValidCedulaNi("001-140290-0050A")).toBe(true);
    expect(isValidCedulaNi("001-140290-0050a")).toBe(true); // se normaliza a mayúscula
    expect(isValidCedulaNi("0011402900050A")).toBe(false);
    expect(isValidCedulaNi("001-140290-0050")).toBe(false);
  });
});
