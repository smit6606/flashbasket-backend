import { sequelize } from '../src/config/db.js';

const fixOrders = async () => {
    try {
        console.log("Adding groupId column to Orders table...");
        await sequelize.query('ALTER TABLE Orders ADD COLUMN groupId VARCHAR(255) DEFAULT NULL;');
        console.log("✅ Column added successfully!");
        process.exit(0);
    } catch (error) {
        if (error.original && error.original.code === 'ER_DUP_FIELDNAME') {
            console.log("✅ Column groupId already exists!");
            process.exit(0);
        }
        console.error("❌ Failed to add column:", error);
        process.exit(1);
    }
};

fixOrders();
