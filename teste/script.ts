import http from "k6/http";
import { sleep, check } from "k6";
import { Counter } from "k6/metrics";
import { Options } from "k6/options";

// A simple counter for http requests

export const requests = new Counter("http_reqs");

// you can specify stages of your test (ramp up/down patterns) through the options object
// target is the number of VUs you are aiming for

export const options: Options = {
  maxRedirects: 0,
  scenarios: {
    default: {
      executor: "per-vu-iterations",
      vus: 1,
      iterations: 1,
    },
  },
  thresholds: {
    http_req_duration: [{ threshold: "p(95)<5000", abortOnFail: true }], //units in miliseconds 60000ms = 1m
    http_req_failed: [{ threshold: "rate<0.01", abortOnFail: true }], // http errors should be less than 1%
    checks: [{ threshold: "rate>0.95", abortOnFail: true }], // checks must success more than 99%
  },
};

export default function () {
  let res = http.get("https://quickpizza.grafana.com");
  sleep(1);

  const checkRes = check(res, {
    "status is 200": (r) => r.status === 200,
  });
}
