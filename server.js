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
    origin: frontendUrl === "*" ? "*" : frontendUrl.split(","),
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
      { table: 'Users', enum: "'Active', 'Restricted', 'Blocked'", default: "'Active'" },
      { table: 'Sellers', enum: "'Pending', 'Active', 'Suspended', 'Rejected'", default: "'Pending'" },
      { table: 'DeliveryPartners', enum: "'Pending', 'Active', 'Suspended'", default: "'Pending'" },
      { table: 'Categories', enum: "'Active', 'Inactive'", default: "'Active'" },
      { table: 'Products', enum: "'Active', 'Inactive', 'Out-of-Stock', 'Pending', 'Rejected', 'Hidden'", default: "'Pending'" }
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

    // Add visibility columns to Products table
    const productVisibilityCols = [
      { name: 'isApproved', type: 'TINYINT(1)', default: '0' },
      { name: 'isActive', type: 'TINYINT(1)', default: '1' }
    ];
    for (const col of productVisibilityCols) {
      const [res] = await sequelize.query(`SHOW COLUMNS FROM Products LIKE '${col.name}'`);
      if (res.length === 0) {
        await sequelize.query(`ALTER TABLE Products ADD COLUMN ${col.name} ${col.type} DEFAULT ${col.default}`);
      }
    }

    // Hydrate existing products' visibility
    await sequelize.query("UPDATE Products SET isApproved = 1 WHERE status IN ('Active', 'active')");
    await sequelize.query("UPDATE Products SET isActive = 1 WHERE isActive IS NULL");

    // Standardize all statuses in the DB to Capitalized for consistency with model definitions
    const TablesToUpdate = [
      { name: 'Users', default: 'Active' },
      { name: 'Sellers', default: 'Pending' },
      { name: 'DeliveryPartners', default: 'Pending' },
      { name: 'Categories', default: 'Active' },
      { name: 'Products', default: 'Pending' }
    ];

    for (const table of TablesToUpdate) {
        await sequelize.query(`UPDATE ${table.name} SET status = 'Active' WHERE status = 'active'`);
        await sequelize.query(`UPDATE ${table.name} SET status = 'Pending' WHERE status = 'pending'`);
        await sequelize.query(`UPDATE ${table.name} SET status = 'Suspended' WHERE status = 'suspended'`);
        await sequelize.query(`UPDATE ${table.name} SET status = 'Rejected' WHERE status = 'rejected'`);
        await sequelize.query(`UPDATE ${table.name} SET status = 'Inactive' WHERE status = 'inactive'`);
        await sequelize.query(`UPDATE ${table.name} SET status = 'Hidden' WHERE status = 'hidden'`);
        await sequelize.query(`UPDATE ${table.name} SET status = 'Out-of-Stock' WHERE status = 'out-of-stock'`);
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

    // 4. Seed Admin if not exists
    const seedAdmin = async () => {
      try {
        const adminEmail = process.env.ADMIN_EMAIL || 'admin@gmail.com';
        const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@123';
        
        const existingAdmin = await Admin.findOne({ where: { email: adminEmail } });
        if (!existingAdmin) {
          await Admin.create({
            name: 'FlashBasket Admin',
            user_name: 'admin',
            email: adminEmail,
            password: adminPassword, // Will be hashed by beforeSave hook
            role: 'superadmin'
          });
          console.log(`✅ Admin user seeded: ${adminEmail}`);
        }
      } catch (err) {
        console.error("❌ Admin seeding error:", err.message);
      }
    };
    await seedAdmin();

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

  // Enable CORS with support for Private Network Access (PNA)
  app.use(cors({
    origin: frontendUrl === "*" ? "*" : frontendUrl.split(","),
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Access-Control-Allow-Private-Network"],
    credentials: true
  }));

  // Specifically handle the Private Network Access preflight request
  app.use((req, res, next) => {
    if (req.headers['access-control-request-private-network']) {
      res.setHeader('Access-Control-Allow-Private-Network', 'true');
    }
    next();
  });

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
  
  // Validate critical environment variables
  const requiredEnvVars = ['DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD', 'JWT_SECRET', 'FRONTEND_URL'];
  const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
  
  if (missingEnvVars.length > 0) {
    console.warn(`\n⚠️  WARNING: Missing recommended environment variables: ${missingEnvVars.join(', ')}`);
    console.warn(`Current FRONTEND_URL is set to: ${frontendUrl}\n`);
  }

  httpServer.listen(PORT, () => {
    console.log(`✅ Server is running on port ${PORT}`);
    console.log(`🌐 Accepting requests from: ${frontendUrl}`);
  });
};

startServer();
