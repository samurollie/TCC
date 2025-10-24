import http from "k6/http";

export const options = {
  vus: 50,
  duration: "1m",
  // Nenhuma seção de "thresholds" definida.
};

export default function () {
  let res = http.get("https://test.k6.io");
  check(res, { "res is 200": res.status === 200 });
}
