import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { connectDB, sequelize } from "./src/config/db.js";
import "./src/models/index.js";
import mainRoutes from "./src/routes/index.js";
import errorMiddleware from "./src/middlewares/errorMiddleware.js";

dotenv.config();

const startServer = async () => {
  await connectDB();
  await sequelize.sync({ alter: true });
  
  // Ensure Spatial Indexes exist (Sequelize doesn't always create these via sync)
  try {
    await sequelize.query('ALTER TABLE Sellers ADD SPATIAL INDEX(location);');
    await sequelize.query('ALTER TABLE DeliveryPartners ADD SPATIAL INDEX(location);');
    console.log("📍 Spatial indexes verified.");
  } catch (err) {
    // Index likely already exists
  }

  console.log("✅ Models synchronized.");

  const app = express();
  
  // Middlewares
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Routes
  app.use("/api", mainRoutes);

  // Global Error Handler (Must be last)
  app.use(errorMiddleware);

  app.listen(process.env.PORT, () => {
    console.log(`Server is running on port ${process.env.PORT}`);
  });
};

startServer();
