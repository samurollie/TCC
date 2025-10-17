import http from "k6/http";
import { check } from "k6";
import { Trend } from 'k6/metrics';

const myTrend = new Trend('my_trend');

export default function () {
  // Múltiplas requisições sem tags (Feature Envy) — atualizadas para quickpizza
  let r1 = http.get("https://quickpizza.grafana.com");
  check(r1, { "root ok 1": (r) => r.status === 200 });
  let r2 = http.get("https://quickpizza.grafana.com");
  check(r2, { "root ok 2": (r) => r.status === 200 });

  // Chamadas com tags duplicadas (má prática)
  let r3 = http.get("https://quickpizza.grafana.com", {
    tags: { name: "API" },
  });
  check(r3, { "root ok 3": (r) => r.status === 200 });
  let r4 = http.get("https://quickpizza.grafana.com", {
    tags: { name: "API" },
  });
  check(r4, { "root ok 4": (r) => r.status === 200 });

  // Uso correto (exemplo)
  let r5 = http.get("https://quickpizza.grafana.com", {
    tags: { my_tag: "HealthCheck" },
  });
  check(r5, { "root ok 5": (r) => r.status === 200 }, {my_tag: "HealthCheck"});
    // Add tag to custom metric
  myTrend.add(r5.timings.connecting, { my_tag: "HealthCheck" });
}
