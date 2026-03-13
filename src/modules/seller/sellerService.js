import { Seller, sequelize } from '../../models/index.js';
import { Op } from 'sequelize';

class SellerService {
  /**
   * Find sellers nearby or by location text
   * @param {object} params - Search parameters
   */
  async findNearbySellers({ lat, lng, distance = 5, pincode, query }) {
    const where = {};
    const include = [];
    let order = [['shop_name', 'ASC']];

    // 1. Precise Coordinate Search (Highest Priority)
    if (lat && lng) {
        const distanceQuery = `(
          6371 * acos(
            cos(radians(${lat})) * cos(radians(latitude)) * 
            cos(radians(longitude) - radians(${lng})) + 
            sin(radians(${lat})) * sin(radians(latitude))
          )
        )`;
        
        include.push([sequelize.literal(distanceQuery), 'distance']);
        where[Op.and] = sequelize.where(
            sequelize.literal(distanceQuery),
            { [Op.lte]: distance }
        );
        order = sequelize.literal('distance ASC');
    }

    // 2. Fallback or Additional Filters: Pincode / Area Name
    const orConditions = [];
    if (pincode) {
        orConditions.push({ pincode: { [Op.like]: `%${pincode}%` } });
    }
    if (query) {
        orConditions.push({ city: { [Op.like]: `%${query}%` } });
        orConditions.push({ address: { [Op.like]: `%${query}%` } });
        orConditions.push({ shop_name: { [Op.like]: `%${query}%` } });
    }

    if (orConditions.length > 0) {
        if (where[Op.and]) {
            // If we already have a sphere filter, we might want to combine them
            // or just use coordinates as primary. For now, let's use OR for text search
            // unless coordinates are provided.
        } else {
            where[Op.or] = orConditions;
        }
    }

    // Always exclude password
    const attributes = { 
        exclude: ['password'],
        include: include.length > 0 ? include : []
    };

    return await Seller.findAll({
      attributes,
      where,
      order: [order]
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
