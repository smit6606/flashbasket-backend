/**
 * Greedy Inventory Allocation Algorithm
 * Goal: Fulfill required quantity using the minimum number of sellers.
 * 
 * @param {Array} sellers - List of objects { id, shop_name, stock }
 * @param {Number} requiredQuantity - Total quantity needed
 * @returns {Object} allocation - { selectedSellers: [], remaining: Number, totalAllocated: Number }
 */
export const allocateInventory = (sellers, requiredQuantity) => {
    // 1. Sort sellers by stock in descending order (Greedy Strategy)
    // This minimizes the number of sellers because we take the largest chunks first.
    const sortedSellers = [...sellers].sort((a, b) => b.stock - a.stock);

    const allocation = {
        selectedSellers: [],
        remaining: requiredQuantity,
        totalAllocated: 0
    };

    for (const seller of sortedSellers) {
        if (allocation.remaining <= 0) break;

        const take = Math.min(seller.stock, allocation.remaining);

        if (take > 0) {
            allocation.selectedSellers.push({
                sellerId: seller.id,
                shopName: seller.shop_name,
                allocatedQuantity: take,
                originalStock: seller.stock
            });
            allocation.remaining -= take;
            allocation.totalAllocated += take;
        }
    }

    return allocation;
};
