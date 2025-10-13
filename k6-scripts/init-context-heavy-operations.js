import { open } from "k6";

// Lógica pesada no contexto init
const largeDataFile = open("./large-data.json");
const testData = JSON.parse(largeDataFile); // Processamento pesado executado para cada VU

export default function () {
  let user = testData;
}
