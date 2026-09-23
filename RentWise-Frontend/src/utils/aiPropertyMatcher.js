/**
 * AI Property Matching Engine for RentWise
 * Performs natural language semantic analysis to match real estate listings with user queries.
 */

export const AI_SUGGESTED_PROMPTS = [
  "🏡 3-bedroom house in Kandy with garden & parking",
  "🏙️ Modern 2-bed Colombo apartment with pool & AC under 150k",
  "🌊 Luxury beachfront villa in Galle under 250k",
  "💼 Commercial office or space in Colombo 03 with parking",
  "🛏️ Furnished studio or annex near Colombo under 60k"
];

/**
 * Parses natural language query and ranks properties based on relevance.
 * @param {string} query - The natural language search query
 * @param {Array} properties - List of properties from the database
 * @returns {Array} List of properties ranked by match score with reasons & percentage
 */
export function matchPropertiesWithAi(query, properties) {
  if (!query || !query.trim() || !Array.isArray(properties)) {
    return properties || [];
  }

  const q = query.toLowerCase().trim();

  // 1. Extract budget / max price:
  let maxPrice = null;
  const priceKMatch = q.match(/(?:under|below|less than|max|budget|within|upto)?\s*(?:rs\.?|lkr)?\s*(\d+(?:\.\d+)?)\s*k\b/i);
  const priceMMatch = q.match(/(?:under|below|less than|max|budget|within|upto)?\s*(?:rs\.?|lkr)?\s*(\d+(?:\.\d+)?)\s*m\b/i);
  const priceNumMatch = q.match(/(?:under|below|less than|max|budget|within|upto)\s*(?:rs\.?|lkr)?\s*([\d,]{4,})/i);

  if (priceKMatch) {
    maxPrice = parseFloat(priceKMatch[1]) * 1000;
  } else if (priceMMatch) {
    maxPrice = parseFloat(priceMMatch[1]) * 1000000;
  } else if (priceNumMatch) {
    maxPrice = parseFloat(priceNumMatch[1].replace(/,/g, ''));
  }

  // 2. Extract bedroom count:
  let reqBedrooms = null;
  const bedNumMatch = q.match(/(\d+)\s*(?:bed|bedroom|br|rooms?)\b/i);
  if (bedNumMatch) {
    reqBedrooms = parseInt(bedNumMatch[1], 10);
  } else if (q.includes('single bed') || q.includes('1 bed') || q.includes('one bed')) {
    reqBedrooms = 1;
  } else if (q.includes('two bed') || q.includes('2 bed') || q.includes('double bed')) {
    reqBedrooms = 2;
  } else if (q.includes('three bed') || q.includes('3 bed')) {
    reqBedrooms = 3;
  } else if (q.includes('four bed') || q.includes('4 bed')) {
    reqBedrooms = 4;
  }

  // 3. Extract property type:
  let reqType = null;
  if (q.includes('apartment') || q.includes('flat') || q.includes('condo')) reqType = 'Apartment';
  else if (q.includes('villa')) reqType = 'Villa';
  else if (q.includes('commercial') || q.includes('office') || q.includes('shop')) reqType = 'Commercial';
  else if (q.includes('annex') || q.includes('portion')) reqType = 'Annex';
  else if (q.includes('studio')) reqType = 'Studio';
  else if (q.includes('house') || q.includes('home') || q.includes('bungalow')) reqType = 'House';

  // 4. Extract known Sri Lankan cities/areas:
  const knownLocations = [
    'colombo', 'kandy', 'galle', 'negombo', 'dehiwala', 'nugegoda',
    'rajagiriya', 'battaramulla', 'nawala', 'mount lavinia', 'malabe',
    'hanwella', 'kelaniya', 'piliyandala', 'kurunegala', 'matara',
    'panadura', 'gampaha', 'wattala', 'ja-ela', 'moratuwa', 'kotte'
  ];
  const matchedLocations = knownLocations.filter((loc) => q.includes(loc));

  // 5. Extract amenities / features:
  const amenityKeywords = [
    { key: 'Pool', terms: ['pool', 'swimming'] },
    { key: 'Air Conditioning', terms: ['ac', 'air condition', 'air-con', 'aircon', 'climate'] },
    { key: 'Parking', terms: ['parking', 'garage', 'vehicle'] },
    { key: 'Gym', terms: ['gym', 'fitness'] },
    { key: 'WiFi', terms: ['wifi', 'internet', 'broadband'] },
    { key: 'Garden', terms: ['garden', 'lawn', 'yard'] },
    { key: 'Security', terms: ['security', 'cctv', 'guard'] },
    { key: 'Sea View', terms: ['sea view', 'ocean view', 'beach'] },
    { key: 'Furnished', terms: ['furnished', 'furnish'] },
    { key: 'Hot Water', terms: ['hot water', 'geyser'] },
    { key: 'Balcony', terms: ['balcony', 'terrace', 'rooftop'] },
    { key: 'Generator', terms: ['generator', 'power backup'] }
  ];
  const reqAmenities = amenityKeywords.filter((a) => a.terms.some((t) => q.includes(t)));

  // 6. Score and rank every property:
  const scored = properties.map((prop) => {
    let score = 0;
    const reasons = [];

    const propText = `${prop.title || ''} ${prop.description || ''} ${prop.address || ''} ${prop.city || ''} ${prop.facilities || ''}`.toLowerCase();
    const propRent = Number(prop.monthlyRent || 0);
    const propBeds = Number(prop.bedrooms || 0);
    const propType = (prop.propertyType || '').toLowerCase();

    // Location matching (+35)
    if (matchedLocations.length > 0) {
      const locMatch = matchedLocations.some((loc) => propText.includes(loc));
      if (locMatch) {
        score += 35;
        const capLoc = matchedLocations.map(l => l.charAt(0).toUpperCase() + l.slice(1)).join(', ');
        reasons.push(`${capLoc} location`);
      }
    }

    // Property Type matching (+30)
    if (reqType) {
      if (propType.includes(reqType.toLowerCase()) || (prop.title && prop.title.toLowerCase().includes(reqType.toLowerCase()))) {
        score += 30;
        reasons.push(`${reqType} listing`);
      }
    }

    // Bedroom matching (+25)
    if (reqBedrooms !== null) {
      if (propBeds >= reqBedrooms) {
        score += 25;
        reasons.push(`${propBeds} Beds`);
      } else if (propBeds > 0) {
        score += 10;
      }
    }

    // Budget matching (+25)
    if (maxPrice !== null) {
      if (propRent > 0 && propRent <= maxPrice) {
        score += 25;
        reasons.push(`Under Rs. ${(maxPrice >= 1000000 ? (maxPrice/1000000).toFixed(1) + 'M' : (maxPrice/1000).toFixed(0) + 'k')}`);
      } else if (propRent > maxPrice && propRent <= maxPrice * 1.15) {
        score += 12;
        reasons.push(`Near budget target`);
      }
    }

    // Amenities matching (+12 each)
    reqAmenities.forEach((amenity) => {
      if (amenity.terms.some(t => propText.includes(t))) {
        score += 12;
        reasons.push(amenity.key);
      }
    });

    // General token overlap (+5 each)
    const tokens = q.split(/\s+/).filter(
      (w) => w.length > 3 && !['with', 'under', 'want', 'from', 'this', 'that', 'near', 'need', 'good', 'looking'].includes(w)
    );
    tokens.forEach((t) => {
      if (propText.includes(t)) score += 5;
    });

    // Compute percentage match (between 60% and 99%)
    const matchPercentage = Math.min(99, Math.max(60, Math.round(50 + (score / 130) * 49)));

    return {
      ...prop,
      aiScore: score,
      aiMatchPercentage: matchPercentage,
      aiReasons: reasons
    };
  });

  // Filter to properties with positive score, sorted descending by score
  const matches = scored.filter((p) => p.aiScore > 0).sort((a, b) => b.aiScore - a.aiScore);

  // If no strict criteria hit, perform fuzzy keyword match
  if (matches.length === 0) {
    const fallbackTokens = q.split(/\s+/).filter((w) => w.length > 2);
    return scored
      .map((p) => {
        const text = `${p.title} ${p.address} ${p.description} ${p.facilities}`.toLowerCase();
        const count = fallbackTokens.filter((t) => text.includes(t)).length;
        return {
          ...p,
          aiScore: count * 10,
          aiMatchPercentage: Math.min(85, Math.max(50, 45 + count * 10)),
          aiReasons: ['Keyword match']
        };
      })
      .filter((p) => p.aiScore > 0)
      .sort((a, b) => b.aiScore - a.aiScore);
  }

  return matches;
}

