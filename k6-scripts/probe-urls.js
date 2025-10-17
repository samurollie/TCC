import http from "k6/http";
import { check } from "k6";

export default function () {
  const urls = [
    "https://quickpizza.grafana.com",
    "https://quickpizza.grafana.com/login",
    "https://quickpizza.grafana.com/products",
    "https://quickpizza.grafana.com/cart",
    "https://quickpizza.grafana.com/checkout",
    "https://quickpizza.grafana.com/health",
    "https://quickpizza.grafana.com/ru",
    "https://quickpizza.grafana.com/de",
    "https://quickpizza.grafana.com/page",
    "https://quickpizza.grafana.com/ru/page",
    "https://quickpizza.grafana.com/de/page",
  ];

  for (const u of urls) {
    const r = http.get(u);
    check(r, { [`${u} is 200`]: (res) => res.status === 200 });
  }
}
