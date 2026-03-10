import { getDistance, convertDistance } from 'geolib';

/**
 * Calculates distance between two points
 * @param {object} start {latitude, longitude}
 * @param {object} end {latitude, longitude}
 * @returns {number} Distance in kilometers
 */
export const calculateDistance = (start, end) => {
  if (!start.latitude || !start.longitude || !end.latitude || !end.longitude) {
    return null;
  }
  
  const distanceInMeters = getDistance(
    { latitude: start.latitude, longitude: start.longitude },
    { latitude: end.latitude, longitude: end.longitude }
  );
  
  return parseFloat(convertDistance(distanceInMeters, 'km').toFixed(2));
};

/**
 * Checks if a point is within a specific radius
 * @param {object} start {latitude, longitude}
 * @param {object} end {latitude, longitude}
 * @param {number} radiusInKm
 */
export const isWithinRadius = (start, end, radiusInKm) => {
  const distance = calculateDistance(start, end);
  return distance !== null && distance <= radiusInKm;
};
