import mysql from 'mysql2/promise';
import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

dotenv.config();

const { 
  DB_HOST = 'localhost', 
  DB_USER = 'root', 
  DB_PASSWORD = '', 
  DB_NAME = 'flashbasket', 
  DB_DIALECT = 'mysql' 
} = process.env;

// Initialize Sequelize instance
const sequelize = new Sequelize(DB_NAME, DB_USER, DB_PASSWORD, {
  host: DB_HOST,
  dialect: DB_DIALECT,
  logging: false,
});

/**
 * Connects to MySQL server, ensures the database exists, and authenticates Sequelize.
 */
const connectDB = async () => {
  try {
    // 1. Ensure the database exists using a raw mysql2 connection
    const connection = await mysql.createConnection({
      host: DB_HOST,
      user: DB_USER,
      password: DB_PASSWORD,
    });

    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\`;`);
    await connection.end();

    // 2. Authenticate the Sequelize instance
    await sequelize.authenticate();
    
    console.log(`✅ MySQL connected: Database "${DB_NAME}" is ready.`);
    
    // Optional: Synchronize models with the database
    // await sequelize.sync({ alter: true }); 
  } catch (error) {
    console.error('❌ Database Connection Error:', error.message);
    process.exit(1);
  }
};

export { sequelize, connectDB };