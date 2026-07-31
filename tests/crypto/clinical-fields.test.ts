import { afterEach, describe, expect, it } from "vitest";

import { generateFieldEncryptionKey } from "@/lib/crypto/aes-gcm";
import {
  encryptClinicalFields,
  decryptClinicalFields,
} from "@/lib/crypto/clinical-fields";

describe("campos clínicos cifrados", () => {
  const prev = process.env.FIELD_ENCRYPTION_KEY;

  afterEach(() => {
    if (prev === undefined) delete process.env.FIELD_ENCRYPTION_KEY;
    else process.env.FIELD_ENCRYPTION_KEY = prev;
  });

  it("cifra y descifra el bloque clínico", () => {
    process.env.FIELD_ENCRYPTION_KEY = generateFieldEncryptionKey();

    const plain = {
      historial_medico: "Asma infantil",
      alergias: "Penicilina",
      medicamentos: null,
      diagnosticos_previos: "",
      anamnesis: "Dolor lumbar 3 semanas",
      exploracion_fisica: null,
      diagnostico_fisioterapeutico: "Lumbalgia mecánica",
      objetivo_tratamiento: "Reducir EVA a <3",
    };

    const cipher = encryptClinicalFields(plain);
    expect(cipher.historial_medico).toMatch(/^v1:/);
    expect(cipher.alergias).not.toContain("Penicilina");
    expect(cipher.medicamentos).toBeNull();

    const back = decryptClinicalFields(cipher);
    expect(back.historial_medico).toBe("Asma infantil");
    expect(back.alergias).toBe("Penicilina");
    expect(back.diagnostico_fisioterapeutico).toBe("Lumbalgia mecánica");
  });
});
