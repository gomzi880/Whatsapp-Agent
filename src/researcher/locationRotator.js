/**
 * Location Rotator Engine (Phase 3)
 * 
 * Intelligently rotates research across Indian states, districts, metro cities,
 * and international markets (USA, UK, Canada, Australia, UAE, Singapore, Europe).
 * Queries historical research data to avoid repeatedly searching the same locations
 * when unexplored regions remain.
 */

import { TARGET_LOCATIONS, GYM_CATEGORIES } from './sources/locations.js';
import db, { getExploredLocations, recordResearchHistory } from '../database/db.js';

// Pre-classified Indian Metros vs Tier-2/3 for rotation balancing
const INDIAN_METROS = new Set([
  'Mumbai', 'New Delhi', 'Bengaluru', 'Hyderabad', 'Chennai', 'Kolkata', 'Ahmedabad', 'Pune'
]);

/**
 * Builds a flat registry of all available target locations from locations.js
 */
export function getAllAvailableLocations() {
  const locations = [];

  for (const [country, regions] of Object.entries(TARGET_LOCATIONS)) {
    for (const [state, cities] of Object.entries(regions)) {
      for (const city of cities) {
        const isIndia = country === 'India';
        const isMetro = isIndia && INDIAN_METROS.has(city);
        locations.push({
          country,
          state,
          city,
          tier: isIndia ? (isMetro ? 'metro' : 'tier2') : 'international'
        });
      }
    }
  }

  return locations;
}

/**
 * Gets historical exploration statistics and counts
 */
export function getExplorationStats() {
  const allLocations = getAllAvailableLocations();
  const exploredRows = getExploredLocations();

  const exploredMap = new Map();
  for (const row of exploredRows) {
    const key = `${row.country}:::${row.state || ''}:::${row.city}`.toLowerCase();
    exploredMap.set(key, {
      searchCount: row.searchCount,
      lastResearchedDate: row.lastResearchedDate,
      totalAccepted: row.totalAccepted
    });
  }

  const enriched = allLocations.map(loc => {
    const key = `${loc.country}:::${loc.state || ''}:::${loc.city}`.toLowerCase();
    const history = exploredMap.get(key) || { searchCount: 0, lastResearchedDate: null, totalAccepted: 0 };
    return {
      ...loc,
      ...history
    };
  });

  const unexploredCount = enriched.filter(l => l.searchCount === 0).length;
  const exploredCount = enriched.length - unexploredCount;

  return {
    totalLocations: enriched.length,
    exploredCount,
    unexploredCount,
    locations: enriched
  };
}

/**
 * Selects the next target location for research.
 * Prioritizes:
 * 1. Locations with 0 prior searches.
 * 2. Locations with the oldest `lastResearchedDate`.
 * 3. Rotates between Indian Metros, Indian Tier-2/3, and International locations.
 * 
 * @param {object} options { preferCountry, category, forceRandom }
 * @returns {object} { country, state, city, category, tier, searchCount }
 */
export function getNextResearchTarget({ preferCountry = null, category = 'Fitness Centre', forceRandom = false } = {}) {
  const stats = getExplorationStats();
  let candidatePool = stats.locations;

  if (preferCountry) {
    candidatePool = candidatePool.filter(l => l.country.toLowerCase() === preferCountry.toLowerCase());
    if (candidatePool.length === 0) {
      candidatePool = stats.locations; // Fallback to all if no match
    }
  }

  // Group by search status
  const unsearched = candidatePool.filter(l => l.searchCount === 0);

  let chosenLocation = null;

  if (unsearched.length > 0) {
    // If unexplored locations exist, select from unsearched.
    // Pick randomly among unsearched to provide diversity across states
    const idx = Math.floor(Math.random() * unsearched.length);
    chosenLocation = unsearched[idx];
  } else {
    // If all locations have been searched at least once, sort by oldest research date and least searchCount
    candidatePool.sort((a, b) => {
      if (a.searchCount !== b.searchCount) {
        return a.searchCount - b.searchCount;
      }
      const dateA = a.lastResearchedDate ? new Date(a.lastResearchedDate).getTime() : 0;
      const dateB = b.lastResearchedDate ? new Date(b.lastResearchedDate).getTime() : 0;
      return dateA - dateB;
    });

    // Pick among the top 5 least recently explored to avoid rigid predictability
    const topLeast = candidatePool.slice(0, Math.min(5, candidatePool.length));
    chosenLocation = topLeast[Math.floor(Math.random() * topLeast.length)];
  }

  // Select valid gym category
  const selectedCategory = GYM_CATEGORIES.includes(category) ? category : 'Fitness Centre';

  return {
    country: chosenLocation.country,
    state: chosenLocation.state,
    city: chosenLocation.city,
    category: selectedCategory,
    tier: chosenLocation.tier,
    searchCount: chosenLocation.searchCount,
    lastResearchedDate: chosenLocation.lastResearchedDate
  };
}

export function getLocationStats() {
  const stats = getExplorationStats();
  return {
    totalTargetLocations: stats.totalLocations,
    exploredLocationsCount: stats.exploredCount,
    unexploredLocationsCount: stats.unexploredCount,
    explorationCoveragePercent: Math.round((stats.exploredCount / stats.totalLocations) * 100),
    ...stats
  };
}

/**
 * Records a completed research run into the history table
 */
export function recordResearchRun({ country, state = '', city, category = 'Fitness Centre', discoveredCount = 0, acceptedCount = 0 }) {
  return recordResearchHistory({
    country,
    state,
    city,
    category,
    discoveredCount,
    acceptedCount
  });
}
