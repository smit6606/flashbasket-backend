import { Op } from 'sequelize';
import { User, Seller, Admin, DeliveryPartner } from '../../models/index.js';

class AuthService {
  /**
   * Get the correct model based on role
   */
  getModelByRole(role) {
    switch (role) {
      case 'user': return User;
      case 'seller': return Seller;
      case 'admin': return Admin;
      case 'delivery': return DeliveryPartner;
      default: return null;
    }
  }

  async register(role, data) {
    const Model = this.getModelByRole(role);
    if (!Model) throw new Error('Invalid role');
    return await Model.create(data);
  }

  async findByEmail(role, email) {
    const Model = this.getModelByRole(role);
    if (!Model) return null;
    return await Model.findOne({ where: { email } });
  }

  async findByUsername(role, user_name) {
    const Model = this.getModelByRole(role);
    if (!Model) return null;
    return await Model.findOne({ where: { user_name } });
  }

  async findByPhone(role, phone) {
    const Model = this.getModelByRole(role);
    if (!Model) return null;
    return await Model.findOne({ where: { phone } });
  }

  async findByLoginField(role, identifier) {
    const Model = this.getModelByRole(role);
    if (!Model) return null;
    
    return await Model.findOne({
      where: {
        [Op.or]: [
          { email: identifier },
          ...(Model.rawAttributes.user_name ? [{ user_name: identifier }] : []),
          ...(Model.rawAttributes.phone ? [{ phone: identifier }] : []),
        ],
      },
    });
  }

  async findById(role, id) {
    const Model = this.getModelByRole(role);
    if (!Model) return null;
    return await Model.findByPk(id);
  }

  async findByIdWithoutPassword(role, id) {
    const Model = this.getModelByRole(role);
    if (!Model) return null;
    return await Model.findByPk(id, {
      attributes: { exclude: ['password'] },
    });
  }

  async updateUser(user, updatedData) {
    return await user.update(updatedData);
  }

  async deleteUser(user) {
    return await user.destroy();
  }

  async findAllUsers(role) {
    const Model = this.getModelByRole(role);
    if (!Model) return [];
    return await Model.findAll({
      attributes: { exclude: ['password'] },
    });
  }
}

export default new AuthService();
