/**
 * OpenStreetMap & Nominatim Global Gym Discovery Source
 * 100% Legal, authorized, public global directory of registered fitness facilities.
 */

/**
 * Searches fitness centres and gyms in a specified city/country
 * @param {object} params { country, state, city, category, limit }
 * @returns {Promise<Array<object>>} List of discovered gym entities
 */
export async function searchGymsFromOSM({ country = 'India', state = '', city = 'Indore', category = 'Fitness Centre', limit = 30 }) {
  const queryCity = city.trim();
  const queryCountry = country.trim();

  // Overpass API Query for gyms & fitness centres in the targeted area
  const overpassQuery = `
    [out:json][timeout:25];
    area["name"="${queryCity}"]["boundary"="administrative"]->.searchArea;
    (
      node["leisure"="fitness_centre"](area.searchArea);
      way["leisure"="fitness_centre"](area.searchArea);
      node["amenity"="gym"](area.searchArea);
      way["amenity"="gym"](area.searchArea);
      node["sport"="fitness"](area.searchArea);
      way["sport"="fitness"](area.searchArea);
    );
    out center ${limit};
  `;

  const fallbackOverpassQuery = `
    [out:json][timeout:25];
    (
      node["leisure"="fitness_centre"](around:25000, 22.7196, 75.8577);
      node["amenity"="gym"](around:25000, 22.7196, 75.8577);
    );
    out center ${limit};
  `;

  const endpoints = [
    'https://overpass-api.de/api/interpreter',
    'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter'
  ];

  let rawElements = [];

  for (const endpoint of endpoints) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);

      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'GymStackGlobalResearchAgent/1.0 (sales@gymstack.in)'
        },
        body: 'data=' + encodeURIComponent(overpassQuery),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (resp.ok) {
        const data = await resp.json();
        if (data && data.elements && data.elements.length > 0) {
          rawElements = data.elements;
          break;
        }
      }
    } catch (e) {
      // try next overpass mirror
      continue;
    }
  }

  // If Overpass returned few results or timed out, use Nominatim Search API
  if (rawElements.length === 0) {
    try {
      const searchTerms = [
        `gym in ${queryCity}, ${queryCountry}`,
        `fitness centre in ${queryCity}, ${queryCountry}`,
        `crossfit in ${queryCity}, ${queryCountry}`
      ];

      for (const term of searchTerms) {
        if (rawElements.length >= limit) break;
        const nominatimUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(term)}&format=json&addressdetails=1&limit=${Math.min(limit, 25)}`;
        
        const resp = await fetch(nominatimUrl, {
          headers: {
            'User-Agent': 'GymStackResearchAgent/1.0 (sales@gymstack.in)',
            'Accept-Language': 'en'
          }
        });

        if (resp.ok) {
          const items = await resp.json();
          if (Array.isArray(items)) {
            for (const item of items) {
              rawElements.push({
                tags: {
                  name: item.name || item.display_name.split(',')[0],
                  'addr:city': item.address?.city || item.address?.town || item.address?.suburb || queryCity,
                  'addr:state': item.address?.state || state,
                  'addr:country': item.address?.country || queryCountry,
                  'addr:street': item.address?.road || '',
                  phone: item.address?.phone || '',
                  website: item.extratags?.website || ''
                },
                lat: item.lat,
                lon: item.lon,
                display_name: item.display_name
              });
            }
          }
        }
      }
    } catch (err) {
      console.warn('[OSM Nominatim Fallback Warning]:', err.message);
    }
  }

  // Map elements into clean GymStack Lead structure
  const results = [];
  const seenNames = new Set();

  for (const elem of rawElements) {
    const tags = elem.tags || {};
    const name = tags.name || tags['name:en'] || elem.display_name?.split(',')[0] || '';
    if (!name || name.length < 3 || seenNames.has(name.toLowerCase())) continue;
    seenNames.add(name.toLowerCase());

    const phone = tags.phone || tags['contact:phone'] || tags['contact:mobile'] || tags['contact:whatsapp'] || '';
    const website = tags.website || tags['contact:website'] || tags['url'] || '';
    const email = tags.email || tags['contact:email'] || '';
    const instagram = tags['contact:instagram'] || '';
    const facebook = tags['contact:facebook'] || '';

    // Build address
    const street = tags['addr:street'] || '';
    const housenumber = tags['addr:housenumber'] || '';
    const postcode = tags['addr:postcode'] || '';
    const fullAddress = [housenumber, street, queryCity, state, postcode, queryCountry].filter(Boolean).join(', ');

    // Deduce specific gym category
    let detectedCategory = category;
    const lowerName = name.toLowerCase();
    if (lowerName.includes('crossfit')) detectedCategory = 'CrossFit Studio';
    else if (lowerName.includes('women') || lowerName.includes('female')) detectedCategory = 'Women Fitness Centre';
    else if (lowerName.includes('personal') || lowerName.includes('pt studio')) detectedCategory = 'Personal Training Studio';
    else if (lowerName.includes('gold') || lowerName.includes('anytime') || lowerName.includes('cult') || lowerName.includes('snap')) detectedCategory = 'Gym Chain';
    else if (lowerName.includes('boutique') || lowerName.includes('pilates') || lowerName.includes('yoga')) detectedCategory = 'Boutique Fitness Studio';

    results.push({
      gymName: name.trim(),
      ownerName: tags.operator || tags.owner || null,
      founderName: tags.founder || null,
      managerName: tags.manager || null,
      businessEmail: email ? email.trim() : null,
      whatsappNumber: tags['contact:whatsapp'] || (phone.startsWith('+') ? phone : null),
      businessPhone: phone ? phone.trim() : null,
      hasWhatsApp: Boolean(tags['contact:whatsapp']),
      website: website ? website.trim() : null,
      fullAddress: fullAddress || elem.display_name || `${queryCity}, ${queryCountry}`,
      city: queryCity,
      state: tags['addr:state'] || state || '',
      country: queryCountry,
      instagramUrl: instagram ? (instagram.startsWith('http') ? instagram : `https://instagram.com/${instagram.replace('@', '')}`) : null,
      facebookUrl: facebook ? (facebook.startsWith('http') ? facebook : `https://facebook.com/${facebook}`) : null,
      linkedinUrl: tags['contact:linkedin'] || null,
      gymCategory: detectedCategory,
      branchesCount: detectedCategory === 'Gym Chain' ? 3 : 1,
      sourceUrl: `https://www.openstreetmap.org/?mlat=${elem.lat}&mlon=${elem.lon}`,
      sourceName: 'OpenStreetMap Global Directory',
      researchDate: new Date().toISOString().split('T')[0],
      confidenceLevel: phone && website ? 'High' : (phone ? 'Medium' : 'Low')
    });

    if (results.length >= limit) break;
  }

  return results;
}
