import { sequelize } from '../src/config/db.js';
import '../src/models/index.js';

const syncDB = async () => {
    try {
        console.log("Starting DB Sync...");
        await sequelize.sync({ alter: true });
        console.log("✅ Database synchronized successfully with alter: true");
        process.exit(0);
    } catch (error) {
        console.error("❌ Database sync failed:", error);
        process.exit(1);
    }
};

syncDB();
