import { DataTypes } from 'sequelize';
import { sequelize } from '../config/db.js';

const Coupon = sequelize.define('Coupon', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  code: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: false,
  },
  discountType: {
    type: DataTypes.ENUM('percentage', 'fixed'),
    defaultValue: 'fixed',
  },
  discountValue: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  minOrderValue: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  expiryDate: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  }
});

export default Coupon;
