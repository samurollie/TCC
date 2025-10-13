import { SharedArray } from "k6/data";
import { check } from "k6";
import http from "k6/http";

// ✅ Correct way - using SharedArray
const testData = new SharedArray("test-data", function () {
  const data = open("./large-data.json");
  return JSON.parse(data);
});

export const options = {
  vus: 10,
  duration: "30s",
};

export default function () {
  // Access shared data
  const user = testData[Math.floor(Math.random() * testData.length)];

  // Perform test
  const response = http.get("https://httpbin.org/get");

  check(response, {
    "status is 200": (r) => r.status === 200,
  });
}
