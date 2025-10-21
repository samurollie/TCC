import http from "k6/http";
import { sleep, check } from "k6";

export let options = {
  // Scenario: Ramp up to 50 VUs over 1 minute, stay for 5 minutes.
  stages: [
    { duration: "1m", target: 50 }, // Ramp up to 50 users
    { duration: "5m", target: 50 }, // Stay at 50 users (expected load)
    { duration: "1m", target: 0 }, // Ramp down to 0
  ],
};

export default function () {
  let res = http.get("https://quickpizza.grafana.com");
  check(res, { "status is 200": (r) => r.status === 200 });
  sleep(1);
}
