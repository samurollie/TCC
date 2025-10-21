import http from "k6/http";
import { sleep, check } from "k6";

export let options = {
  // Scenario: Gradually increase load until system failure is observed.
  stages: [
    { duration: "2m", target: 100 }, // Initial moderate load
    { duration: "5m", target: 500 }, // Aggressively ramp up to extreme load
    { duration: "2m", target: 700 }, // Push beyond estimated capacity
    { duration: "1m", target: 0 }, // Cool down
  ],
};

export default function () {
  let res = http.get("https://quickpizza.grafana.com");
  check(res, { "status is 200": (r) => r.status === 200 });
  sleep(1);
}
