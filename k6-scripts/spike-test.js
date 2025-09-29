import http from "k6/http";
import { sleep, check } from "k6";

export let options = {
  // Scenario: Quick jump from low to very high load, then back down.
  stages: [
    { duration: "1m", target: 50 }, // Baseline load
    { duration: "30s", target: 1000 }, // Immediate, massive spike
    { duration: "1m", target: 50 }, // Quick drop back to baseline
    { duration: "30s", target: 0 }, // Final ramp down
  ],
};

export default function () {
  let res = http.get("https://quickpizza.grafana.com");
  check(res, { "status is 200": (r) => r.status === 200 });
  sleep(1);
}