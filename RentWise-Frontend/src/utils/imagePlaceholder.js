// Reliable placeholder image when an image fails to load
export const PROPERTY_PLACEHOLDER_IMAGE = 
  'https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=1200&q=80';

export const PROPERTY_FALLBACK_SVG = 
  "data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22800%22%20height%3D%22600%22%20viewBox%3D%220%200%20800%20600%22%3E%3Crect%20fill%3D%22%23f8fafc%22%20width%3D%22800%22%20height%3D%22600%22%2F%3E%3Cg%20stroke%3D%22%2394a3b8%22%20stroke-width%3D%224%22%20fill%3D%22none%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M400%20220%20L280%20320%20H320%20V420%20H480%20V320%20H520%20Z%22%2F%3E%3Ccircle%20cx%3D%22400%22%20cy%3D%22300%22%20r%3D%2220%22%2F%3E%3C%2Fg%3E%3Ctext%20x%3D%22400%22%20y%3D%22460%22%20font-family%3D%22sans-serif%22%20font-size%3D%2218%22%20font-weight%3D%22700%22%20fill%3D%22%2364748b%22%20text-anchor%3D%22middle%22%3ERentWise%20Listing%3C%2Ftext%3E%3Ctext%20x%3D%22400%22%20y%3D%22490%22%20font-family%3D%22sans-serif%22%20font-size%3D%2213%22%20font-weight%3D%22500%22%20fill%3D%22%2394a3b8%22%20text-anchor%3D%22middle%22%3EPhoto%20Temporarily%20Unavailable%3C%2Ftext%3E%3C%2Fsvg%3E";

export const handleImageError = (e) => {
  if (!e?.currentTarget) return;
  e.currentTarget.onerror = null;
  e.currentTarget.src = PROPERTY_FALLBACK_SVG;
};


