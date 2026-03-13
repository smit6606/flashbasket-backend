import { DataTypes } from 'sequelize';
import { sequelize } from '../config/db.js';

const Favourite = sequelize.define('Favourite', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  productId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  }
}, {
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['userId', 'productId']
    }
  ]
});

export default Favourite;
