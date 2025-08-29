import fs from "fs";

export function openFile(path: string): string {
  return fs.readFileSync(path, "utf8");
}

export function saveToFile(path: string, data: string) {
  fs.writeFileSync(path, data);
}
