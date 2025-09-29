import http from "k6/http";
import { sleep, check } from "k6";

export let options = {
  // Scenario: Sustain a constant load (30 VUs) for a very long duration (e.g., 4 hours).
  stages: [
    { duration: "10m", target: 30 }, // Initial ramp up
    { duration: "4h", target: 30 }, // Long sustained load
    { duration: "10m", target: 0 }, // Ramp down
  ],
};

export default function () {
  let res = http.get("https://quickpizza.grafana.com");
  check(res, { "status is 200": (r) => r.status === 200 });
  sleep(1);
}