import { saveToFile } from "./file.js";
import { Smell } from "./types.js";

/* export function generateSmellsCSV(smells: Smell[], folder: string): void {
  if (!folder) return;

  const csvHeader = "Type,Message,Line,Column,Value,Context\n";
  const csvRows = smells
    .map(
      (smell) =>
        `"${smell.type}","${smell.message}","${smell.line}","${
          smell.column
        }","${smell.value || ""}","${smell.context || ""}"`
    )
    .join("\n");

  const csvContent = csvHeader + csvRows;
  saveToFile(folder + "smells.csv", csvContent);
}
 */