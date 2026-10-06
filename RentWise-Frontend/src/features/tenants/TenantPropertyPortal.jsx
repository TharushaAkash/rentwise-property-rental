import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, CheckCircle2, Clock, MapPin, Lock, Star, Camera, Share2, Bookmark, X } from 'lucide-react';
import api from '../../services/api';

import { BookingModal } from './BookingModal';

import { PROPERTY_PLACEHOLDER_IMAGE, handleImageError } from '../../utils/imagePlaceholder';
import { getActiveBookingForProperty, BOOKINGS_UPDATED_EVENT } from '../../utils/bookingStatus';

import { formatLankaPrice } from './tenantHelpers';
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
  const [applications, setApplications] = useState([]);
  const [bookingsVersion, setBookingsVersion] = useState(0);

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
    const fetchPortalData = () => {
      Promise.all([
        api.get('/properties').catch(() => ({ data: [] })),
        api.get('/property-applications').catch(() => ({ data: [] }))
      ])
        .then(([propsRes, appsRes]) => {
          const apiProps = Array.isArray(propsRes.data) ? propsRes.data : [];
          setDbProperties(apiProps);
          setApplications(appsRes.data || []);
        })
        .catch(() => setMessage('Unable to load server property listings.'))
        .finally(() => setLoading(false));
    };

    fetchPortalData();

    const handleUpdate = () => {
      setBookingsVersion((v) => v + 1);
      api.get('/property-applications')
        .then((res) => setApplications(res.data || []))
        .catch(() => {});
      fetchPortalData();
    };

    window.addEventListener(BOOKINGS_UPDATED_EVENT, handleUpdate);
    window.addEventListener('storage', handleUpdate);

    return () => {
      window.removeEventListener(BOOKINGS_UPDATED_EVENT, handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  // Map and normalize only properties that are ACTIVE by admin for user dashboard listing
  const realProperties = useMemo(() => {
    return dbProperties
      .filter((p) => {
        const rawStatus = p.status ?? p.Status;
        const statusStr = typeof rawStatus === 'number' 
          ? ['PendingVerification', 'Active', 'Suspended'][rawStatus] 
          : (rawStatus || 'Active');
        // If admin has not activated the property, do NOT show in user dashboard as property listing
        return statusStr === 'Active';
      })
      .map((p) => {
        const primaryPhoto = p.photos && Array.isArray(p.photos) && p.photos.length > 0 
          ? (p.photos.find((ph) => ph.isPrimary || ph.IsPrimary)?.photoUrl || 
             p.photos.find((ph) => ph.isPrimary || ph.IsPrimary)?.PhotoUrl || 
             p.photos[0]?.photoUrl || 
             p.photos[0]?.PhotoUrl || 
             p.photos[0]?.url)
          : (p.photoUrl || p.PhotoUrl || PROPERTY_PLACEHOLDER_IMAGE);

        const rawStatus = p.status ?? p.Status;
        const statusStr = typeof rawStatus === 'number' 
          ? ['PendingVerification', 'Active', 'Suspended'][rawStatus] 
          : (rawStatus || 'Active');
        const isActiveByAdmin = statusStr === 'Active';

        return {
          ...p,
          id: p.id || p.Id,
          title: p.title || p.Title || 'Untitled Property',
          address: p.address || p.Address || '',
          city: p.city || p.City || p.address?.split(',').pop()?.trim() || 'Colombo',
          propertyType: p.propertyType || (p.title?.toLowerCase().includes('apartment') ? 'Apartment' : 'House'),
          monthlyRent: Number(p.monthlyRent || p.MonthlyRent || 0),
          bedrooms: Number(p.bedrooms ?? p.Bedrooms ?? 1),
          bathrooms: Number(p.bathrooms ?? p.Bathrooms ?? 1),
          photosCount: p.photoCount || p.photos?.length || (primaryPhoto && primaryPhoto !== PROPERTY_PLACEHOLDER_IMAGE ? 1 : 0),
          photoCount: p.photoCount || p.photos?.length || 0,
          photoUrl: primaryPhoto,
          photos: p.photos || [],
          sqft: p.sqft || (p.bedrooms ? p.bedrooms * 750 + 500 : 1200),
          featureTag: p.facilities?.split(',')[0]?.trim() || (statusStr || 'Verified Listing'),
          featureTags: Array.isArray(p.featureTags) ? p.featureTags : [],
          isUrgent: p.status === 'Urgent' || Boolean(p.isUrgent),
          status: statusStr,
          isActiveByAdmin: true,
          isPendingByAdmin: false,
          isSuspendedByAdmin: false,
          adminManuallyVerified: Boolean(p.adminManuallyVerified || p.isManuallyApproved)
        };
      });
  }, [dbProperties]);

  const filtered = useMemo(() => {
    const source = aiMatches || realProperties;
    return source.filter((property) => {
      // Must be active by admin
      if (property.status !== 'Active') return false;

      // Must not be leased/booked
      const bookingInfo = getActiveBookingForProperty(property.id);
      if (bookingInfo.isBooked) return false;

      const text = `${property.title} ${property.address} ${property.city || ''} ${property.facilities || ''}`.toLowerCase();
      const matchesQuery = !query || text.includes(query.toLowerCase());
      const matchesType = !selectedType || (property.propertyType && property.propertyType.toLowerCase() === selectedType.toLowerCase()) || text.includes(selectedType.toLowerCase());
      const matchesCity = !selectedCity || (property.city && property.city.toLowerCase().includes(selectedCity.toLowerCase())) || text.includes(selectedCity.toLowerCase());
      const matchesRent = !maxRent || Number(property.monthlyRent) <= Number(maxRent);
      const matchesBeds = !bedrooms || Number(property.bedrooms) >= Number(bedrooms);

      return matchesQuery && matchesType && matchesCity && matchesRent && matchesBeds;
    });
  }, [realProperties, aiMatches, query, selectedType, selectedCity, maxRent, bedrooms, bookingsVersion]);

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
                const bookingInfo = getActiveBookingForProperty(property.id, applications);
                const isPending = bookingInfo.isBooked;

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

                        {/* Top-Right: Urgent or Booking Status Badge */}
                        {isPending ? (
                          <div className="absolute top-2.5 right-2.5 bg-amber-500 text-white text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded shadow-sm flex items-center gap-1 z-10 animate-in fade-in">
                            <Clock className="w-3 h-3" />
                            <span>{bookingInfo.isLeased ? 'Leased' : 'Pending'}</span>
                          </div>
                        ) : property.isUrgent ? (
                          <div className="absolute top-2.5 right-2.5 bg-[#b91c1c] text-white text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded shadow-sm animate-pulse">
                            URGENT
                          </div>
                        ) : (
                          <div className="absolute top-2.5 right-2.5 bg-emerald-600/90 text-white text-[9.5px] font-bold uppercase tracking-wider px-2 py-0.5 rounded shadow-xs flex items-center gap-1">
                            <CheckCircle2 className="w-2.5 h-2.5" />
                            <span>Active</span>
                          </div>
                        )}

                        {/* Bottom-Right: City / Area Location Chip */}
                        <div className="absolute bottom-2.5 right-2.5 bg-black/75 backdrop-blur-xs text-white text-xs font-bold px-2.5 py-0.5 rounded shadow-xs">
                          {property.city || 'Colombo'}
                        </div>
                      </div>

                      {/* Specs Row: Beds, Sqft, Type, Star */}
                      <div className="flex items-center justify-between px-3.5 pt-3">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 flex-wrap">
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
                          {isPending && (
                            <span className="ml-0.5 inline-block border border-amber-300 text-amber-800 text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-50">
                              {bookingInfo.isLeased ? 'Leased' : 'Pending Review'}
                            </span>
                          )}
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

                      {isPending ? (
                        <button
                          type="button"
                          disabled
                          title="This property currently has a pending booking and cannot be booked by another applicant."
                          className="bg-amber-100 border border-amber-300 text-amber-800 text-xs font-bold px-3 py-1.5 rounded cursor-not-allowed flex items-center gap-1 shadow-xs"
                        >
                          <Lock className="w-3.5 h-3.5 text-amber-700" />
                          <span>{bookingInfo.isLeased ? 'Leased' : 'Booking Pending'}</span>
                        </button>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/properties/${property.id}?book=true`, { state: { property } });
                          }}
                          className="bg-[#ff5a00] hover:bg-[#e04f00] text-white text-xs font-bold px-3 py-1.5 rounded shadow-xs transition-all active:scale-95 cursor-pointer"
                        >
                          View & Book
                        </button>
                      )}
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

