import http from "k6/http";
import { sleep, check } from "k6";

export let options = {
  maxRedirects: 0,
  scenarios: {
    default: {
      executor: "per-vu-iterations",
      vus: 1,
      iterations: 1,
    },
  },
  thresholds: {
    http_req_duration: [{ threshold: "p(95)<500", abortOnFail: true }],
    http_req_failed: [{ threshold: "rate<0.1", abortOnFail: true }],
    checks: [{ threshold: "rate>0.95", abortOnFail: true }],
  },
};

export default function () {
  let res = http.get("https://quickpizza.grafana.com");
  check(res, { "status is 200": (r) => r.status === 200 });
  sleep(1);
}
