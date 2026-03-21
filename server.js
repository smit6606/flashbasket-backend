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
import { getDefaultCategoryImage } from "./src/utils/categoryUtils.js";
import { Category, Admin } from "./src/models/index.js";

dotenv.config();

const app = express();
const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      const isLocal = origin.startsWith('http://localhost:') || 
                      origin.startsWith('http://127.0.0.1:') ||
                      origin.startsWith('http://[::1]:');
      const customOrigins = frontendUrl === "*" ? ["*"] : frontendUrl.split(",").map(url => url.trim());
      if (isLocal || customOrigins.includes(origin) || customOrigins.includes("*")) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
  }
});

// Export io to be used in controllers
export { io };

const startServer = async () => {
  // 1. MUST handle Private Network Access (PNA) preflight BEFORE cors middleware
  app.use((req, res, next) => {
    if (req.headers['access-control-request-private-network']) {
      res.setHeader('Access-Control-Allow-Private-Network', 'true');
    }
    // Let the cors middleware handle the rest (including OPTIONS)
    next();
  });

  const origins = frontendUrl === "*" ? "*" : frontendUrl.split(",").map(url => url.trim());
  
  // Add common localhost variants for better development support
  if (Array.isArray(origins)) {
    const localhostVariants = [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://[::1]:3000',
      'http://localhost:3001',
      'http://127.0.0.1:3001',
    ];
    
    // If any localhost variant is already in origins, add the others
    const hasLocalhost = origins.some(o => localhostVariants.includes(o));
    if (hasLocalhost || frontendUrl === "http://localhost:3000") {
      localhostVariants.forEach(v => {
        if (!origins.includes(v)) origins.push(v);
      });
    }
  }

  app.use(cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl)
      if (!origin) return callback(null, true);
      
      const originsConfigs = frontendUrl === "*" ? ["*"] : frontendUrl.split(",").map(url => url.trim());
      
      const isAllowed = originsConfigs.includes(origin) || 
                        originsConfigs.includes("*") ||
                        origin.startsWith('http://localhost:') || 
                        origin.startsWith('http://127.0.0.1:') ||
                        origin.startsWith('http://[::1]:');
      
      if (isAllowed) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Access-Control-Allow-Private-Network"],
    credentials: true,
    maxAge: 86400
  }));

  await connectDB();
  await sequelize.sync({ alter: false });

  // 3. Robust column assurance
  try {
    const columnsToEnsure = [
      { name: 'totalAmount', type: 'DECIMAL(10, 2)', default: '0' },
      { name: 'discountAmount', type: 'DECIMAL(10, 2)', default: '0' },
      { name: 'couponId', type: 'INTEGER', after: 'discountAmount' },
      { name: 'deliveryFee', type: 'DECIMAL(10, 2)', default: '0' },
      { name: 'commissionAmount', type: 'DECIMAL(10, 2)', after: 'deliveryFee', default: '0' },
      { name: 'sellerId', type: 'INTEGER', after: 'deliveryFee' },
      { name: 'userId', type: 'INTEGER', after: 'deliveryFee' },
      { name: 'groupId', type: 'VARCHAR(255)', after: 'orderNumber' },
      { name: 'deliveryOtp', type: 'VARCHAR(255)', after: 'status' },
      { name: 'otpExpiry', type: 'DATETIME', after: 'status' },
      { name: 'otpVerified', type: 'TINYINT(1)', after: 'status', default: '0' },
      { name: 'deliveryProof', type: 'VARCHAR(255)', after: 'status' },
      { name: 'handlingFee', type: 'DECIMAL(10, 2)', after: 'commissionAmount', default: '0' },
      { name: 'city', type: 'VARCHAR(100)', after: 'deliveryAddress' },
      { name: 'acceptedAt', type: 'DATETIME', after: 'deliveryPartnerId' }
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

    // Standardize Profile Columns for all User types
    const profileCols = [
      { name: 'address', type: 'TEXT' },
      { name: 'city', type: 'VARCHAR(255)' },
      { name: 'state', type: 'VARCHAR(255)' },
      { name: 'country', type: 'VARCHAR(255)' },
      { name: 'pincode', type: 'VARCHAR(255)' },
      { name: 'profileImage', type: 'VARCHAR(255)' },
      { name: 'cloudinaryId', type: 'VARCHAR(255)' },
      { name: 'phone', type: 'VARCHAR(20)' },
    ];

    const tables = ['Users', 'Sellers', 'Admins', 'DeliveryPartners'];

    for (const table of tables) {
      for (const col of profileCols) {
        const [results] = await sequelize.query(`SHOW COLUMNS FROM ${table} LIKE '${col.name}'`);
        if (results.length === 0) {
          await sequelize.query(`ALTER TABLE ${table} ADD COLUMN ${col.name} ${col.type}`);
        } else if (col.name === 'address' && !results[0].Type.includes('text')) {
          // Force fix if address is JSON or other type
          await sequelize.query(`ALTER TABLE ${table} MODIFY COLUMN ${col.name} TEXT`);
        }
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

    // Role and Status standardizations for Admin Panel
    const statusConfigs = [
      { table: 'Users', enum: "'active', 'restricted', 'blocked'", default: "'active'" },
      { table: 'Sellers', enum: "'pending', 'active', 'suspended', 'rejected'", default: "'pending'" },
      { table: 'DeliveryPartners', enum: "'pending', 'active', 'suspended'", default: "'pending'" },
      { table: 'Categories', enum: "'active', 'inactive'", default: "'active'" },
      { table: 'Products', enum: "'active', 'inactive', 'out-of-stock', 'pending', 'rejected', 'hidden'", default: "'pending'" }
    ];

    for (const conf of statusConfigs) {
      try {
        const [res] = await sequelize.query(`SHOW COLUMNS FROM ${conf.table} LIKE 'status'`);
        if (res.length === 0) {
          await sequelize.query(`ALTER TABLE ${conf.table} ADD COLUMN status ENUM(${conf.enum}) DEFAULT ${conf.default}`);
        } else {
          // Update ENUM if it exists but might be missing values (especially for Products)
          await sequelize.query(`ALTER TABLE ${conf.table} MODIFY COLUMN status ENUM(${conf.enum}) DEFAULT ${conf.default}`);
        }
      } catch (err) {
        console.log(`Could not sync status for ${conf.table}:`, err.message);
      }
    }
    // Review Table sync - ensure sellerId exists
    const [revCol] = await sequelize.query("SHOW COLUMNS FROM Reviews LIKE 'sellerId'");
    if (revCol.length === 0) {
      await sequelize.query("ALTER TABLE Reviews ADD COLUMN sellerId INTEGER NULL AFTER productId");
    }

    // Ensure image column in Categories
    const [catImgCol] = await sequelize.query("SHOW COLUMNS FROM Categories LIKE 'image'");
    if (catImgCol.length === 0) {
      await sequelize.query("ALTER TABLE Categories ADD COLUMN image VARCHAR(255) NULL AFTER icon");
    }

    // Hydrate existing categories without image
    try {
      const emptyCats = await Category.findAll({ where: { image: null } });
      for (const cat of emptyCats) {
        cat.image = getDefaultCategoryImage(cat.name);
        await cat.save();
      }
    } catch (err) {
      console.error("Failed to hydrate category images:", err);
    }

    // NEW PRICING FIELDS - PRODUCTS
    const productCols = [
      { name: 'originalPrice', type: 'DECIMAL(10, 2)', default: '0' },
      { name: 'discountPercent', type: 'INTEGER', default: '0' },
      { name: 'discountAmount', type: 'DECIMAL(10, 2)', default: '0' },
      { name: 'finalPrice', type: 'DECIMAL(10, 2)', default: '0' }
    ];
    for (const col of productCols) {
      const [res] = await sequelize.query(`SHOW COLUMNS FROM Products LIKE '${col.name}'`);
      if (res.length === 0) {
        await sequelize.query(`ALTER TABLE Products ADD COLUMN ${col.name} ${col.type} DEFAULT ${col.default}`);
      }
    }
    // Initialize Product pricing from legacy field if empty
    await sequelize.query("UPDATE Products SET originalPrice = price, finalPrice = price, discountAmount = (originalPrice - finalPrice) WHERE originalPrice = 0 OR finalPrice = 0");

    // NEW PRICING FIELDS - CARTITEMS
    const cartItemCols = [
      { name: 'priceAtPurchase', type: 'DECIMAL(10, 2)', default: '0' },
      { name: 'discountPercent', type: 'INTEGER', default: '0' },
      { name: 'discountAmount', type: 'DECIMAL(10, 2)', default: '0' }
    ];
    for (const col of cartItemCols) {
      const [res] = await sequelize.query(`SHOW COLUMNS FROM CartItems LIKE '${col.name}'`);
      if (res.length === 0) {
        await sequelize.query(`ALTER TABLE CartItems ADD COLUMN ${col.name} ${col.type} DEFAULT ${col.default}`);
      }
    }
    
    // Ensure the old 'price' column in CartItems is nullable
    const [priceCol] = await sequelize.query("SHOW COLUMNS FROM CartItems LIKE 'price'");
    if (priceCol.length > 0 && priceCol[0].Null === 'NO') {
      await sequelize.query("ALTER TABLE CartItems MODIFY COLUMN price DECIMAL(10, 2) NULL");
    }
    // Initialize CartItem pricing from legacy field if empty
    await sequelize.query("UPDATE CartItems SET priceAtPurchase = price WHERE priceAtPurchase = 0 AND price IS NOT NULL");
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
