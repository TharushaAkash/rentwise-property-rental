import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Search, 
  Sparkles, 
  SlidersHorizontal, 
  Home, 
  CreditCard, 
  Wrench, 
  UserRound, 
  CalendarDays, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  MapPin, 
  ArrowRight, 
  Building2, 
  Receipt, 
  ShieldCheck, 
  Plus, 
  Mail, 
  Phone, 
  ChevronRight, 
  FileText, 
  User, 
  Lock, 
  Eye, 
  EyeOff,
  Star,
  Camera,
  Share2,
  Bell,
  Bookmark,
  X,
  Sliders,
  ChevronLeft
} from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { BookingModal } from './BookingModal';
import { PaymentModal } from './PaymentModal';
import { PROPERTY_PLACEHOLDER_IMAGE, handleImageError } from '../../utils/imagePlaceholder';

const money = (value) => `Rs. ${Number(value || 0).toLocaleString()}`;

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

const formatLankaPrice = (amount) => {
  const num = Number(amount || 0);
  if (num >= 1000000) {
    const m = num / 1000000;
    return `Rs. ${m % 1 === 0 ? m.toFixed(0) : m.toFixed(2)}M`;
  }
  return `Rs. ${num.toLocaleString()}`;
};

export const TenantPropertyPortal = () => {
  const navigate = useNavigate();
  const [dbProperties, setDbProperties] = useState([]);
  const [selectedPropertyForBooking, setSelectedPropertyForBooking] = useState(null);
  const [query, setQuery] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [maxRent, setMaxRent] = useState('');
  const [bedrooms, setBedrooms] = useState('');
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiMatches, setAiMatches] = useState(null);
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [message, setMessage] = useState('');

  // Local Storage Saved/Favorite Properties
  const [savedIds, setSavedIds] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('rentwise_saved_properties') || '[]');
    } catch {
      return [];
    }
  });

  const toggleSave = (propId, e) => {
    e?.stopPropagation();
    setSavedIds((prev) => {
      const next = prev.includes(propId) ? prev.filter((id) => id !== propId) : [...prev, propId];
      try {
        localStorage.setItem('rentwise_saved_properties', JSON.stringify(next));
      } catch (err) {
        console.error('Failed to save to localStorage:', err);
      }
      return next;
    });
  };

  useEffect(() => {
    api.get('/properties')
      .then((response) => setDbProperties(response.data || []))
      .catch(() => setMessage('Unable to load server property listings.'))
      .finally(() => setLoading(false));
  }, []);

  // Map ONLY real database properties
  const realProperties = useMemo(() => {
    return dbProperties.map((p) => {
      const primaryPhoto = p.photos && Array.isArray(p.photos) && p.photos.length > 0 
        ? (p.photos.find((ph) => ph.isPrimary || ph.IsPrimary)?.photoUrl || 
           p.photos.find((ph) => ph.isPrimary || ph.IsPrimary)?.PhotoUrl || 
           p.photos[0]?.photoUrl || 
           p.photos[0]?.PhotoUrl || 
           p.photos[0]?.url)
        : (p.photoUrl || p.PhotoUrl || PROPERTY_PLACEHOLDER_IMAGE);

      return {
        ...p,
        city: p.city || p.address?.split(',').pop()?.trim() || 'Colombo',
        propertyType: p.propertyType || (p.title?.toLowerCase().includes('apartment') ? 'Apartment' : 'House'),
        photosCount: p.photos?.length || (primaryPhoto && primaryPhoto !== PROPERTY_PLACEHOLDER_IMAGE ? 1 : 0),
        photoUrl: primaryPhoto,
        photos: p.photos || [],
        sqft: p.sqft || (p.bedrooms ? p.bedrooms * 750 + 500 : 1200),
        featureTag: p.facilities?.split(',')[0]?.trim() || (p.status || 'Verified Listing'),
        isUrgent: p.status === 'Urgent' || Boolean(p.isUrgent)
      };
    });
  }, [dbProperties]);

  const filtered = useMemo(() => {
    const source = aiMatches || realProperties;
    return source.filter((property) => {
      const text = `${property.title} ${property.address} ${property.city || ''} ${property.facilities || ''}`.toLowerCase();
      const matchesQuery = !query || text.includes(query.toLowerCase());
      const matchesType = !selectedType || (property.propertyType && property.propertyType.toLowerCase() === selectedType.toLowerCase()) || text.includes(selectedType.toLowerCase());
      const matchesCity = !selectedCity || (property.city && property.city.toLowerCase().includes(selectedCity.toLowerCase())) || text.includes(selectedCity.toLowerCase());
      const matchesRent = !maxRent || Number(property.monthlyRent) <= Number(maxRent);
      const matchesBeds = !bedrooms || Number(property.bedrooms) >= Number(bedrooms);

      return matchesQuery && matchesType && matchesCity && matchesRent && matchesBeds;
    });
  }, [realProperties, aiMatches, query, selectedType, selectedCity, maxRent, bedrooms]);

  const resetAllFilters = () => {
    setQuery('');
    setSelectedType('');
    setSelectedCity('');
    setMaxRent('');
    setBedrooms('');
    setAiMatches(null);
  };

  const askAi = async (event) => {
    event.preventDefault();
    if (!aiPrompt.trim()) return;
    setAiLoading(true);
    setMessage('');
    try {
      const response = await api.post('/agents/matching/search', { objective: aiPrompt.trim() });
      const matches = response.data?.result?.matches || response.data?.matches || [];
      setAiMatches(matches.map((match) => match.property || match));
      setMessage(`AI found ${matches.length} matching properties.`);
    } catch (error) {
      setMessage(error.response?.data || 'AI search could not be completed.');
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="font-sans space-y-6 pb-16">
      
      {/* 1. LankaPropertyWeb Style Segmented Quick Search Bar */}
      <section className="bg-white border-b border-gray-200 py-5 px-3 sm:px-6 -mx-4 sm:-mx-8 lg:-mx-12 shadow-sm">
        <div className="mx-auto max-w-6xl">
          <div className="rounded-lg bg-white shadow-md border border-gray-300 flex flex-col md:flex-row md:items-stretch divide-y md:divide-y-0 md:divide-x divide-gray-200">
            {/* City or Location */}
            <div className="flex flex-1 items-center gap-2.5 px-3.5 py-2.5 bg-white rounded-t-lg md:rounded-l-lg md:rounded-tr-none">
              <MapPin className="h-4 w-4 text-[#008037] shrink-0" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full bg-transparent text-gray-900 outline-none text-xs sm:text-sm font-medium placeholder-gray-400"
                placeholder="City or Location (e.g. Colombo, Kandy, Negombo)..."
              />
            </div>

            {/* Select Radius / City */}
            <div className="flex items-center px-3 py-2 bg-white">
              <select
                value={selectedCity}
                onChange={(e) => setSelectedCity(e.target.value)}
                className="w-full bg-transparent text-xs sm:text-sm text-gray-700 font-medium outline-none cursor-pointer"
              >
                <option value="">Select Radius / Area</option>
                <option value="Colombo">Colombo (within 10 km)</option>
                <option value="Kandy">Kandy & Suburbs</option>
                <option value="Negombo">Negombo</option>
                <option value="Panadura">Panadura</option>
                <option value="Nugegoda">Nugegoda</option>
                <option value="Battaramulla">Battaramulla</option>
                <option value="Rajagiriya">Rajagiriya</option>
                <option value="Pelawatte">Pelawatte</option>
                <option value="Nawala">Nawala</option>
                <option value="Galle">Galle</option>
              </select>
            </div>

            {/* Property Type */}
            <div className="flex items-center px-3 py-2 bg-white">
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="w-full bg-transparent text-xs sm:text-sm text-gray-700 font-medium outline-none cursor-pointer"
              >
                <option value="">All Property Types</option>
                <option value="House">House</option>
                <option value="Apartment">Apartment</option>
                <option value="Commercial">Commercial</option>
                <option value="Villa">Villa</option>
                <option value="Annex">Annex</option>
                <option value="Studio">Studio</option>
              </select>
            </div>

            {/* Price Range */}
            <div className="flex items-center px-3 py-2 bg-white min-w-[140px]">
              <input
                value={maxRent}
                onChange={(e) => setMaxRent(e.target.value)}
                type="number"
                className="w-full bg-transparent text-xs sm:text-sm text-gray-700 font-medium outline-none placeholder-gray-400"
                placeholder="Price Range (Rs.)"
              />
            </div>

            {/* Bedrooms */}
            <div className="flex items-center px-3 py-2 bg-white">
              <select
                value={bedrooms}
                onChange={(e) => setBedrooms(e.target.value)}
                className="w-full bg-transparent text-xs sm:text-sm text-gray-700 font-medium outline-none cursor-pointer"
              >
                <option value="">Beds</option>
                <option value="1">1+ Bed</option>
                <option value="2">2+ Beds</option>
                <option value="3">3+ Beds</option>
                <option value="4">4+ Beds</option>
                <option value="5">5+ Beds</option>
              </select>
            </div>

            {/* Search Button (Vivid LankaPropertyWeb Orange #ff5a00) */}
            <div className="p-1.5 bg-white rounded-b-lg md:rounded-r-lg md:rounded-bl-none flex items-center justify-center">
              <button
                onClick={() => document.getElementById('listings')?.scrollIntoView({ behavior: 'smooth' })}
                className="w-full md:w-auto rounded bg-[#ff5a00] hover:bg-[#e04f00] px-7 py-2.5 text-xs sm:text-sm font-bold uppercase tracking-wider text-white transition-all shadow-sm active:scale-95 flex items-center justify-center gap-2"
              >
                <Search className="w-4 h-4" />
                <span>Search</span>
              </button>
            </div>
          </div>

          {/* Active Filter Tags */}
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            {selectedType && (
              <span className="inline-flex items-center gap-1.5 rounded bg-gray-100 border border-gray-300 px-2.5 py-1 font-semibold text-gray-800">
                <span>{selectedType}</span>
                <button
                  type="button"
                  onClick={() => setSelectedType('')}
                  className="text-gray-400 hover:text-gray-700 font-bold"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            )}

            {selectedCity && (
              <span className="inline-flex items-center gap-1.5 rounded bg-gray-100 border border-gray-300 px-2.5 py-1 font-semibold text-gray-800">
                <span>{selectedCity}</span>
                <button
                  type="button"
                  onClick={() => setSelectedCity('')}
                  className="text-gray-400 hover:text-gray-700 font-bold"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            )}

            {query && (
              <span className="inline-flex items-center gap-1.5 rounded bg-gray-100 border border-gray-300 px-2.5 py-1 font-semibold text-gray-800">
                <span>"{query}"</span>
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="text-gray-400 hover:text-gray-700 font-bold"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            )}

            {(selectedType || selectedCity || query || maxRent || bedrooms) && (
              <button
                type="button"
                onClick={resetAllFilters}
                className="text-[11px] font-bold text-[#0066cc] hover:underline uppercase tracking-wide ml-1"
              >
                RESET ALL
              </button>
            )}
          </div>
        </div>
      </section>

      {/* 2. Breadcrumbs, Header Title, and Actions Toolbar */}
      <div className="space-y-3 pt-2">
        <div className="text-[11.5px] text-gray-500 flex items-center gap-1">
          <button onClick={() => navigate('/properties')} className="hover:text-[#008037]">Home</button>
          <span>&gt;</span>
          <button onClick={() => navigate('/agreements')} className="hover:text-[#008037]">Rentals</button>
          <span>&gt;</span>
          <span className="text-gray-800 font-medium">{selectedType || 'Houses'}</span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-200 pb-3">
          <div>
            <h1 className="text-lg sm:text-xl font-extrabold text-gray-900 tracking-tight">
              {selectedType ? `${selectedType}s` : 'Houses and Properties'} for rent in Sri Lanka{' '}
              <span className="text-gray-500 font-normal text-sm">
                ({filtered.length} properties)
              </span>
            </h1>
          </div>

          {/* Action Pills & Pagination */}
          <div className="flex items-center gap-2 text-xs">
            <button
              onClick={() => setMessage('Search filters saved to your account.')}
              className="inline-flex items-center gap-1 border border-gray-300 rounded px-2.5 py-1 text-gray-700 hover:bg-gray-50 font-medium"
            >
              <Bookmark className="w-3.5 h-3.5 text-gray-500" />
              <span>Save Search</span>
            </button>
            <button
              onClick={() => {
                if (navigator.clipboard) {
                  navigator.clipboard.writeText(window.location.href);
                  setMessage('Property search link copied to clipboard!');
                }
              }}
              className="inline-flex items-center gap-1 border border-gray-300 rounded px-2.5 py-1 text-gray-700 hover:bg-gray-50 font-medium"
            >
              <Share2 className="w-3.5 h-3.5 text-gray-500" />
              <span>Share</span>
            </button>

            {/* Pagination numbers */}
            <div className="hidden sm:flex items-center gap-1 ml-2">
              <span className="w-6 h-6 rounded bg-[#008037] text-white font-bold flex items-center justify-center text-xs shadow-sm">
                1
              </span>
              <span className="w-6 h-6 rounded border border-gray-200 text-gray-600 font-medium flex items-center justify-center text-xs hover:bg-gray-50 cursor-pointer">
                2
              </span>
              <span className="w-6 h-6 rounded border border-gray-200 text-gray-600 font-medium flex items-center justify-center text-xs hover:bg-gray-50 cursor-pointer">
                3
              </span>
              <span className="w-6 h-6 rounded border border-gray-200 text-gray-600 font-medium flex items-center justify-center text-xs hover:bg-gray-50 cursor-pointer">
                &gt;
              </span>
            </div>
          </div>
        </div>

        {/* Quick Filter Pills Row 1: Property Types */}
        <div className="flex flex-wrap items-center gap-2 text-xs pt-1">
          <span className="text-gray-500 font-semibold text-[11px] uppercase mr-1">Add to search:</span>
          {[
            { label: '+ Apartments', val: 'Apartment' },
            { label: '+ Houses', val: 'House' },
            { label: '+ Commercial', val: 'Commercial' },
            { label: '+ Villas', val: 'Villa' },
            { label: '+ Rooms', val: 'Room' },
            { label: '+ Studios', val: 'Studio' }
          ].map((pill) => {
            const count = realProperties.filter((p) => 
              (p.propertyType && p.propertyType.toLowerCase() === pill.val.toLowerCase()) || 
              (p.title && p.title.toLowerCase().includes(pill.val.toLowerCase()))
            ).length;

            return (
              <button
                key={pill.val}
                type="button"
                onClick={() => setSelectedType(selectedType === pill.val ? '' : pill.val)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-all ${
                  selectedType === pill.val
                    ? 'border-[#008037] bg-emerald-50 text-[#008037] font-bold shadow-xs'
                    : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400 hover:bg-gray-50'
                }`}
              >
                <span>{pill.label}</span>
                {count > 0 && <span className="ml-1 text-[11px] font-bold text-emerald-700">({count})</span>}
              </button>
            );
          })}
        </div>

        {/* Quick Filter Pills Row 2: Top Sri Lankan Cities */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-gray-500 font-semibold text-[11px] uppercase mr-1">Try Cities:</span>
          {['Colombo', 'Dehiwala', 'Nugegoda', 'Kandy', 'Rajagiriya', 'Battaramulla', 'Negombo', 'Galle'].map((cityName) => (
            <button
              key={cityName}
              type="button"
              onClick={() => setSelectedCity(cityName)}
              className={`rounded-full border px-3 py-0.5 text-xs font-medium transition-all ${
                selectedCity === cityName
                  ? 'border-[#008037] bg-emerald-50 text-[#008037] font-bold shadow-xs'
                  : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400 hover:bg-gray-50'
              }`}
            >
              {cityName}
            </button>
          ))}
        </div>
      </div>

      {message && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-bold text-emerald-800 flex items-center justify-between shadow-xs">
          <span>{message}</span>
          <button onClick={() => setMessage('')} className="text-emerald-700 font-bold ml-2">✕</button>
        </div>
      )}

      {/* 3. Main Content: 3-Column LankaPropertyWeb Card Grid + Right Sidebar */}
      <div id="listings" className="flex flex-col lg:flex-row gap-6 items-start">
        
        {/* Left Side: Property Listings Cards */}
        <div className="flex-1 min-w-0">
          {loading ? (
            <div className="py-24 text-center text-gray-500 font-medium">
              Loading verified property catalog...
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 p-16 text-center text-gray-500 bg-white">
              <p className="font-bold text-gray-700 text-base">
                {dbProperties.length === 0 ? 'No Properties Added Yet' : 'No properties match your current search.'}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {dbProperties.length === 0 
                  ? 'Real properties created in the system will appear here.'
                  : 'Try resetting your filters or clearing search criteria.'}
              </p>
              {dbProperties.length > 0 && (
                <button
                  onClick={resetAllFilters}
                  className="mt-4 rounded bg-[#ff5a00] hover:bg-[#e04f00] px-5 py-2 text-xs font-bold text-white shadow-sm cursor-pointer"
                >
                  Reset All Filters
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
              {filtered.map((property, index) => {
                const isSaved = savedIds.includes(property.id);

                return (
                  <React.Fragment key={property.id}>
                    {index === 9 && (
                      <div className="col-span-1 sm:col-span-2 xl:col-span-3 rounded-lg border border-gray-200 bg-white p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4 my-2">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xl">
                            👤
                          </div>
                          <div>
                            <span className="text-xs sm:text-sm font-bold text-gray-900 block">
                              Verified Tenant Services &amp; Exclusive Inquiries
                            </span>
                            <span className="text-xs text-gray-500">
                              Direct owner contact, lease agreement drafting, and instant viewing scheduling.
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2.5 shrink-0">
                          <button
                            onClick={() => navigate('/agreements')}
                            className="px-5 py-2 rounded bg-[#008037] hover:bg-[#00662c] text-white text-xs font-bold uppercase tracking-wider shadow-xs transition-all cursor-pointer"
                          >
                            My Agreements
                          </button>
                        </div>
                      </div>
                    )}
                    <div
                      onClick={() => navigate(`/properties/${property.id}`, { state: { property } })}
                      className="rounded-lg bg-white border border-gray-200 overflow-hidden shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between group cursor-pointer"
                    >
                    {/* Property Image & Overlay Badges */}
                    <div>
                      <div className="relative h-52 sm:h-56 bg-gray-100 overflow-hidden">
                        <img
                          src={property.photoUrl}
                          alt={property.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 cursor-pointer"
                          onClick={() => navigate(`/properties/${property.id}`, { state: { property } })}
                          onError={handleImageError}
                        />

                        {/* Top-Left: Photos Count Badge */}
                        <div className="absolute top-2.5 left-2.5 bg-black/65 backdrop-blur-xs text-white text-[11px] font-bold px-2 py-0.5 rounded flex items-center gap-1 shadow-xs">
                          <Camera className="w-3 h-3" />
                          <span>{property.photosCount > 0 ? property.photosCount : 1}</span>
                        </div>

                        {/* Top-Right: Urgent Badge (if urgent) */}
                        {property.isUrgent && (
                          <div className="absolute top-2.5 right-2.5 bg-[#b91c1c] text-white text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded shadow-sm animate-pulse">
                            URGENT
                          </div>
                        )}

                        {/* Bottom-Right: City / Area Location Chip */}
                        <div className="absolute bottom-2.5 right-2.5 bg-black/75 backdrop-blur-xs text-white text-xs font-bold px-2.5 py-0.5 rounded shadow-xs">
                          {property.city || 'Colombo'}
                        </div>
                      </div>

                      {/* Specs Row: Beds, Sqft, Type, Star */}
                      <div className="flex items-center justify-between px-3.5 pt-3">
                        <div className="flex items-center gap-2 text-xs font-semibold text-gray-700">
                          <span className="flex items-center gap-1">
                            <span>🛏️</span>
                            <span>{property.bedrooms || 3}</span>
                          </span>
                          <span className="text-gray-300">•</span>
                          <span className="flex items-center gap-1">
                            <span>📐</span>
                            <span>{property.sqft ? `${Number(property.sqft).toLocaleString()} sqft` : `${(property.bedrooms || 3) * 800} sqft`}</span>
                          </span>
                          <span className="ml-1 inline-block border border-[#008037] text-[#008037] text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50/40">
                            {property.propertyType || 'House'}
                          </span>
                        </div>

                        {/* Star Favorite Toggle */}
                        <button
                          type="button"
                          onClick={(e) => toggleSave(property.id, e)}
                          title={isSaved ? 'Remove from saved' : 'Save this property'}
                          className="p-1 text-gray-400 hover:text-amber-500 transition-colors"
                        >
                          <Star
                            className={`w-4 h-4 ${
                              isSaved ? 'fill-amber-400 text-amber-400' : 'text-gray-400 hover:text-amber-400'
                            }`}
                          />
                        </button>
                      </div>

                      {/* Price Row (Bold Vibrant Green) */}
                      <div className="px-3.5 pt-1.5 flex items-baseline gap-1">
                        <span className="text-xl sm:text-2xl font-black text-[#008037] tracking-tight">
                          {formatLankaPrice(property.monthlyRent)}
                        </span>
                        <span className="text-xs text-gray-500 font-medium">Per Month</span>
                      </div>

                      {/* Property Title (Blue, Clickable) */}
                      <div className="px-3.5 pt-1">
                        <h3
                          onClick={() => navigate(`/properties/${property.id}`, { state: { property } })}
                          className="text-sm font-bold text-[#0066cc] hover:underline cursor-pointer line-clamp-2 leading-snug"
                        >
                          {property.title}
                        </h3>
                      </div>

                      {/* Address with Pin Icon */}
                      <div className="px-3.5 pt-1 flex items-center gap-1 text-xs text-gray-800 font-semibold truncate">
                        <MapPin className="w-3.5 h-3.5 text-gray-900 shrink-0" />
                        <span className="truncate">{property.address}</span>
                      </div>

                      {/* Description Snippet */}
                      <div className="px-3.5 pt-1 text-[11px] text-gray-500 line-clamp-2 leading-relaxed">
                        {property.description}
                        <span
                          onClick={() => navigate(`/properties/${property.id}`, { state: { property } })}
                          className="text-[#0066cc] font-bold hover:underline cursor-pointer ml-1"
                        >
                          more &gt;
                        </span>
                      </div>
                    </div>

                    {/* Card Footer: Feature Bullet & Book Now CTA */}
                    <div className="px-3.5 py-2.5 mt-3 border-t border-gray-100 flex items-center justify-between text-xs bg-gray-50/50">
                      <div className="text-[11px] font-bold text-emerald-700 flex items-center gap-1 truncate max-w-[140px]">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 inline-block shrink-0" />
                        <span className="truncate">{property.featureTag || 'Luxury Specs'}</span>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/properties/${property.id}?book=true`, { state: { property } });
                        }}
                        className="bg-[#ff5a00] hover:bg-[#e04f00] text-white text-xs font-bold px-3 py-1.5 rounded shadow-xs transition-all active:scale-95 cursor-pointer"
                      >
                        View & Book
                      </button>
                    </div>
                    </div>
                  </React.Fragment>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Sidebar: Featured Projects, Other Top Cities, Top Searches */}
        <div className="w-full lg:w-80 shrink-0 space-y-6">
          
          {/* Featured Projects Card */}
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-xs">
            <div className="flex items-center justify-between border-b border-gray-100 pb-2 mb-3">
              <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                Featured Projects
              </h4>
            </div>
            <div className="relative rounded-lg overflow-hidden border border-gray-100 bg-slate-900 text-white group">
              <img
                src="https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=800&q=80"
                alt="Park Road Residencies"
                className="w-full h-44 object-cover opacity-90 group-hover:scale-105 transition-transform duration-300"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent p-3 flex flex-col justify-end">
                <span className="text-[10px] uppercase font-bold text-amber-400">Luxury Apartments</span>
                <h5 className="text-sm font-black text-white">Park Road Residencies</h5>
                <p className="text-[11px] text-gray-300">Havelock Town, Colombo 5</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => { setSelectedCity('Colombo'); document.getElementById('listings')?.scrollIntoView({ behavior: 'smooth' }); }}
              className="mt-3 w-full py-1.5 text-xs font-bold text-[#008037] border border-[#008037] rounded hover:bg-emerald-50 transition-colors text-center"
            >
              Find out more &rarr;
            </button>
          </div>

          {/* Other Top Cities Card */}
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-xs">
            <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider border-b border-gray-100 pb-2 mb-3">
              Other Top Cities
            </h4>
            <div className="grid grid-cols-2 gap-y-2 gap-x-3 text-xs">
              {[
                'Nawala', 'Negombo',
                'Maharagama', 'Battaramulla',
                'Mount Lavinia', 'Malabe',
                'Hanwella', 'Kelaniya',
                'Piliyandala', 'Galle'
              ].map((city) => (
                <button
                  key={city}
                  type="button"
                  onClick={() => { setSelectedCity(city); document.getElementById('listings')?.scrollIntoView({ behavior: 'smooth' }); }}
                  className="text-left text-gray-700 hover:text-[#008037] hover:underline font-medium truncate"
                >
                  {city}
                </button>
              ))}
            </div>
          </div>

          {/* Banner: GET 2X MORE VIEWS MORE LEADS */}
          <div className="rounded-lg overflow-hidden bg-gradient-to-r from-sky-600 to-blue-700 p-4 text-white shadow-sm flex flex-col justify-between">
            <div className="text-xs font-black tracking-wider uppercase text-sky-200">Exclusive Advertiser</div>
            <div className="text-base font-black leading-tight mt-1">GET 2X MORE VIEWS MORE LEADS</div>
            <p className="text-[11px] text-sky-100 mt-1">Post your property advertisement on RentWise PropertyWeb today.</p>
            <button
              onClick={() => setMessage('Advertising portal will launch soon for agency partners.')}
              className="mt-3 py-1.5 px-3 bg-white text-[#0066cc] rounded text-xs font-bold hover:bg-sky-50 transition-all text-center shadow-xs cursor-pointer"
            >
              Post Your Ad Now
            </button>
          </div>

          {/* Top Searches Card */}
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-xs">
            <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider border-b border-gray-100 pb-2 mb-3">
              Top Searches
            </h4>
            <ul className="space-y-2 text-xs">
              {[
                'Houses for rent in Sri Lanka',
                'Apartments for rent in Sri Lanka',
                'Office spaces for rent in Sri Lanka',
                'Bungalows for rent in Sri Lanka',
                'Villas for rent in Sri Lanka',
                'Annexes for rent in Sri Lanka',
                'Boarding places & Rooms for rent in Sri Lanka',
                'Houses for rent in Sri Lanka for less than 50,000',
                'Houses for rent in Sri Lanka for less than 30,000'
              ].map((searchItem) => (
                <li key={searchItem}>
                  <button
                    type="button"
                    onClick={() => {
                      if (searchItem.includes('50,000')) setMaxRent('50000');
                      else if (searchItem.includes('30,000')) setMaxRent('30000');
                      else if (searchItem.includes('Apartment')) setSelectedType('Apartment');
                      else if (searchItem.includes('Villa')) setSelectedType('Villa');
                      else setQuery(searchItem.split(' ')[0]);
                      document.getElementById('listings')?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="text-left text-gray-600 hover:text-[#008037] hover:underline text-[11.5px]"
                  >
                    {searchItem}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Booking Modal */}
      <BookingModal
        isOpen={!!selectedPropertyForBooking}
        onClose={() => setSelectedPropertyForBooking(null)}
        property={selectedPropertyForBooking}
        onSuccess={(prop) => {
          setMessage(`Booking request for ${prop.title} submitted successfully! The landlord will review and approve your request.`);
        }}
      />
    </div>
  );
};

export const TenantProfilePortal = () => {
  const navigate = useNavigate();
  const { user, updateUser } = useAuth();
  
  const [profile, setProfile] = useState(null);
  const [agreements, setAgreements] = useState([]);
  const [maintenance, setMaintenance] = useState([]);
  const [payments, setPayments] = useState([]);
  const [myBookings, setMyBookings] = useState([]);
  const [selectedAgreementForPayment, setSelectedAgreementForPayment] = useState(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Edit Profile States
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editFormData, setEditFormData] = useState({
    fullName: '',
    phoneNumber: '',
    nicNumber: ''
  });
  const [editPasswordData, setEditPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [showEditCurrentPassword, setShowEditCurrentPassword] = useState(false);
  const [showEditNewPassword, setShowEditNewPassword] = useState(false);
  const [showEditConfirmPassword, setShowEditConfirmPassword] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [editProfileError, setEditProfileError] = useState('');
  const [editProfileSuccess, setEditProfileSuccess] = useState('');

  const handleOpenEditProfile = () => {
    setEditProfileError('');
    setEditProfileSuccess('');
    setEditFormData({
      fullName: profile?.fullName || profile?.name || user?.fullName || '',
      phoneNumber: profile?.phoneNumber || user?.phoneNumber || profile?.telephoneNumber || '',
      nicNumber: profile?.nicNumber || user?.nicNumber || ''
    });
    setEditPasswordData({
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    });
    setIsEditModalOpen(true);
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setEditProfileError('');
    setEditProfileSuccess('');

    if (!editFormData.fullName.trim()) {
      setEditProfileError('Full name is required.');
      return;
    }

    if (editFormData.phoneNumber && !/^\d{10}$/.test(editFormData.phoneNumber.trim())) {
      setEditProfileError('Phone number must be exactly 10 digits (e.g. 0712345678).');
      return;
    }

    if (editFormData.nicNumber && !/^([0-9]{9}[vV]|[0-9]{12})$/.test(editFormData.nicNumber.trim())) {
      setEditProfileError("NIC must be 12 digits or 9 digits followed by 'V' (e.g. 123456789V or 200012345678).");
      return;
    }

    if (editPasswordData.newPassword) {
      if (!editPasswordData.currentPassword) {
        setEditProfileError('Please enter your current password to set a new password.');
        return;
      }
      if (editPasswordData.newPassword.length < 8) {
        setEditProfileError('New password must be at least 8 characters.');
        return;
      }
      if (editPasswordData.newPassword !== editPasswordData.confirmPassword) {
        setEditProfileError('New password and confirm password do not match.');
        return;
      }
    }

    try {
      setIsSavingProfile(true);
      const res = await api.put('/auth/profile', {
        fullName: editFormData.fullName.trim(),
        phoneNumber: editFormData.phoneNumber ? editFormData.phoneNumber.trim() : null,
        nicNumber: editFormData.nicNumber ? editFormData.nicNumber.trim().toUpperCase() : null
      });

      if (editPasswordData.newPassword) {
        await api.post('/auth/change-password', {
          currentPassword: editPasswordData.currentPassword,
          newPassword: editPasswordData.newPassword
        });
      }

      setProfile((prev) => ({
        ...(prev || {}),
        ...(res.data?.user || {}),
        fullName: editFormData.fullName.trim(),
        phoneNumber: editFormData.phoneNumber.trim(),
        nicNumber: editFormData.nicNumber.trim().toUpperCase()
      }));

      if (res.data?.token) {
        updateUser(res.data.token, res.data.user);
      } else if (res.data?.user) {
        updateUser(null, res.data.user);
      }

      setEditProfileSuccess('Profile updated successfully!');
      setTimeout(() => {
        setIsEditModalOpen(false);
        setEditProfileSuccess('');
      }, 1000);
    } catch (err) {
      console.error('Failed to update profile:', err);
      let msg = 'Failed to update profile. Please check your inputs.';
      if (err.response?.data?.errors) {
        msg = Object.values(err.response.data.errors).flat().join(' ');
      } else if (err.response?.data?.message) {
        msg = err.response.data.message;
      } else if (typeof err.response?.data === 'string') {
        msg = err.response.data;
      }
      setEditProfileError(msg);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleOpenPayment = (agreement) => {
    setSelectedAgreementForPayment(agreement);
    setIsPaymentModalOpen(true);
  };

  const handlePaymentSuccess = (newPayment) => {
    setPayments((prev) => [newPayment, ...prev]);
  };

  useEffect(() => {
    setIsLoading(true);
    Promise.all([
      api.get('/auth/profile').catch(() => null),
      api.get('/agreements/mine').catch(() => api.get('/agreements').catch(() => ({ data: [] }))),
      api.get('/maintenance-requests/mine').catch(() => api.get('/maintenance-requests').catch(() => ({ data: [] }))),
      api.get('/property-applications').catch(() => ({ data: [] })),
      api.get('/properties').catch(() => ({ data: [] }))
    ])
      .then(async ([profileRes, agreementRes, maintenanceRes, bookingsRes, propertiesRes]) => {
        let agreementData = Array.isArray(agreementRes?.data) ? agreementRes.data : [];
        let bookingData = Array.isArray(bookingsRes?.data) ? bookingsRes.data : [];
        let rawMaintenance = Array.isArray(maintenanceRes?.data) ? maintenanceRes.data : [];
        const propertiesData = Array.isArray(propertiesRes?.data) ? propertiesRes.data : [];

        // Build property lookup dictionary
        const propLookup = new Map();
        propertiesData.forEach((p) => {
          if (p && p.id) propLookup.set(p.id, p);
        });

        // Synchronize with client-side confirmed agreements and bookings
        try {
          const localAgreements = JSON.parse(localStorage.getItem('rentwise_client_agreements') || '[]');
          if (localAgreements.length > 0) {
            const map = new Map();
            for (const a of [...localAgreements, ...agreementData]) {
              map.set(a.id || a.propertyId, a);
            }
            agreementData = Array.from(map.values());
          }

          const localBookings = JSON.parse(localStorage.getItem('rentwise_client_bookings') || '[]');
          if (localBookings.length > 0) {
            const bMap = new Map();
            for (const b of [...localBookings, ...bookingData]) {
              bMap.set(b.id, b);
            }
            bookingData = Array.from(bMap.values());
          }
        } catch (e) {
          console.error('Tenant profile sync error:', e);
        }

        // Synchronize maintenance requests with localStorage and server data
        try {
          const localMaintenance = JSON.parse(localStorage.getItem('rentwise_client_maintenance') || '[]');
          const mMap = new Map();

          // Add server requests
          rawMaintenance.forEach((m) => {
            if (m && m.id) {
              const matchedProp = propLookup.get(m.propertyId) || m.property;
              mMap.set(m.id, {
                ...m,
                propertyTitle: m.propertyTitle || matchedProp?.title || `Property #${String(m.propertyId).slice(0, 8)}`,
                propertyAddress: m.propertyAddress || matchedProp?.address || ''
              });
            }
          });

          // Merge client-side cached requests
          localMaintenance.forEach((lm) => {
            if (lm && lm.id && (!lm.tenantId || !user?.id || lm.tenantId === user?.id)) {
              if (!mMap.has(lm.id)) {
                const matchedProp = propLookup.get(lm.propertyId) || lm.property;
                mMap.set(lm.id, {
                  ...lm,
                  propertyTitle: lm.propertyTitle || matchedProp?.title || `Property #${String(lm.propertyId).slice(0, 8)}`,
                  propertyAddress: lm.propertyAddress || matchedProp?.address || ''
                });
              }
            }
          });

          rawMaintenance = Array.from(mMap.values());
          rawMaintenance.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
        } catch (e) {
          console.error('Tenant maintenance sync error:', e);
        }

        setProfile(profileRes?.data || null);
        setAgreements(agreementData);
        setMaintenance(rawMaintenance);
        setMyBookings(bookingData);

        // Fetch payments for tenant's agreements
        const paymentResponses = await Promise.all(
          agreementData.map((agreement) =>
            api.get(`/agreements/${agreement.id}/payments`).catch(() => ({ data: [] }))
          )
        );
        let allPayments = paymentResponses.flatMap((res) => res.data || []);

        // Synchronize with client-side recorded payments
        try {
          const localPayments = JSON.parse(localStorage.getItem('rentwise_client_payments') || '[]');
          const pMap = new Map();
          for (const p of [...localPayments, ...allPayments]) {
            if (p && p.id) pMap.set(p.id, p);
          }
          allPayments = Array.from(pMap.values());
          allPayments.sort((a, b) => new Date(b.paymentDate || 0) - new Date(a.paymentDate || 0));
        } catch (e) {
          console.error('Payment sync note:', e);
        }

        setPayments(allPayments);
      })
      .catch(() => setError('Unable to load some of your tenant profile details.'))
      .finally(() => setIsLoading(false));
  }, [user]);

  // Compute total spent on rent
  const totalPaid = useMemo(() => {
    return payments
      .filter((p) => p.isSuccessful !== false)
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);
  }, [payments]);

  // Open maintenance count
  const openMaintenanceCount = useMemo(() => {
    return maintenance.filter((m) => m.status !== 'Completed').length;
  }, [maintenance]);

  if (isLoading) {
    return (
      <div className="py-24 text-center text-gray-500 font-medium">
        Loading your tenant profile and records...
      </div>
    );
  }

  const tenantName = profile?.firstName 
    ? `${profile.firstName} ${profile.lastName || ''}`.trim() 
    : user?.fullName || 'Tenant Member';

  return (
    <div className="space-y-12 font-sans pb-16">
      
      {/* 1. TOP PROFILE HERO CARD */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-950 text-white p-7 sm:p-10 shadow-2xl border border-slate-800">
        <div className="absolute top-0 right-0 -mt-12 -mr-12 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
          {/* User Info */}
          <div className="flex items-center gap-5">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white font-extrabold text-3xl shadow-xl shadow-blue-500/25 border-2 border-white/20 shrink-0">
              {tenantName.charAt(0).toUpperCase()}
            </div>
            
            <div className="space-y-1">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight">{tenantName}</h1>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-500/20 text-blue-300 border border-blue-400/30">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Verified Tenant
                </span>
              </div>
              
              <div className="flex items-center gap-4 text-xs sm:text-sm text-slate-400 flex-wrap">
                <span className="flex items-center gap-1.5">
                  <Mail className="w-4 h-4 text-slate-400" />
                  {profile?.email || user?.email}
                </span>
                {(profile?.phoneNumber || profile?.telephoneNumber || user?.phoneNumber) && (
                  <span className="flex items-center gap-1.5">
                    <Phone className="w-4 h-4 text-slate-400" />
                    {profile?.phoneNumber || profile?.telephoneNumber || user?.phoneNumber}
                  </span>
                )}
                {(profile?.nicNumber || user?.nicNumber) && (
                  <span className="flex items-center gap-1.5">
                    <CreditCard className="w-4 h-4 text-slate-400" />
                    NIC: {profile?.nicNumber || user?.nicNumber}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleOpenEditProfile}
              className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold tracking-wide uppercase backdrop-blur-md border border-white/20 transition-all flex items-center gap-2"
            >
              <User className="w-4 h-4" />
              <span>Edit Profile</span>
            </button>
            <button
              onClick={() => navigate('/properties')}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold tracking-wide uppercase shadow-lg shadow-blue-600/30 transition-all flex items-center gap-2"
            >
              <Search className="w-4 h-4" />
              <span>Browse Properties</span>
            </button>
            <button
              onClick={() => navigate('/maintenance')}
              className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold tracking-wide uppercase backdrop-blur-md border border-white/20 transition-all flex items-center gap-2"
            >
              <Wrench className="w-4 h-4" />
              <span>Support</span>
            </button>
          </div>
        </div>

        {/* Stat Ribbon */}
        <div className="relative z-10 grid grid-cols-2 sm:grid-cols-4 gap-4 mt-8 pt-6 border-t border-white/10">
          <div className="p-3 bg-white/5 rounded-2xl border border-white/5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Active Rentals</p>
            <p className="text-2xl font-black text-white mt-1">{agreements.length}</p>
          </div>
          <div className="p-3 bg-white/5 rounded-2xl border border-white/5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Booking Inquiries</p>
            <p className="text-2xl font-black text-blue-400 mt-1">{myBookings.length}</p>
          </div>
          <div className="p-3 bg-white/5 rounded-2xl border border-white/5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Payments</p>
            <p className="text-2xl font-black text-emerald-400 mt-1">{money(totalPaid)}</p>
          </div>
          <div className="p-3 bg-white/5 rounded-2xl border border-white/5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Open Tickets</p>
            <p className="text-2xl font-black text-amber-400 mt-1">{openMaintenanceCount}</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl bg-rose-50 p-4 text-sm font-medium text-rose-700 border border-rose-200">
          {error}
        </div>
      )}

      {/* Quick Navigation Anchor Bar */}
      <div className="flex items-center gap-3 overflow-x-auto pb-1 border-b border-gray-200">
        <a 
          href="#bookings-section" 
          className="px-4 py-2 rounded-full text-xs font-bold text-gray-700 bg-gray-100 hover:bg-blue-50 hover:text-blue-600 transition-colors shrink-0"
        >
          📋 My Bookings ({myBookings.length})
        </a>
        <a 
          href="#rentals-section" 
          className="px-4 py-2 rounded-full text-xs font-bold text-gray-700 bg-gray-100 hover:bg-blue-50 hover:text-blue-600 transition-colors shrink-0"
        >
          🏡 Rental Houses ({agreements.length})
        </a>
        <a 
          href="#payments-section" 
          className="px-4 py-2 rounded-full text-xs font-bold text-gray-700 bg-gray-100 hover:bg-blue-50 hover:text-blue-600 transition-colors shrink-0"
        >
          💳 Payment Receipts ({payments.length})
        </a>
        <a 
          href="#maintenance-section" 
          className="px-4 py-2 rounded-full text-xs font-bold text-gray-700 bg-gray-100 hover:bg-blue-50 hover:text-blue-600 transition-colors shrink-0"
        >
          🔧 Maintenance Tickets ({maintenance.length})
        </a>
      </div>

      {/* ======================================================== */}
      {/* SECTION 1: MY BOOKINGS (CARD STYLE VIEW)                */}
      {/* ======================================================== */}
      <section id="bookings-section" className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-extrabold tracking-tight text-gray-900">
                My Bookings & Inquiries
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800">
                {myBookings.length}
              </span>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              Track the status of property booking requests you have sent to landlords.
            </p>
          </div>

          <button
            onClick={() => navigate('/properties')}
            className="text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-1"
          >
            <span>Book another property</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {myBookings.length === 0 ? (
          <div className="p-10 rounded-2xl bg-white border border-dashed border-gray-300 text-center">
            <Clock className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <p className="text-sm font-bold text-gray-700">No booking requests yet</p>
            <p className="text-xs text-gray-400 mt-1">When you request to book a property, your application status appears here.</p>
            <button
              onClick={() => navigate('/properties')}
              className="mt-4 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold"
            >
              Explore Properties
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {myBookings.map((booking) => {
              const isApproved = booking.status === 'Accepted';
              const isPending = booking.status === 'Submitted' || booking.status === 'UnderReview';
              const isRejected = booking.status === 'Rejected';

              return (
                <div
                  key={booking.id}
                  className="rounded-3xl bg-white border border-gray-200/80 p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group"
                >
                  <div className="space-y-3">
                    {/* Top Status Badge */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                        <Building2 className="w-5 h-5" />
                      </div>
                      
                      {isApproved && (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Approved
                        </span>
                      )}
                      {isPending && (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200 animate-pulse">
                          <Clock className="w-3.5 h-3.5" /> Under Review
                        </span>
                      )}
                      {isRejected && (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
                          <XCircle className="w-3.5 h-3.5" /> Declined
                        </span>
                      )}
                    </div>

                    {/* Property Title & Address */}
                    <div>
                      <h3 className="text-base font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                        {booking.propertyTitle || 'Luxury Residence'}
                      </h3>
                      {booking.propertyAddress && (
                        <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                          <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                          <span className="truncate">{booking.propertyAddress}</span>
                        </p>
                      )}
                    </div>

                    {/* Rent & Lease Terms */}
                    {(() => {
                      const details = parseBookingDetails(booking.message);
                      return (
                        <div className="space-y-2">
                          <div className="p-3 bg-blue-50/50 rounded-2xl border border-blue-100/50 flex items-center justify-between">
                            <div>
                              <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider block">Monthly Rent</span>
                              <span className="text-lg font-black text-blue-600">
                                {money(booking.monthlyRent)}
                                <span className="text-xs font-normal text-gray-500 ml-1">/ mo</span>
                              </span>
                            </div>
                            {details.duration && (
                              <div className="text-right">
                                <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider block">Payment Term</span>
                                <span className="text-xs font-black text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                                  {details.duration}
                                </span>
                              </div>
                            )}
                          </div>

                          {details.startDate && (
                            <div className="flex items-center justify-between text-xs px-1 text-gray-500">
                              <span>Move-in: <strong className="text-gray-700">{details.startDate}</strong></span>
                              {details.endDate && <span>End: <strong className="text-gray-700">{details.endDate}</strong></span>}
                            </div>
                          )}

                          {details.note && (
                            <div className="text-xs text-gray-600 italic bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                              "{details.note}"
                            </div>
                          )}

                          {isApproved && (
                            <a
                              href="#rentals-section"
                              className="inline-flex items-center justify-center gap-1.5 w-full py-1.5 px-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 text-xs font-bold transition-all"
                            >
                              <span>View in My Rentals &rarr;</span>
                            </a>
                          )}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Card Footer */}
                  <div className="mt-5 pt-4 border-t border-gray-100 flex items-center justify-between text-xs">
                    <span className="text-gray-400 flex items-center gap-1">
                      <CalendarDays className="w-3.5 h-3.5" />
                      {new Date(booking.createdAt).toLocaleDateString()}
                    </span>
                    <button
                      onClick={() => navigate(`/properties/${booking.propertyId}`)}
                      className="font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
                    >
                      <span>View Details</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ======================================================== */}
      {/* SECTION 2: MY RENTAL HOUSES (CARD STYLE VIEW)           */}
      {/* ======================================================== */}
      <section id="rentals-section" className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-extrabold tracking-tight text-gray-900">
                My Rental Houses & Leases
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                {agreements.length} Active
              </span>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              Active leases, rental amounts, and contract durations.
            </p>
          </div>
        </div>

        {agreements.length === 0 ? (
          <div className="p-10 rounded-2xl bg-white border border-dashed border-gray-300 text-center">
            <Home className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <p className="text-sm font-bold text-gray-700">No active rental agreements</p>
            <p className="text-xs text-gray-400 mt-1">Once your booking request is approved by the landlord, your active lease will appear here.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {agreements.map((agreement) => (
              <div
                key={agreement.id}
                className="rounded-3xl bg-white border border-gray-200/80 p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                      <Home className="w-5 h-5" />
                    </div>
                    <Badge variant={agreement.status === 'Active' ? 'success' : 'default'}>
                      {agreement.status || 'Active Lease'}
                    </Badge>
                  </div>

                  <div>
                    <h3 className="text-lg font-bold text-gray-900">
                      {agreement.propertyTitle || `Property #${String(agreement.propertyId).slice(0, 8)}`}
                    </h3>
                    <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                      <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      <span className="truncate">{agreement.propertyAddress || 'Address on file'}</span>
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 p-3 bg-gray-50 rounded-2xl">
                    <div>
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Agreed Rent</span>
                      <span className="text-base font-extrabold text-emerald-600">
                        {money(agreement.agreedMonthlyRent || agreement.monthlyRent)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Deposit</span>
                      <span className="text-sm font-bold text-gray-700">
                        {money(agreement.securityDeposit || (Number(agreement.agreedMonthlyRent || 0) * 2))}
                      </span>
                    </div>
                  </div>

                  <div className="text-xs text-gray-500 space-y-1 pt-1">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Lease Start:</span>
                      <span className="font-semibold text-gray-800">
                        {agreement.startDate ? new Date(agreement.startDate).toLocaleDateString() : 'Active'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Lease End:</span>
                      <span className="font-semibold text-gray-800">
                        {agreement.endDate ? new Date(agreement.endDate).toLocaleDateString() : '12 Months'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-gray-100 flex items-center gap-2">
                  <button
                    onClick={() => navigate(`/agreements/${agreement.id}`)}
                    className="flex-1 py-2.5 rounded-xl bg-gray-50 hover:bg-gray-100 text-gray-700 text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                  >
                    <FileText className="w-4 h-4" />
                    <span>Agreement</span>
                  </button>
                  <button
                    onClick={() => handleOpenPayment(agreement)}
                    className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm shadow-emerald-600/20"
                  >
                    <CreditCard className="w-4 h-4" />
                    <span>Pay Rent</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ======================================================== */}
      {/* SECTION 3: MY PAYMENTS & MONTHLY RENT DUES               */}
      {/* ======================================================== */}
      <section id="payments-section" className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-extrabold tracking-tight text-gray-900">
                My Payments & Monthly Dues
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800">
                {payments.length} Settled
              </span>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              Review what you have to pay for the month, make monthly rent payments, and view completed payment receipts.
            </p>
          </div>

          <div className="text-left sm:text-right p-3 bg-emerald-50 rounded-2xl border border-emerald-100 inline-block">
            <span className="text-[11px] text-emerald-800 uppercase font-bold tracking-wider block">Total Rent Settled</span>
            <span className="text-xl font-black text-emerald-600">{money(totalPaid)}</span>
          </div>
        </div>

        {/* --- SUBSECTION 3A: VALUE HAVE TO PAY FOR MONTH --- */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-extrabold text-gray-900 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-blue-600" />
              <span>Monthly Rent Due ("Have to Pay Value for Month")</span>
              <span className="text-xs font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                {agreements.length} Active Rentals
              </span>
            </h3>
          </div>

          {agreements.length === 0 ? (
            <div className="p-8 rounded-3xl bg-white border border-dashed border-gray-300 text-center">
              <Building2 className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-sm font-bold text-gray-700">No active rental homes yet</p>
              <p className="text-xs text-gray-400 mt-1">
                Once a landlord approves your booking, your monthly rent dues and payment buttons will appear here.
              </p>
              <button
                onClick={() => navigate('/properties')}
                className="mt-4 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm"
              >
                Browse Properties
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {agreements.map((agreement) => {
                const rentVal = agreement.agreedMonthlyRent || agreement.monthlyRent || 0;
                const currentMonth = new Date().getMonth();
                const currentYear = new Date().getFullYear();
                const hasPaidThisMonth = payments.some((p) => {
                  const matchesAgr = (p.rentalAgreementId === agreement.id || p.propertyId === agreement.propertyId);
                  const pDate = new Date(p.paymentDate);
                  return matchesAgr && pDate.getMonth() === currentMonth && pDate.getFullYear() === currentYear && p.isSuccessful;
                });

                return (
                  <div
                    key={agreement.id}
                    className="rounded-3xl bg-white border border-gray-200/80 p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group"
                  >
                    <div className="space-y-4">
                      {/* Header Badge */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                          <Home className="w-5 h-5" />
                        </div>
                        {hasPaidThisMonth ? (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Paid for this Month
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200 animate-pulse">
                            <Clock className="w-3.5 h-3.5" /> Payment Due
                          </span>
                        )}
                      </div>

                      {/* Property Title & Address */}
                      <div>
                        <h4 className="text-base font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                          {agreement.propertyTitle || `Property #${String(agreement.propertyId).slice(0, 8)}`}
                        </h4>
                        <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                          <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                          <span className="truncate">{agreement.propertyAddress || 'Address on file'}</span>
                        </p>
                      </div>

                      {/* Monthly Value to Pay */}
                      <div className="p-4 bg-gradient-to-br from-blue-50/70 to-indigo-50/50 rounded-2xl border border-blue-100/80">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-blue-800 block">
                          Value to Pay for Month
                        </span>
                        <div className="flex items-baseline justify-between mt-1">
                          <span className="text-2xl font-black text-blue-700">
                            {money(rentVal)}
                          </span>
                          <span className="text-xs font-semibold text-gray-500">
                            / month
                          </span>
                        </div>
                        <div className="mt-2 pt-2 border-t border-blue-200/50 flex items-center justify-between text-xs text-gray-600">
                          <span>Billing Cycle:</span>
                          <span className="font-bold text-gray-800">1st of each month</span>
                        </div>
                      </div>
                    </div>

                    {/* Pay Button */}
                    <div className="mt-5 pt-3 border-t border-gray-100">
                      <button
                        onClick={() => handleOpenPayment(agreement)}
                        className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-sm ${
                          hasPaidThisMonth
                            ? 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                            : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20'
                        }`}
                      >
                        <CreditCard className="w-4 h-4" />
                        <span>{hasPaidThisMonth ? 'Make Another Payment' : 'Pay Monthly Rent'}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* --- SUBSECTION 3B: DONE PAYMENTS (COMPLETED RECEIPTS) --- */}
        <div className="space-y-3 pt-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-extrabold text-gray-900 flex items-center gap-2">
              <Receipt className="w-4 h-4 text-emerald-600" />
              <span>Done Payments & Digital Receipts</span>
              <span className="text-xs font-bold bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full">
                {payments.length} Transactions
              </span>
            </h3>
          </div>

          {payments.length === 0 ? (
            <div className="p-8 rounded-3xl bg-white border border-dashed border-gray-300 text-center">
              <Receipt className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-sm font-bold text-gray-700">No completed payments yet</p>
              <p className="text-xs text-gray-400 mt-1">
                When you pay your monthly rent using the button above, your verified receipts will appear here.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {payments.map((payment) => (
                <div
                  key={payment.id}
                  className="rounded-3xl bg-white border border-gray-200/80 p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                >
                  <div className="space-y-4">
                    {/* Card Header with Receipt Pill */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Payment Verified</span>
                      </div>
                      <Receipt className="w-5 h-5 text-gray-400" />
                    </div>

                    {/* Payment Amount */}
                    <div>
                      <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">
                        Amount Paid
                      </span>
                      <p className="text-2xl font-black text-gray-900 mt-0.5">
                        {money(payment.amount)}
                      </p>
                      {payment.propertyTitle && (
                        <p className="text-xs font-semibold text-gray-600 mt-1 truncate">
                          {payment.propertyTitle}
                        </p>
                      )}
                    </div>

                    {/* Payment Metadata */}
                    <div className="space-y-2 pt-2 border-t border-gray-100 text-xs text-gray-600">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400">Payment Date:</span>
                        <span className="font-semibold text-gray-900 flex items-center gap-1">
                          <CalendarDays className="w-3.5 h-3.5 text-gray-400" />
                          {new Date(payment.paymentDate).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400">Transaction Ref:</span>
                        <span className="font-mono text-gray-500">
                          {payment.paymentReference || `#TXN-${String(payment.id).slice(0, 8).toUpperCase()}`}
                        </span>
                      </div>
                      {payment.paymentMethod && (
                        <div className="flex justify-between items-center">
                          <span className="text-gray-400">Method:</span>
                          <span className="font-semibold text-gray-800">{payment.paymentMethod}</span>
                        </div>
                      )}
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400">Status:</span>
                        <span className="font-bold text-emerald-600">Settled & Confirmed</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 pt-3 border-t border-gray-100">
                    <div className="text-[11px] text-gray-400 text-center">
                      Official digital receipt generated by RentWise
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ======================================================== */}
      {/* SECTION 4: MAINTENANCE REQUESTS (CARD STYLE VIEW)       */}
      {/* ======================================================== */}
      <section id="maintenance-section" className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-extrabold tracking-tight text-gray-900">
                Maintenance Requests
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
                {maintenance.length}
              </span>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              Track repairs, technician dispatches, and maintenance status.
            </p>
          </div>

          <button
            onClick={() => navigate('/maintenance')}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Request</span>
          </button>
        </div>

        {maintenance.length === 0 ? (
          <div className="p-10 rounded-2xl bg-white border border-dashed border-gray-300 text-center">
            <Wrench className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <p className="text-sm font-bold text-gray-700">No maintenance requests</p>
            <p className="text-xs text-gray-400 mt-1">Everything looks in order. If you need any repairs, submit a request anytime.</p>
            <button
              onClick={() => navigate('/maintenance')}
              className="mt-4 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold"
            >
              Request Support
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {maintenance.map((request) => {
              const isCompleted = request.status === 'Completed';
              const isProgress = request.status === 'InProgress' || request.status === 'Assigned';

              return (
                <div
                  key={request.id}
                  className="rounded-3xl bg-white border border-gray-200/80 p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                        <Wrench className="w-5 h-5" />
                      </div>
                      <Badge variant={isCompleted ? 'success' : isProgress ? 'warning' : 'default'}>
                        {request.status || 'Reported'}
                      </Badge>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider block">
                        {request.aiCategory || 'General Maintenance'}
                      </span>
                      <h3 className="text-base font-bold text-gray-900 mt-0.5 line-clamp-2">
                        {request.description || request.issueDescription || 'Repair inspection request'}
                      </h3>
                    </div>

                    {/* Property info */}
                    {(request.propertyTitle || request.property?.title) && (
                      <div className="flex items-center gap-1.5 text-xs text-gray-600 font-medium bg-blue-50/60 px-3 py-1.5 rounded-xl border border-blue-100/70">
                        <Home className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        <span className="truncate font-bold text-gray-800">
                          {request.propertyTitle || request.property?.title}
                        </span>
                      </div>
                    )}

                    {/* Photo thumbnail if present */}
                    {request.photoUrl && (
                      <div className="relative rounded-xl overflow-hidden border border-gray-200 h-28 bg-gray-50">
                        <img 
                          src={request.photoUrl} 
                          alt="Maintenance proof" 
                          className="w-full h-full object-cover" 
                          onError={(e) => { e.target.style.display = 'none'; }}
                        />
                      </div>
                    )}

                    <div className="p-3 bg-gray-50 rounded-2xl text-xs space-y-1.5 text-gray-600">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Priority:</span>
                        <span className="font-bold text-gray-800">
                          {request.aiPriority || 'Normal'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Date Logged:</span>
                        <span className="font-medium text-gray-700">
                          {request.createdAt ? new Date(request.createdAt).toLocaleDateString() : 'Recently'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 pt-3 border-t border-gray-100 flex items-center justify-between">
                    <button
                      onClick={() => navigate(`/maintenance/${request.id}`)}
                      className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
                    >
                      <span>Track Status</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Monthly Rent Payment Modal */}
      <PaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        agreement={selectedAgreementForPayment}
        onSuccess={handlePaymentSuccess}
      />

      {/* Edit Profile Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit My Profile"
        className="max-w-lg"
      >
        {editProfileSuccess && (
          <div className="mb-4 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{editProfileSuccess}</span>
          </div>
        )}

        {editProfileError && (
          <div className="mb-4 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-center gap-2">
            <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{editProfileError}</span>
          </div>
        )}

        <form onSubmit={handleSaveProfile} className="space-y-4">
          {/* Full Name */}
          <div className="space-y-1">
            <label className="text-xs font-bold uppercase tracking-wider text-gray-700 block">
              Full Name
            </label>
            <div className="relative">
              <input
                type="text"
                required
                value={editFormData.fullName}
                onChange={(e) => setEditFormData({ ...editFormData, fullName: e.target.value })}
                placeholder="Your full name"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50/50 text-sm text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all"
              />
              <User className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Phone Number & NIC Number Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Phone */}
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wider text-gray-700 block">
                Phone Number
              </label>
              <div className="relative">
                <input
                  type="tel"
                  maxLength={10}
                  value={editFormData.phoneNumber}
                  onChange={(e) => setEditFormData({ ...editFormData, phoneNumber: e.target.value })}
                  placeholder="0712345678"
                  className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50/50 text-sm text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all"
                />
                <Phone className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
              <p className="text-[10px] text-gray-400">10 digits (e.g. 0712345678)</p>
            </div>

            {/* NIC */}
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wider text-gray-700 block">
                NIC Number
              </label>
              <div className="relative">
                <input
                  type="text"
                  maxLength={12}
                  value={editFormData.nicNumber}
                  onChange={(e) => setEditFormData({ ...editFormData, nicNumber: e.target.value.toUpperCase() })}
                  placeholder="123456789V / 2000..."
                  className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50/50 text-sm uppercase text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all"
                />
                <CreditCard className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
              <p className="text-[10px] text-gray-400">12 digits or 9 digits + 'V'</p>
            </div>
          </div>

          {/* Password Change Sub-section */}
          <div className="pt-3 border-t border-gray-100">
            <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-2.5">
              Change Password (Optional)
            </h4>
            <div className="space-y-3">
              <div>
                <div className="relative">
                  <input
                    type={showEditCurrentPassword ? 'text' : 'password'}
                    value={editPasswordData.currentPassword}
                    onChange={(e) => setEditPasswordData({ ...editPasswordData, currentPassword: e.target.value })}
                    placeholder="Current Password"
                    className="w-full pl-10 pr-10 py-2 rounded-xl border border-gray-200 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  />
                  <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <button
                    type="button"
                    onClick={() => setShowEditCurrentPassword(!showEditCurrentPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showEditCurrentPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="relative">
                  <input
                    type={showEditNewPassword ? 'text' : 'password'}
                    value={editPasswordData.newPassword}
                    onChange={(e) => setEditPasswordData({ ...editPasswordData, newPassword: e.target.value })}
                    placeholder="New Password (min 8)"
                    className="w-full pl-9 pr-9 py-2 rounded-xl border border-gray-200 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  />
                  <Lock className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <button
                    type="button"
                    onClick={() => setShowEditNewPassword(!showEditNewPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showEditNewPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>

                <div className="relative">
                  <input
                    type={showEditConfirmPassword ? 'text' : 'password'}
                    value={editPasswordData.confirmPassword}
                    onChange={(e) => setEditPasswordData({ ...editPasswordData, confirmPassword: e.target.value })}
                    placeholder="Confirm New Password"
                    className="w-full pl-9 pr-9 py-2 rounded-xl border border-gray-200 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  />
                  <Lock className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <button
                    type="button"
                    onClick={() => setShowEditConfirmPassword(!showEditConfirmPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showEditConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-4 flex items-center justify-end gap-3 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setIsEditModalOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>
            <Button
              type="submit"
              isLoading={isSavingProfile}
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-5 py-2 rounded-xl shadow-md shadow-blue-600/20"
            >
              Save Profile
            </Button>
          </div>
        </form>
      </Modal>

    </div>
  );
};
