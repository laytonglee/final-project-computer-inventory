require("dotenv").config();
const app = require("./app");
const connectDB = require("./src/config/db");

const PORT = process.env.PORT || 3000;

const start = async () => {
  await connectDB();
  app.listen(PORT, () => {
    console.log(
      `[SERVER] Running on port ${PORT} in ${process.env.NODE_ENV || "development"} mode`,
    );
    console.log(
      `[SERVER] URL: ${process.env.APP_URL || `http://localhost:${PORT}`}`,
    );
  });
};

start();
