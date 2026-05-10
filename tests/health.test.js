const request = require("supertest");
const app = require("../main");

describe("Health and Monitoring Endpoints", () => {
  test("GET /health should return application health status", async () => {
    const response = await request(app).get("/health");

    expect(response.statusCode).toBe(200);
    expect(response.body.status).toBe("UP");
    expect(response.body.service).toBe("User CRUD Web App");
  });

  test("GET /metrics should return Prometheus metrics", async () => {
    const response = await request(app).get("/metrics");

    expect(response.statusCode).toBe(200);
    expect(response.text).toContain("process_cpu_user_seconds_total");
  });
});