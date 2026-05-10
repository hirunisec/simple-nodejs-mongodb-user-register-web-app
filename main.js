// imports
require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const session = require("express-session");
const client = require("prom-client");

const app = express();
const PORT = process.env.PORT || 5500;

// Prometheus monitoring setup
const register = new client.Registry();

client.collectDefaultMetrics({
  register
});

// db connection
const mongoUri = process.env.DB_URL || "mongodb://127.0.0.1:27017/user_register_db";

mongoose
  .connect(mongoUri)
  .then(() => {
    console.log("DB Connection established successfully");
  })
  .catch((error) => {
    console.error("DB Connection failed:", error.message);
  });

// middleware
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

app.use(
  session({
    secret: process.env.SESSION_SECRET || "my_secret_key",
    saveUninitialized: true,
    resave: false
  })
);

app.use(express.static("uploads"));

app.use((req, res, next) => {
  res.locals.message = req.session.message;
  delete req.session.message;
  next();
});

// set template engine
app.set("view engine", "ejs");

// health endpoint for Jenkins smoke testing and monitoring
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "UP",
    service: "User CRUD Web App",
    environment: process.env.NODE_ENV || "development",
    timestamp: new Date().toISOString()
  });
});

// metrics endpoint for Prometheus monitoring
app.get("/metrics", async (req, res) => {
  res.set("Content-Type", register.contentType);
  res.end(await register.metrics());
});

// route prefix
app.use("", require("./routes/routes"));

// start server only when this file is run directly
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server Started. Url: http://localhost:${PORT}`);
  });
}

// export app for Jest/Supertest automated testing
module.exports = app;