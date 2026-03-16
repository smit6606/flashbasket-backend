import { sequelize } from '../src/config/db.js';
import Admin from '../src/models/Admin.js';
import bcrypt from 'bcryptjs';

import dotenv from 'dotenv';
dotenv.config();

const setupAdmin = async () => {
    try {
        await sequelize.authenticate();
        console.log('Connection has been established successfully.');
        
        const adminEmail = process.env.ADMIN_EMAIL || 'admin@flashbasket.com';
        const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

        // Find by user_name instead of email to avoid duplicate record issues when changing email
        let admin = await Admin.findOne({ where: { user_name: 'superadmin' } });
        
        if (admin) {
            console.log(`Admin (superadmin) already exists. Syncing credentials from .env...`);
            admin.email = adminEmail;
            admin.password = adminPassword;
            await admin.save();
        } else {
            console.log(`Creating new admin (superadmin) with credentials from .env...`);
            admin = await Admin.create({
                name: 'Super Admin',
                user_name: 'superadmin',
                email: adminEmail,
                password: adminPassword,
                role: 'superadmin'
            });
        }
        
        console.log('--- ADMIN CREDENTIALS SYNCED ---');
        console.log(`Email: ${adminEmail}`);
        console.log(`Password: ${adminPassword}`);
        console.log('---------------------------------');
        
        process.exit(0);
    } catch (error) {
        console.error('Unable to setup admin:', error);
        process.exit(1);
    }
};

setupAdmin();
