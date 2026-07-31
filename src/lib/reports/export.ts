import { RoleCapabilities, type StaffRole } from "@/lib/roles";

/** Solo admin puede exportar listados con PII (test 4.7). */
export function canExportPatientData(role: StaffRole): boolean {
  return RoleCapabilities[role].exportarReportes;
}

export type TabularRow = Array<string | number | null | undefined>;

export function toCsv(headers: string[], rows: TabularRow[]): string {
  const escape = (v: string | number | null | undefined) => {
    const s = v == null ? "" : String(v);
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [
    headers.map(escape).join(","),
    ...rows.map((r) => r.map(escape).join(",")),
  ];
  return `${lines.join("\n")}\n`;
}

function xmlEscape(v: string | number | null | undefined): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Excel XML SpreadsheetML (.xls) sin dependencias — abre en Excel/LibreOffice. */
export function toExcelXml(
  sheetName: string,
  headers: string[],
  rows: TabularRow[],
): string {
  const headerCells = headers
    .map((h) => `<Cell><Data ss:Type="String">${xmlEscape(h)}</Data></Cell>`)
    .join("");
  const body = rows
    .map((row) => {
      const cells = headers
        .map((_, i) => {
          const v = row[i];
          const isNum = typeof v === "number" || (typeof v === "string" && /^-?\d+(\.\d+)?$/.test(v));
          const type = isNum ? "Number" : "String";
          return `<Cell><Data ss:Type="${type}">${xmlEscape(v)}</Data></Cell>`;
        })
        .join("");
      return `<Row>${cells}</Row>`;
    })
    .join("");

  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Worksheet ss:Name="${xmlEscape(sheetName)}">
  <Table>
   <Row>${headerCells}</Row>
   ${body}
  </Table>
 </Worksheet>
</Workbook>
`;
}

/** PDF mínimo (texto) sin dependencias externas. */
export function toSimplePdf(title: string, lines: string[]): Uint8Array {
  const contentLines = [title, "", ...lines].map((l) =>
    l.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)"),
  );
  const ops: string[] = ["BT", "/F1 12 Tf", "50 800 Td"];
  for (const line of contentLines) {
    ops.push(`(${line}) Tj`);
    ops.push("0 -16 Td");
  }
  ops.push("ET");
  const stream = ops.join("\n");

  const objects: string[] = [];
  objects.push("1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj\n");
  objects.push("2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj\n");
  objects.push(
    "3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>endobj\n",
  );
  objects.push(
    `4 0 obj<< /Length ${stream.length} >>stream\n${stream}\nendstream\nendobj\n`,
  );
  objects.push(
    "5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj\n",
  );

  const enc = new TextEncoder();
  const byteLen = (s: string) => enc.encode(s).length;
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (const obj of objects) {
    offsets.push(byteLen(pdf));
    pdf += obj;
  }
  const xrefPos = byteLen(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let i = 1; i <= objects.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
  pdf += `startxref\n${xrefPos}\n%%EOF\n`;

  return enc.encode(pdf);
}
