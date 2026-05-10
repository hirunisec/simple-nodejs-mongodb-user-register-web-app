const request = require("supertest");
const app = require("../main");

describe("Basic Web Application Route Tests", () => {
  test("Home page should load successfully", async () => {
    const response = await request(app).get("/");

    expect([200, 302]).toContain(response.statusCode);
  });

  test("Invalid route should return not found or redirect", async () => {
    const response = await request(app).get("/invalid-route-for-testing");

    expect([404, 302]).toContain(response.statusCode);
  });
});