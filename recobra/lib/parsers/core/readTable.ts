import Papa from "papaparse";
import ExcelJS from "exceljs";

export type Cell = string | number | Date | null;
export type Sheet = { name: string; rows: Cell[][] };

function isXlsx(buf: Buffer): boolean {
  return buf.length > 4 && buf[0] === 0x50 && buf[1] === 0x4b; // "PK" zip signature
}

/** Read a CSV or XLSX buffer into raw rows. CSV delimiter and BOM are auto-detected. */
export async function readTable(buf: Buffer): Promise<Sheet[]> {
  if (isXlsx(buf)) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as unknown as ArrayBuffer);
    return wb.worksheets.map((ws) => {
      const rows: Cell[][] = [];
      ws.eachRow({ includeEmpty: false }, (row) => {
        const vals = (row.values as unknown[]).slice(1).map((v): Cell => {
          if (v == null) return null;
          if (v instanceof Date) return v;
          if (typeof v === "object") {
            const o = v as { result?: unknown; text?: unknown; richText?: { text: string }[] };
            if (o.result != null) return o.result as Cell;
            if (o.richText) return o.richText.map((r) => r.text).join("");
            if (o.text != null) return String(o.text);
            return null;
          }
          return v as Cell;
        });
        rows.push(vals);
      });
      return { name: ws.name, rows };
    });
  }
  let text = buf.toString("utf8");
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const res = Papa.parse<string[]>(text, { skipEmptyLines: "greedy", delimitersToGuess: [",", ";", "\t", "|"] });
  return [{ name: "csv", rows: res.data as Cell[][] }];
}
