import { Seller, sequelize } from '../../models/index.js';
import { Op } from 'sequelize';

class SellerService {
  /**
   * Find sellers nearby using Haversine formula
   * @param {number} lat - User latitude
   * @param {number} lng - User longitude
   * @param {number} distance - Max distance in km
   */
  async findNearbySellers(lat, lng, distance) {
    // Haversine formula to calculate distance in km
    const distanceQuery = `(
      6371 * acos(
        cos(radians(:lat)) * cos(radians(latitude)) * 
        cos(radians(longitude) - radians(:lng)) + 
        sin(radians(:lat)) * sin(radians(latitude))
      )
    )`;

    return await Seller.findAll({
      attributes: {
        include: [
          [sequelize.literal(distanceQuery), 'distance']
        ]
      },
      where: sequelize.where(
        sequelize.literal(distanceQuery),
        { [Op.lte]: distance }
      ),
      order: sequelize.literal('distance ASC'),
      replacements: { lat, lng }
    });
  }

  async getAllSellers() {
    return await Seller.findAll({
      attributes: { exclude: ['password'] }
    });
  }

  async getSellerById(id) {
    return await Seller.findByPk(id, {
      attributes: { exclude: ['password'] }
    });
  }
}

export default new SellerService();
