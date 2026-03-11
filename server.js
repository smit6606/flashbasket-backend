import express from "express";
import cors from "cors";
import Stripe from "stripe";
import dotenv from "dotenv";
import { createServer } from "http";
import { Server } from "socket.io";
import { connectDB, sequelize } from "./src/config/db.js";
import { Order } from "./src/models/index.js";
import mainRoutes from "./src/routes/index.js";
import errorMiddleware from "./src/middlewares/errorMiddleware.js";

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Export io to be used in controllers
export { io };

const startServer = async () => {
  await connectDB();
  await sequelize.sync({ alter: false });

  // 3. Robust column assurance
  try {
    const columnsToEnsure = [
      { name: 'sellerId', type: 'INTEGER', after: 'deliveryFee' },
      { name: 'userId', type: 'INTEGER', after: 'deliveryFee' },
      { name: 'groupId', type: 'VARCHAR(255)', after: 'orderNumber' },
      { name: 'deliveryOtp', type: 'VARCHAR(255)', after: 'status' },
      { name: 'otpExpiry', type: 'DATETIME', after: 'status' },
      { name: 'otpVerified', type: 'TINYINT(1)', after: 'status', default: '0' },
      { name: 'deliveryProof', type: 'VARCHAR(255)', after: 'status' }
    ];

    for (const col of columnsToEnsure) {
      const [results] = await sequelize.query(`SHOW COLUMNS FROM Orders LIKE '${col.name}'`);
      if (results.length === 0) {
        let query = `ALTER TABLE Orders ADD COLUMN ${col.name} ${col.type}`;
        if (col.default !== undefined) query += ` DEFAULT ${col.default}`;
        if (col.after) query += ` AFTER ${col.after}`;
        await sequelize.query(query);
      }
    }

    const [statusCol] = await sequelize.query("SHOW COLUMNS FROM Orders LIKE 'status'");
    if (statusCol.length > 0 && !statusCol[0].Type.includes('arrived')) {
      await sequelize.query(`
        ALTER TABLE Orders MODIFY COLUMN status ENUM(
          'pending', 'preparing', 'awaiting-assignment', 'assigned', 
          'accepted-by-partner', 'ready-to-ship', 'shipped', 
          'out-for-delivery', 'arrived', 'delivered', 'completed', 'cancelled'
        ) DEFAULT 'pending'
      `);
    }

    const [pmCol] = await sequelize.query("SHOW COLUMNS FROM Orders LIKE 'paymentMethod'");
    if (pmCol.length > 0 && !pmCol[0].Type.includes('upi')) {
      await sequelize.query(`
        ALTER TABLE Orders MODIFY COLUMN paymentMethod ENUM('stripe', 'cod', 'upi') DEFAULT 'cod'
      `);
    }
  } catch (err) {
    console.error("Column check error:", err);
  }

  // Spatial Indexes
  try {
    const [rows] = await sequelize.query("SHOW INDEX FROM Sellers WHERE Key_name = 'Sellers_location_spatial'");
    if (rows.length === 0) {
      await sequelize.query('ALTER TABLE Sellers ADD SPATIAL INDEX Sellers_location_spatial (location);');
    }
  } catch (err) {}

  app.use(cors());

  // Webhook for Stripe - must use raw body
  app.post('/api/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const sig = req.headers['stripe-signature'];
    try {
      const event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
      if (event.type === 'payment_intent.succeeded') {
        const intent = event.data.object;
        const groupId = intent.metadata.groupId;
        if (groupId) {
           await Order.update(
             { paymentStatus: 'paid', status: 'preparing' }, 
             { where: { groupId, status: 'pending' } }
           );
           io.emit('payment_update', { groupId, status: 'paid' });
        }
      }
      res.json({ received: true });
    } catch (err) {
      console.error('Webhook signature verification failed:', err.message);
      res.status(400).send(`Webhook Error: ${err.message}`);
    }
  });

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.use("/api", mainRoutes);
  app.use(errorMiddleware);

  io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);
    socket.on("disconnect", () => console.log("Client disconnected"));
  });

  const PORT = process.env.PORT || 5000;
  httpServer.listen(PORT, () => {
    console.log(`✅ Server is running on port ${PORT}`);
  });
};

startServer();
