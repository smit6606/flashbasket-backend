import { Op } from 'sequelize';

/**
 * Builds a Sequelize query object from request query parameters for pagination, searching, sorting and filtering.
 * @param {Object} reqQuery - The req.query object from express.
 * @param {Array} searchableFields - Array of field names to enable text search on.
 */
export const buildQuery = (reqQuery, searchableFields = []) => {
  const { 
    page = 1, 
    limit = 10, 
    search = '', 
    sortBy = 'id', 
    sortOrder = 'DESC', 
    ...filters 
  } = reqQuery;

  const offset = (parseInt(page) - 1) * parseInt(limit);
  const size = parseInt(limit);

  const where = {};

  // Handle Search
  if (search && searchableFields.length > 0) {
    where[Op.or] = searchableFields.map(field => {
        // Handle nested fields or associations if needed in future
        return { [field]: { [Op.substring]: search } };
    });
  }

  // Handle Filters (simple equality filters)
  Object.keys(filters).forEach(key => {
    if (filters[key] !== undefined && filters[key] !== 'all' && filters[key] !== '') {
      // Basic support for multiple values if query is ?status=active,suspended
      const value = filters[key];
      if (typeof value === 'string' && value.includes(',')) {
        where[key] = { [Op.in]: value.split(',') };
      } else {
        where[key] = value;
      }
    }
  });

  return {
    where,
    limit: size,
    offset,
    order: [[sortBy, sortOrder.toUpperCase()]]
  };
};

/**
 * Wraps fineAndCountAll response into a standard paginated format.
 */
export const formatPaginatedResponse = (data, page, limit) => {
  const { count, rows } = data;
  const currentPage = parseInt(page) || 1;
  const pageSize = parseInt(limit) || 10;

  return {
    totalItems: count,
    items: rows,
    totalPages: Math.ceil(count / pageSize),
    currentPage: currentPage
  };
};
