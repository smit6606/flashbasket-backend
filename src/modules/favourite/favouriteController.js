import { Favourite, Product, Category, Seller } from '../../models/index.js';
import { successResponse } from '../../utils/responseFormat.js';
import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../utils/catchAsync.js';

/**
 * @desc Toggle product as favourite
 */
export const toggleFavourite = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const { productId } = req.body;

  const existing = await Favourite.findOne({ where: { userId, productId } });

  if (existing) {
    await existing.destroy();
    return successResponse({
      res,
      message: "Removed from Favourites",
      data: { isFavourite: false }
    });
  }

  const favourite = await Favourite.create({ userId, productId });
  return successResponse({
    res,
    statusCode: StatusCodes.CREATED,
    message: "Added to Favourites",
    data: { isFavourite: true, favourite }
  });
});

/**
 * @desc Get User's favourite products
 */
export const getMyFavourites = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const favourites = await Favourite.findAll({
    where: { userId },
    include: [{
      model: Product,
      include: [
        { model: Category, attributes: ['name'] },
        { model: Seller, attributes: ['id', 'shop_name'] }
      ]
    }]
  });

  return successResponse({
    res,
    message: "Favourite products fetched",
    data: favourites
  });
});
