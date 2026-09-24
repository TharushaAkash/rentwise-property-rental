/**
 * Utility Bill Address Verification & Agentic AI OCR Checker
 * Automatically checks if the property address matches the utility bill address.
 */

// Known mock / sample utility bills mapped to verified addresses
const KNOWN_BILL_ADDRESS_MAP = [
  {
    pattern: /554224155|electricity/i,
    detectedAddress: 'Thalangama North, Battaramulla, Colombo',
    accountNo: 'CEB-084-992147-9',
    utilityProvider: 'Ceylon Electricity Board (CEB)',
    billDate: '2026-08-15'
  },
  {
    pattern: /586769852|water/i,
    detectedAddress: '45 Ward Place, Colombo 07',
    accountNo: 'NWSDB-COL-55120-X',
    utilityProvider: 'National Water Supply & Drainage Board',
    billDate: '2026-08-20'
  }
];

/**
 * Normalizes an address string for comparison (lowercasing, removing punctuation, standard abbreviations).
 */
export function normalizeAddress(addr) {
  if (!addr || typeof addr !== 'string') return '';
  return addr
    .toLowerCase()
    .replace(/[,./\\#\-_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extracts key address tokens (e.g. road names, areas, cities, postal codes).
 */
export function getAddressTokens(addr) {
  const norm = normalizeAddress(addr);
  if (!norm) return [];
  // Filter out very short generic words
  const stopWords = new Set(['no', 'rd', 'road', 'st', 'street', 'lane', 'mawatha', 'ave', 'avenue', 'place', 'sri', 'lanka']);
  return norm.split(' ').filter(w => w.length > 2 && !stopWords.has(w));
}

/**
 * Determines whether the property address and utility bill address match.
 * 
 * @param {string} propertyAddress - The address entered for the property
 * @param {string} billAddress - The address extracted from the utility bill (or auto-detected via OCR)
 * @returns {{ isMatch: boolean, score: number, details: string }}
 */
export function compareAddresses(propertyAddress, billAddress) {
  const pNorm = normalizeAddress(propertyAddress);
  const bNorm = normalizeAddress(billAddress);

  if (!pNorm || !bNorm) {
    return { isMatch: false, score: 0, details: 'Address information missing' };
  }

  // Exact or containment match
  if (pNorm === bNorm || pNorm.includes(bNorm) || bNorm.includes(pNorm)) {
    return { isMatch: true, score: 100, details: 'Exact / Full address match' };
  }

  const pTokens = getAddressTokens(propertyAddress);
  const bTokens = getAddressTokens(billAddress);

  if (pTokens.length === 0 || bTokens.length === 0) {
    return { isMatch: false, score: 0, details: 'Insufficient tokens to verify' };
  }

  let matchingTokens = 0;
  for (const pt of pTokens) {
    if (bTokens.some(bt => bt === pt || bt.includes(pt) || pt.includes(bt))) {
      matchingTokens++;
    }
  }

  const ratio = matchingTokens / Math.min(pTokens.length, bTokens.length);
  const isMatch = ratio >= 0.5 || matchingTokens >= 2;

  return {
    isMatch,
    score: Math.round(ratio * 100),
    details: isMatch 
      ? `High confidence match (${matchingTokens} key area/street tokens matched)`
      : `Mismatch detected (${matchingTokens} of ${pTokens.length} tokens matched)`
  };
}

/**
 * Comprehensive verification status evaluation for a property.
 * Evaluates utility bill attachment, document address, and matches with property address.
 *
 * @param {object} property
 * @returns {{
 *   hasBill: boolean,
 *   billUrl: string | null,
 *   propertyAddress: string,
 *   billAddress: string,
 *   accountNo: string,
 *   utilityProvider: string,
 *   isVerified: boolean,
 *   matchScore: number,
 *   matchDetails: string,
 *   statusLabel: 'Verified' | 'Address Mismatch' | 'No Bill Attached',
 *   statusBadgeVariant: 'success' | 'danger' | 'warning' | 'default'
 * }}
 */
export function evaluatePropertyVerification(property) {
  if (!property) {
    return {
      hasBill: false,
      billUrl: null,
      propertyAddress: '',
      billAddress: '',
      accountNo: '',
      utilityProvider: '',
      isVerified: false,
      matchScore: 0,
      matchDetails: 'No property provided',
      statusLabel: 'No Bill Attached',
      statusBadgeVariant: 'default'
    };
  }

  const propAddress = property.address || property.Address || property.city || '';
  
  // Find utility bill URL
  let billUrl = property.utilityBillUrl || null;
  if (!billUrl && Array.isArray(property.documents)) {
    const doc = property.documents.find(d => d?.documentType === 'UtilityBill' || d?.documentType === 'OwnershipProof');
    if (doc?.documentUrl) billUrl = doc.documentUrl;
  }

  // Handle Admin Manual Approval / Verification Override
  if (property.adminManuallyVerified || property.isManuallyApproved) {
    return {
      hasBill: Boolean(billUrl),
      billUrl: billUrl || null,
      propertyAddress: propAddress,
      billAddress: billUrl ? (property.utilityBillAddress || propAddress) : 'Manually Approved by Administrator',
      accountNo: property.utilityBillAccountNo || 'ADMIN-APPROVED',
      utilityProvider: property.utilityProvider || 'Admin Manual Review',
      isVerified: true,
      isManuallyVerified: true,
      matchScore: 100,
      matchDetails: property.manualVerificationNote || 'Listing manually reviewed and verified by Administrator',
      statusLabel: 'Admin Verified',
      statusBadgeVariant: 'success'
    };
  }

  if (!billUrl) {
    return {
      hasBill: false,
      billUrl: null,
      propertyAddress: propAddress,
      billAddress: '',
      accountNo: '',
      utilityProvider: '',
      isVerified: false,
      matchScore: 0,
      matchDetails: 'No utility bill proof attached to listing',
      statusLabel: 'No Bill Attached',
      statusBadgeVariant: 'default'
    };
  }

  // Determine OCR extracted address:
  // 1. Explicitly recorded utilityBillAddress on property
  // 2. Or matched against known mock/sample bills
  // 3. Or if uploaded/attached, default to matching the property address (verified proof)
  let extractedAddress = property.utilityBillAddress || '';
  let accountNo = property.utilityBillAccountNo || 'CEB-084-992147-9';
  let utilityProvider = property.utilityProvider || 'Ceylon Electricity Board (CEB)';

  if (!extractedAddress) {
    const known = KNOWN_BILL_ADDRESS_MAP.find(k => k.pattern.test(billUrl));
    if (known) {
      extractedAddress = known.detectedAddress;
      accountNo = known.accountNo;
      utilityProvider = known.utilityProvider;
    } else {
      // For user-uploaded bill files in this demo, simulate OCR extracting a specific address
      // This allows demonstrating both match and mismatch states based on what the user types in the form.
      extractedAddress = 'No 25 Temple Road, Piliyandala';
    }
  }

  const comparison = compareAddresses(propAddress, extractedAddress);

  if (comparison.isMatch) {
    return {
      hasBill: true,
      billUrl,
      propertyAddress: propAddress,
      billAddress: extractedAddress,
      accountNo,
      utilityProvider,
      isVerified: true,
      matchScore: comparison.score,
      matchDetails: comparison.details,
      statusLabel: 'Verified',
      statusBadgeVariant: 'success'
    };
  } else {
    return {
      hasBill: true,
      billUrl,
      propertyAddress: propAddress,
      billAddress: extractedAddress,
      accountNo,
      utilityProvider,
      isVerified: false,
      matchScore: comparison.score,
      matchDetails: comparison.details,
      statusLabel: 'Address Mismatch',
      statusBadgeVariant: 'danger'
    };
  }
}

