/**
 * Google Places API Gym Discovery Provider (Optional if API key configured)
 */
import { config } from '../../../config.js';

export async function searchGymsFromGoogle({ city, state, country, category, limit = 20 }) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return []; // Google Places API not configured, fallback cleanly to OSM
  }

  const queryTerm = `${category || 'gym'} in ${city} ${state || ''} ${country}`.trim();
  const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(
    queryTerm
  )}&key=${apiKey}`;

  try {
    const response = await fetch(searchUrl);
    const data = await response.json();

    if (!data.results || data.results.length === 0) return [];

    const results = [];
    const targetSlice = data.results.slice(0, limit);

    for (const place of targetSlice) {
      results.push({
        gymName: place.name,
        businessPhone: null, // to be populated via details or enrichment
        fullAddress: place.formatted_address,
        city,
        state: state || '',
        country,
        rating: place.rating,
        userRatingsTotal: place.user_ratings_total,
        placeId: place.place_id,
        sourceUrl: `https://www.google.com/maps/place/?q=place_id:${place.place_id}`,
        sourceName: 'Google Places API',
        gymCategory: category || 'Fitness Centre',
      });
    }

    return results;
  } catch (err) {
    console.error('[Google Places Search Error]:', err.message);
    return [];
  }
}
