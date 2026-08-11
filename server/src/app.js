const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const routes = require("./routes");

const app = express();

const normalizeOriginList = (value = "") =>
  String(value || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

const isDeploymentLikeEnvironment =
  process.env.NODE_ENV === "production" || process.env.SERVER_ACCESS_MODE === "DEMO";
const configuredCorsOrigins = normalizeOriginList(process.env.CORS_ALLOWED_ORIGINS);
const allowedCorsOrigins =
  configuredCorsOrigins.length > 0
    ? configuredCorsOrigins
    : ["http://localhost:5173", "http://127.0.0.1:5173"];

if (isDeploymentLikeEnvironment && configuredCorsOrigins.length === 0) {
  throw new Error(
    "CORS_ALLOWED_ORIGINS is required for deployed DISTYNC server environments.",
  );
}

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedCorsOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(null, false);
    },
    exposedHeaders: ["Content-Disposition", "Content-Type"],
  }),
);
app.use(helmet());
app.use(morgan("dev"));
app.use(express.json({ limit: "5mb" }));

app.use("/api/v1", routes);

module.exports = app;
