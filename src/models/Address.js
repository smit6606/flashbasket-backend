import { DataTypes } from 'sequelize';
import { sequelize } from '../config/db.js';

const Address = sequelize.define('Address', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  fullName: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  phone: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  houseNumber: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  area: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  landmark: {
    type: DataTypes.STRING,
  },
  city: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  state: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  pincode: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  addressType: {
    type: DataTypes.ENUM('Home', 'Work', 'Other'),
    defaultValue: 'Home',
  },
  latitude: {
    type: DataTypes.DECIMAL(10, 8),
  },
  longitude: {
    type: DataTypes.DECIMAL(11, 8),
  },
  isDefault: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  }
});

export default Address;
