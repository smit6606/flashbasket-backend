import { sequelize } from '../src/config/db.js';
import Admin from '../src/models/Admin.js';
import bcrypt from 'bcryptjs';

const setupAdmin = async () => {
    try {
        await sequelize.authenticate();
        console.log('Connection has been established successfully.');
        
        let admin = await Admin.findOne({ where: { email: 'admin@flashbasket.com' } });
        
        if (admin) {
            console.log('Admin already exists. Resetting password to: admin123');
            admin.password = 'admin123';
            await admin.save();
        } else {
            console.log('Creating new admin with password: admin123');
            admin = await Admin.create({
                name: 'Super Admin',
                user_name: 'superadmin',
                email: 'admin@flashbasket.com',
                password: 'admin123',
                role: 'superadmin'
            });
        }
        
        console.log('--- ADMIN CREDENTIALS ---');
        console.log(`Email: ${admin.email}`);
        console.log(`Password: admin123`);
        console.log('-------------------------');
        
        process.exit(0);
    } catch (error) {
        console.error('Unable to setup admin:', error);
        process.exit(1);
    }
};

setupAdmin();
