import { DataTypes } from 'sequelize';
import { sequelize } from '../config/db.js';
import User from './User.js';
import Seller from './Seller.js';
import Admin from './Admin.js';
import DeliveryPartner from './DeliveryPartner.js';
import Product from './Product.js';
import Order from './Order.js';
import Category from './Category.js';
import SubCategory from './SubCategory.js';
import Cart from './Cart.js';
import CartItem from './CartItem.js';
import Review from './Review.js';

// --- Associations ---

// 1. Seller <-> Product (One-to-Many)
Seller.hasMany(Product, { foreignKey: 'sellerId', onDelete: 'CASCADE' });
Product.belongsTo(Seller, { foreignKey: 'sellerId' });

// 2. Category <-> SubCategory (One-to-Many)
Category.hasMany(SubCategory, { foreignKey: 'categoryId', onDelete: 'CASCADE' });
SubCategory.belongsTo(Category, { foreignKey: 'categoryId' });

// 3. Category <-> Product (One-to-Many)
Category.hasMany(Product, { foreignKey: 'categoryId' });
Product.belongsTo(Category, { foreignKey: 'categoryId' });

// 4. SubCategory <-> Product (One-to-Many)
SubCategory.hasMany(Product, { foreignKey: 'subCategoryId' });
Product.belongsTo(SubCategory, { foreignKey: 'subCategoryId' });

// 5. User <-> Order (One-to-Many)
User.hasMany(Order, { foreignKey: 'userId' });
Order.belongsTo(User, { foreignKey: 'userId' });

// 6. Seller <-> Order (One-to-Many)
Seller.hasMany(Order, { foreignKey: 'sellerId' });
Order.belongsTo(Seller, { foreignKey: 'sellerId' });

// 7. DeliveryPartner <-> Order (One-to-Many)
DeliveryPartner.hasMany(Order, { foreignKey: 'deliveryPartnerId' });
Order.belongsTo(DeliveryPartner, { foreignKey: 'deliveryPartnerId', as: 'DeliveryPartner' });

// 8. User <-> Cart (One-to-One)
User.hasOne(Cart, { foreignKey: 'userId', onDelete: 'CASCADE' });
Cart.belongsTo(User, { foreignKey: 'userId' });

// 9. Cart <-> CartItem (One-to-Many)
Cart.hasMany(CartItem, { foreignKey: 'cartId', onDelete: 'CASCADE' });
CartItem.belongsTo(Cart, { foreignKey: 'cartId' });

// 10. Product -> CartItem
Product.hasMany(CartItem, { foreignKey: 'productId' });
CartItem.belongsTo(Product, { foreignKey: 'productId' });

// 11. Seller -> CartItem
Seller.hasMany(CartItem, { foreignKey: 'sellerId' });
CartItem.belongsTo(Seller, { foreignKey: 'sellerId' });

// 12. Order <-> Product (Many-to-Many via OrderItems)
const OrderItem = sequelize.define('OrderItem', {
  quantity: { type: DataTypes.INTEGER, defaultValue: 1 },
  price: { type: DataTypes.DECIMAL(10, 2) }
});

Order.belongsToMany(Product, { through: OrderItem });
Product.belongsToMany(Order, { through: OrderItem });

// 13. User <-> Review (One-to-Many)
User.hasMany(Review, { foreignKey: 'userId' });
Review.belongsTo(User, { foreignKey: 'userId' });

// 14. Product <-> Review (One-to-Many)
Product.hasMany(Review, { foreignKey: 'productId' });
Review.belongsTo(Product, { foreignKey: 'productId' });

export {
  User,
  Seller,
  Admin,
  DeliveryPartner,
  Product,
  Order,
  OrderItem,
  Category,
  SubCategory,
  Cart,
  CartItem,
  Review,
  sequelize
};
