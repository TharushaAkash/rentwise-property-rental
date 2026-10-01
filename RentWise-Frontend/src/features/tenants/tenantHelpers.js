const FALLBACK_RENTAL_PHOTOS = [
  'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1600566753376-12c8ab7fb75b?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1613977257363-707ba9348227?auto=format&fit=crop&w=800&q=80'
];

export const extractPropertyPhoto = (p, fallbackIndex = 0) => {
  if (!p) return FALLBACK_RENTAL_PHOTOS[Math.abs(fallbackIndex) % FALLBACK_RENTAL_PHOTOS.length];
  if (typeof p === 'string' && (p.startsWith('http') || p.startsWith('/'))) return p;
  if (p.photoUrl && typeof p.photoUrl === 'string') return p.photoUrl;
  if (p.PhotoUrl && typeof p.PhotoUrl === 'string') return p.PhotoUrl;
  if (p.propertyPhoto && typeof p.propertyPhoto === 'string') return p.propertyPhoto;
  const photoList = p.photos || p.Photos;
  if (Array.isArray(photoList) && photoList.length > 0) {
    const primary = photoList.find((ph) => ph && (ph.isPrimary || ph.IsPrimary));
    const chosen = primary || photoList[0];
    const url = chosen?.photoUrl || chosen?.PhotoUrl || chosen?.url;
    if (url) return url;
  }
  return FALLBACK_RENTAL_PHOTOS[Math.abs(fallbackIndex) % FALLBACK_RENTAL_PHOTOS.length];
};

export const money = (value) => `Rs. ${Number(value || 0).toLocaleString()}`;

export const parseBookingDetails = (rawMessage) => {
  if (!rawMessage) return { duration: null, startDate: null, endDate: null, note: '' };
  const durationMatch = rawMessage.match(/Duration:\s*(\d+)\s*months/i);
  const startMatch = rawMessage.match(/Start:\s*(\d{4}-\d{2}-\d{2})/i);
  const endMatch = rawMessage.match(/End:\s*(\d{4}-\d{2}-\d{2})/i);
  const noteMatch = rawMessage.match(/Note:\s*(.*)$/i);

  const duration = durationMatch ? `${durationMatch[1]} Months` : null;
  const startDate = startMatch ? startMatch[1] : null;
  const endDate = endMatch ? endMatch[1] : null;
  const note = noteMatch ? noteMatch[1].trim() : (!durationMatch ? rawMessage : '');

  return { duration, startDate, endDate, note };
};

export const formatLankaPrice = (amount) => {
  const num = Number(amount || 0);
  if (num >= 1000000) {
    const m = num / 1000000;
    return `Rs. ${m % 1 === 0 ? m.toFixed(0) : m.toFixed(2)}M`;
  }
  return `Rs. ${num.toLocaleString()}`;
};

