import { describe, expect, it } from "vitest";

import {
  canExportPatientData,
  toCsv,
  toExcelXml,
  toSimplePdf,
} from "@/lib/reports/export";

describe("export PII (4.7)", () => {
  it("solo admin puede exportar listados con datos de pacientes", () => {
    expect(canExportPatientData("admin")).toBe(true);
    expect(canExportPatientData("recepcionista")).toBe(false);
    expect(canExportPatientData("terapeuta")).toBe(false);
  });
});

describe("CSV / Excel / PDF (4.8 contrato de formato)", () => {
  it("serializa filas escapando comillas", () => {
    const csv = toCsv(
      ["id", "nombre"],
      [
        ["1", 'García, "Ana"'],
        ["2", "Normal"],
      ],
    );
    expect(csv).toContain('"García, ""Ana"""');
    expect(csv.split("\n")[0]).toBe("id,nombre");
  });

  it("genera Excel XML con hoja y celdas", () => {
    const xls = toExcelXml("Datos", ["a", "b"], [["1", "2"]]);
    expect(xls).toContain("Excel.Sheet");
    expect(xls).toContain('ss:Name="Datos"');
    expect(xls).toContain('<Data ss:Type="Number">1</Data>');
  });

  it("genera PDF con cabecera %PDF", () => {
    const pdf = toSimplePdf("Titulo", ["linea 1"]);
    const head = new TextDecoder().decode(pdf.slice(0, 5));
    expect(head).toBe("%PDF-");
  });
});
