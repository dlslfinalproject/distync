const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const routes = require("./routes");

const app = express();

app.use(
  cors({
    exposedHeaders: ["Content-Disposition", "Content-Type"],
  }),
);
app.use(helmet());
app.use(morgan("dev"));
app.use(express.json({ limit: "5mb" }));

app.use("/api/v1", routes);

module.exports = app;
