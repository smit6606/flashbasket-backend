import { DataTypes } from 'sequelize';
import { sequelize } from '../config/db.js';

const Cart = sequelize.define('Cart', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
}, {
  timestamps: true,
});

export default Cart;
