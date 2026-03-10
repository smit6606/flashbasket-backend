import { sequelize } from '../src/config/db.js';

const checkSchema = async () => {
    try {
        const [results] = await sequelize.query('DESCRIBE Orders;');
        console.log(results);
        process.exit(0);
    } catch (e) {
        console.log(e);
        process.exit(1);
    }
}
checkSchema();
