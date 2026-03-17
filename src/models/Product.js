import { DataTypes } from 'sequelize';
import { sequelize } from '../config/db.js';

const Product = sequelize.define('Product', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  productName: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  description: {
    type: DataTypes.TEXT,
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    comment: 'Legacy price field, maps to finalPrice'
  },
  originalPrice: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0,
  },
  discountPercent: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  discountAmount: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  finalPrice: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0,
  },
  discountPrice: {
    type: DataTypes.DECIMAL(10, 2),
    comment: 'Legacy discountPrice field'
  },
  stock: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  unit: {
    type: DataTypes.STRING, // e.g., kg, packet, litre
    allowNull: false,
  },
  images: {
    type: DataTypes.JSON, // Array of image URLs
  },
  rating: {
    type: DataTypes.FLOAT,
    defaultValue: 0,
  },
  status: {
    type: DataTypes.ENUM('Active', 'Inactive', 'Out-of-Stock', 'Pending', 'Rejected', 'Hidden'),
    defaultValue: 'Pending',
  },
}, {
  timestamps: true,
});

export default Product;
