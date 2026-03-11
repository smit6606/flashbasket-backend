import { DataTypes } from 'sequelize';
import { sequelize } from '../config/db.js';

const Order = sequelize.define('Order', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  orderNumber: {
    type: DataTypes.STRING,
    unique: true,
  },
  groupId: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  totalAmount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  deliveryFee: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  commissionAmount: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  sellerId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM(
      'pending', 
      'preparing', 
      'awaiting-assignment', 
      'assigned',
      'accepted-by-partner',
      'ready-to-ship', 
      'shipped', 
      'out-for-delivery', 
      'arrived',
      'delivered', 
      'completed',
      'cancelled'
    ),
    defaultValue: 'pending',
  },
  paymentStatus: {
    type: DataTypes.ENUM('unpaid', 'paid', 'failed', 'refunded'),
    defaultValue: 'unpaid',
  },
  paymentMethod: {
    type: DataTypes.ENUM('stripe', 'cod', 'upi'),
    defaultValue: 'cod',
  },
  deliveryAddress: {
    type: DataTypes.JSON,
    allowNull: false,
  },
  latitude: {
    type: DataTypes.DECIMAL(10, 8),
    allowNull: true,
  },
  longitude: {
    type: DataTypes.DECIMAL(11, 8),
    allowNull: true,
  },
  location: {
    type: DataTypes.GEOMETRY('POINT'),
    allowNull: true,
  },
  deliveryPartnerId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  deliveryOtp: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  deliveryProof: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  otpExpiry: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  otpVerified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
}, {
  timestamps: true,
});

export default Order;
