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

// Verification badges use persisted backend decisions, never sample OCR data.
export function evaluatePropertyVerification(property) {
  const prop = property || {};
  const address = prop.address || prop.Address || prop.city || '';
  const documents = prop.documents || prop.Documents || [];
  const proofDocuments = documents.filter(d => /utilitybill|proof|deed/i.test(d.documentType || d.DocumentType || ''));
  const latestDocument = [...proofDocuments].sort((a, b) =>
    Date.parse(b.createdAt || b.CreatedAt || 0) - Date.parse(a.createdAt || a.CreatedAt || 0))[0];
  const billUrl = latestDocument?.documentUrl || latestDocument?.DocumentUrl || prop.utilityBillUrl || null;
  const base = {
    hasBill: Boolean(billUrl), billUrl, propertyAddress: address,
    billAddress: '', accountNo: '', utilityProvider: '',
    isVerified: false, isManuallyVerified: false, matchScore: null,
    matchDetails: billUrl ? 'Proof submitted. Verification is pending.' : 'No ownership proof attached.',
    statusLabel: billUrl ? 'Pending Verification' : 'No Bill Attached',
    statusBadgeVariant: billUrl ? 'warning' : 'default'
  };
  const records = [...(prop.verificationRecords || prop.VerificationRecords || prop.verifications || [])]
    .sort((a, b) => Date.parse(b.createdAt || b.CreatedAt || 0) - Date.parse(a.createdAt || a.CreatedAt || 0));
  const status = prop.status ?? prop.Status;
  const active = status === 'Active' || status === 1;
  const record = records.find(r => {
    const comments = r.comments || r.Comments || '';
    return comments.startsWith('[AI_PROPERTY_VERIFICATION]') ||
      r.adminId || r.AdminId || comments.startsWith('[REJECTED:') ||
      (r.agentReport || r.AgentReport || '').startsWith('Approved by Admin');
  });
  if (!record) return base;

  const raw = record.agentReport || record.AgentReport || '';
  if (!(record.comments || record.Comments || '').startsWith('[AI_PROPERTY_VERIFICATION]')) {
    const approved = active && (record.isApproved ?? record.IsApproved) === true;
    return { ...base, isVerified: approved, isManuallyVerified: approved,
      matchDetails: record.comments || record.Comments || raw,
      statusLabel: approved ? 'Admin Verified' : 'Needs Review',
      statusBadgeVariant: approved ? 'success' : 'warning' };
  }

  let report;
  try { report = JSON.parse(raw); } catch { return base; }
  if (!report || typeof report !== 'object') return base;
  // An old approval must not verify an edited address or a replacement proof.
  if (normalizeAddress(report.propertyAddress) !== normalizeAddress(address) ||
      !proofDocuments.some(d => (d.documentUrl || d.DocumentUrl) === report.documentUrl) ||
      (latestDocument && Date.parse(latestDocument.createdAt || latestDocument.CreatedAt) >
        Date.parse(record.createdAt || record.CreatedAt))) return base;
  const recommendation = report.recommendation;
  if (!['Approve-ready', 'Needs Review', 'Reject-recommended'].includes(recommendation)) return base;
  const approved = active && recommendation === 'Approve-ready';
  return { ...base, billUrl: report.documentUrl, hasBill: true,
    isVerified: approved, recommendation,
    billAddress: typeof report.billAddress === 'string' ? report.billAddress : '',
    accountNo: typeof report.accountNo === 'string' ? report.accountNo : '',
    utilityProvider: typeof report.utilityProvider === 'string' ? report.utilityProvider : '',
    matchDetails: report.reasoning || 'Administrator review is required.',
    statusLabel: approved ? 'Verified' : recommendation === 'Reject-recommended' ? 'Review Recommended' : 'Needs Review',
    statusBadgeVariant: approved ? 'success' : recommendation === 'Reject-recommended' ? 'danger' : 'warning' };
}
