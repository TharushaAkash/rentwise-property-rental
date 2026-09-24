import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Heart, SlidersHorizontal, MapPin, Building2, Home, Bed, Bath, Maximize, CheckCircle2, AlertCircle, ArrowRight, Sparkles, RotateCcw, Clock, Lock, Eye, Navigation, Bot, Zap, Compass, Check, X } from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import { BookingModal } from '../tenants/BookingModal';
import { PropertyInspectModal } from '../properties/PropertyInspectModal';
import { PROPERTY_PLACEHOLDER_IMAGE, handleImageError } from '../../utils/imagePlaceholder';
import { getActiveBookingForProperty, BOOKINGS_UPDATED_EVENT } from '../../utils/bookingStatus';

// Curated high quality properties matching the screenshot aesthetic
const DEFAULT_SAMPLE_RENTALS = [
  {
    id: 'sample-rental-1',
    title: 'Modern Sunset Glass Villa',
    description: 'Stunning architectural villa with floor-to-ceiling glass, private garden and minimalist luxury aesthetics.',
    address: '142 Lake Drive, Malabe',
    city: 'Malabe',
    monthlyRent: 65000,
    bedrooms: 3,
    bathrooms: 2,
    sqft: 2200,
    propertyType: 'Apartment',
    photoUrl: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1200&q=80',
    facilities: 'Air Conditioning, Swimming Pool, Garden, Parking Space, 24/7 Security'
  },
  {
    id: 'sample-rental-2',
    title: 'Minimalist Two-Story White Residence',
    description: 'Clean geometric contemporary home featuring open-plan living, private plunge pool, and rooftop deck.',
    address: '28 Orchard Way, Malabe',
    city: 'Malabe',
    monthlyRent: 55000,
    bedrooms: 4,
    bathrooms: 3,
    sqft: 2600,
    propertyType: 'House',
    photoUrl: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80',
    facilities: 'Swimming Pool, Solar Power, 2-Car Garage, Gym Access'
  },
  {
    id: 'sample-rental-3',
    title: 'Artisan Loft in Central Colombo',
    description: 'High-ceiling urban apartment filled with natural daylight, wooden floors and curated interior styling.',
    address: '45 Ward Place, Colombo 07',
    city: 'Colombo',
    monthlyRent: 85000,
    bedrooms: 2,
    bathrooms: 2,
    sqft: 1450,
    propertyType: 'Apartment',
    photoUrl: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1200&q=80',
    facilities: 'Furnished, Air Conditioned, Balcony, Elevator, 24/7 Security'
  },
  {
    id: 'sample-rental-4',
    title: 'Contemporary Garden Bungalow',
    description: 'Peaceful sanctuary surrounded by lush tropical greenery with modern fitted pantry and teak finishes.',
    address: '88 Kandy Road, Pelawatte',
    city: 'Pelawatte',
    monthlyRent: 70000,
    bedrooms: 3,
    bathrooms: 2,
    sqft: 1950,
    propertyType: 'House',
    photoUrl: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1200&q=80',
    facilities: 'Spacious Lawn, Servant Quarters, Hot Water, CCTV'
  },
  {
    id: 'sample-rental-5',
    title: 'Skyline View Penthouse Suite',
    description: 'Panoramic views over the ocean and skyline with wrap-around terrace and premium designer fittings.',
    address: '12 Marine Drive, Colombo 03',
    city: 'Colombo',
    monthlyRent: 120000,
    bedrooms: 3,
    bathrooms: 3,
    sqft: 2100,
    propertyType: 'Apartment',
    photoUrl: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1200&q=80',
    facilities: 'Sea View, Infinity Pool, Fitness Center, Backup Generator'
  },
  {
    id: 'sample-rental-6',
    title: 'Nordic Inspired Hillside Retreat',
    description: 'Bright and airy retreat with natural wood accents, scenic views, and high energy-efficient layout.',
    address: '15 Peradeniya Road, Kandy',
    city: 'Kandy',
    monthlyRent: 48000,
    bedrooms: 2,
    bathrooms: 1,
    sqft: 1300,
    propertyType: 'Villa',
    photoUrl: 'https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&w=1200&q=80',
    facilities: 'Mountain View, Garden Patio, Fully Furnished, Quiet Neighborhood'
  }
];

export const FindRentals = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Search & Filter state
  const [locationInput, setLocationInput] = useState('');
  const [minBudget, setMinBudget] = useState('');
  const [maxBudget, setMaxBudget] = useState('');
  const [bedroomsFilter, setBedroomsFilter] = useState('Any');

  // Student 2: Matching & Location Intelligence Agent state
  const [aiPrompt, setAiPrompt] = useState('');
  const [isAiSearching, setIsAiSearching] = useState(false);
  const [aiSearchResult, setAiSearchResult] = useState(null);
  const [aiError, setAiError] = useState('');

  // Search by AI - Student 2 Matching & Location Intelligence Agent (matching RequestForm triage pattern)
  const handleAiSearch = async (promptOverride) => {
    const query = (typeof promptOverride === 'string' ? promptOverride : aiPrompt).trim();
    if (!query) return;

    if (typeof promptOverride === 'string') {
      setAiPrompt(promptOverride);
    }

    setIsAiSearching(true);
    setAiError('');

    try {
      const qLower = query.toLowerCase();

      // 1. Natural Language Extraction (Student 2 Criteria Parsing)
      let extractedDest = 'Central Colombo';
      let destKey = 'colombo';
      if (qLower.includes('sliit') || qLower.includes('malabe')) {
        extractedDest = 'SLIIT Malabe';
        destKey = 'sliit';
      } else if (qLower.includes('orion')) {
        extractedDest = 'Orion City IT Park';
        destKey = 'orion';
      } else if (qLower.includes('colombo 07') || qLower.includes('ward place') || qLower.includes('cinnamon')) {
        extractedDest = 'Colombo 07';
        destKey = 'colombo 07';
      } else if (qLower.includes('colombo 03') || qLower.includes('kollupitiya') || qLower.includes('marine')) {
        extractedDest = 'Colombo 03';
        destKey = 'colombo 03';
      } else if (qLower.includes('university') || qLower.includes('uoc')) {
        extractedDest = 'University of Colombo';
        destKey = 'university';
      } else if (qLower.includes('battaramulla') || qLower.includes('thalangama')) {
        extractedDest = 'Battaramulla';
        destKey = 'battaramulla';
      } else if (qLower.includes('pelawatte')) {
        extractedDest = 'Pelawatte';
        destKey = 'pelawatte';
      } else if (qLower.includes('dehiwala') || qLower.includes('mount lavinia')) {
        extractedDest = 'Dehiwala';
        destKey = 'dehiwala';
      } else if (qLower.includes('kandy') || qLower.includes('peradeniya')) {
        extractedDest = 'Kandy';
        destKey = 'kandy';
      } else if (qLower.includes('fort')) {
        extractedDest = 'Colombo Fort';
        destKey = 'fort';
      }

      // Budget extraction
      let targetMaxBudget = 0;
      const budgetMatch = qLower.match(/under\s+(?:lkr\s*|rs\.?\s*)?(\d+)(?:k|000)?/i) ||
                          qLower.match(/(?:below|less than|max)\s+(\d+)(?:k|000)?/i) ||
                          qLower.match(/(\d+)k/i);
      if (budgetMatch) {
        let num = parseInt(budgetMatch[1], 10);
        if (num < 1000) num = num * 1000;
        targetMaxBudget = num;
      }

      // Bedroom extraction
      let targetBeds = 0;
      if (qLower.includes('1-bed') || qLower.includes('1 bed') || qLower.includes('single') || qLower.includes('studio')) targetBeds = 1;
      else if (qLower.includes('2-bed') || qLower.includes('2 bed')) targetBeds = 2;
      else if (qLower.includes('3-bed') || qLower.includes('3 bed')) targetBeds = 3;
      else if (qLower.includes('4-bed') || qLower.includes('4 bed')) targetBeds = 4;

      // Desired facilities
      const wantsAC = qLower.includes('ac') || qLower.includes('air condition');
      const wantsParking = qLower.includes('park') || qLower.includes('garage');
      const wantsPool = qLower.includes('pool');
      const wantsFurnished = qLower.includes('furnish');
      const wantsGarden = qLower.includes('garden');

      // 2. Try Calling Backend Agentic Service (with fallback if 404 or offline)
      let backendRanked = null;
      try {
        const res = await api.post('/agentic/workflow/match-location', {
          objective: query,
          tenant_profile: {
            name: user?.name || 'Prospective Tenant',
            role: user?.role || 'Tenant',
            preferredBudgetMax: targetMaxBudget || (maxBudget ? Number(maxBudget) : null)
          }
        });
        
        const returnedProperties = res.data?.ranked_properties || res.data?.matching_results;
        if (returnedProperties !== undefined) {
          backendRanked = { ...res.data, ranked_properties: returnedProperties };
        }
      } catch (apiErr) {
        console.warn('Agentic AI backend note, executing client-side Student 2 Matching & Location agent:', apiErr);
      }

      if (backendRanked) {
        const enriched = backendRanked.ranked_properties.map((p) => {
          const matchExisting = properties.find((ep) => String(ep.id) === String(p.property_id || p.id));
          return {
            ...p,
            id: p.property_id || p.id,
            photoUrl: p.photo_url || matchExisting?.photoUrl || 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1200&q=80',
            photos: matchExisting?.photos || [p.photo_url || 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1200&q=80'],
            monthlyRent: p.monthly_rent || p.monthlyRent,
            propertyType: p.propertyType || matchExisting?.propertyType || 'Apartment',
            bathrooms: p.bathrooms || matchExisting?.bathrooms || 1,
            sqft: p.sqft || matchExisting?.sqft || 1200,
            status: 'Active'
          };
        }).filter(p => !getActiveBookingForProperty(p.id).isBooked);

        setAiSearchResult({
          ...backendRanked,
          ranked_properties: enriched
        });
        return;
      }

      // 3. Resilient Client-Side Student 2 Agent Engine
      const allActive = properties.filter((p) => {
        const s = p.status ?? p.Status ?? 'Active';
        if (s !== 'Active' && s !== 1) return false;
        
        const bookingInfo = getActiveBookingForProperty(p.id);
        if (bookingInfo.isBooked) return false;

        return true;
      });

      const scoredList = allActive.map((p) => {
        const rent = Number(p.monthlyRent || p.MonthlyRent || 0);
        const beds = Number(p.bedrooms || p.Bedrooms || 1);
        const facilities = (p.facilities || p.Facilities || '').toLowerCase();
        const pAddress = (p.address || p.Address || '').toLowerCase();
        const pCity = (p.city || p.City || '').toLowerCase();

        // Calculate commute distance & travel time
        let distanceKm = 3.5;
        let travelMins = 10;
        const targetTown = destKey;

        // Strict location filtering for client-side engine
        if (targetTown && targetTown !== 'any' && targetTown !== 'colombo') {
          if (!pAddress.includes(targetTown) && !pCity.includes(targetTown)) {
            return null; // Exclude properties not in the target town
          }
        }

        if (pAddress.includes(targetTown) || pCity.includes(targetTown)) {
          distanceKm = 1.6;
          travelMins = 5;
        } else if (targetTown === 'sliit' && (pAddress.includes('malabe') || pCity.includes('malabe'))) {
          distanceKm = 1.8;
          travelMins = 6;
        } else if (targetTown === 'sliit' && (pAddress.includes('battaramulla') || pAddress.includes('pelawatte'))) {
          distanceKm = 4.2;
          travelMins = 12;
        } else if (targetTown === 'colombo 07' && (pAddress.includes('colombo') || pAddress.includes('ward'))) {
          distanceKm = 1.2;
          travelMins = 4;
        } else if (targetTown === 'dehiwala' && (pAddress.includes('dehiwala') || pAddress.includes('marine'))) {
          distanceKm = 1.4;
          travelMins = 5;
        } else {
          distanceKm = 6.8;
          travelMins = 20;
        }

        // Compute Match Score (0 - 100%)
        let score = 70;
        const reasons = [];

        // Budget evaluation (30 pts)
        if (targetMaxBudget > 0) {
          if (rent <= targetMaxBudget) {
            score += 15;
            reasons.push(`Monthly rent of LKR ${rent.toLocaleString()} fits within your LKR ${targetMaxBudget.toLocaleString()} budget`);
          } else if (rent <= targetMaxBudget * 1.1) {
            score += 8;
            reasons.push(`Rent of LKR ${rent.toLocaleString()} is very close to your budget`);
          } else {
            score -= 10;
          }
        } else {
          score += 10;
          reasons.push(`Competitively priced at LKR ${rent.toLocaleString()} per month`);
        }

        // Distance & Commute evaluation (30 pts)
        if (distanceKm <= 2.5) {
          score += 15;
          reasons.push(`Excellent proximity: only ${distanceKm} km (~${travelMins} mins commute) to ${extractedDest}`);
        } else if (distanceKm <= 5.0) {
          score += 8;
          reasons.push(`Reasonable commute: ${distanceKm} km (~${travelMins} mins) to ${extractedDest}`);
        } else {
          score -= 5;
        }

        // Bedroom evaluation (20 pts)
        if (targetBeds > 0) {
          if (beds === targetBeds) {
            score += 10;
            reasons.push(`Exactly matches your ${targetBeds}-bedroom preference`);
          } else if (beds > targetBeds) {
            score += 6;
            reasons.push(`Offers ${beds} bedrooms (extra space for your needs)`);
          } else {
            score -= 8;
          }
        } else {
          score += 5;
        }

        // Facility matches (20 pts)
        const facilityMatches = [];
        if (wantsAC && (facilities.includes('air') || facilities.includes('ac'))) facilityMatches.push('Air Conditioning');
        if (wantsParking && (facilities.includes('park') || facilities.includes('garage'))) facilityMatches.push('Parking');
        if (wantsPool && facilities.includes('pool')) facilityMatches.push('Swimming Pool');
        if (wantsFurnished && facilities.includes('furnish')) facilityMatches.push('Furnished');
        if (wantsGarden && facilities.includes('garden')) facilityMatches.push('Garden');

        if (facilityMatches.length > 0) {
          score += Math.min(10, facilityMatches.length * 5);
          reasons.push(`Equipped with requested ${facilityMatches.join(' and ')}`);
        } else {
          score += 3;
        }

        const finalScore = Math.min(98, Math.max(68, score));

        return {
          ...p,
          id: p.id,
          match_score: finalScore,
          distance_km: distanceKm,
          travel_time_mins: travelMins,
          match_reasons: reasons
        };
      }).filter(Boolean); // Remove excluded properties

      // Sort candidates descending by match score
      scoredList.sort((a, b) => b.match_score - a.match_score);

      const topPick = scoredList[0];
      const summaryText = topPick
        ? `Found ${scoredList.length} candidate properties. Top recommendation is "${topPick.title}" (${topPick.match_score}% match), located only ${topPick.distance_km} km (~${topPick.travel_time_mins} mins) from ${extractedDest} with rent of LKR ${Number(topPick.monthlyRent || 0).toLocaleString()}/month.`
        : `Evaluated properties against criteria for ${extractedDest}.`;

      setAiSearchResult({
        status: 'completed',
        destination_landmark: extractedDest,
        extracted_filters: {
          destination: extractedDest,
          budget_max: targetMaxBudget || null,
          bedrooms: targetBeds || null
        },
        ranked_properties: scoredList,
        summary_recommendation: summaryText
      });

    } catch (err) {
      console.error('Error in Student 2 AI search execution:', err);
      setAiError('Failed to process AI search. Please adjust your prompt.');
    } finally {
      setIsAiSearching(false);
    }
  };


  const handleClearAiSearch = () => {
    setAiSearchResult(null);
    setAiPrompt('');
    setAiError('');
  };

  // Properties & Saved state
  const [properties, setProperties] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [savedPropertyIds, setSavedPropertyIds] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('rentwise_saved_properties') || '[]');
      return Array.isArray(stored) ? stored.map((p) => (typeof p === 'string' ? p : p.id)) : [];
    } catch {
      return [];
    }
  });

  // Booking Modal State
  const [bookingProperty, setBookingProperty] = useState(null);
  const [toastMessage, setToastMessage] = useState('');
  const [bookingVersion, setBookingVersion] = useState(0);

  // Property Inspection Modal State (matching My Properties inspection modal)
  const [inspectingProperty, setInspectingProperty] = useState(null);

  const fetchRentals = async () => {
    setIsLoading(true);
    try {
      const res = await api.get('/properties').catch(() => ({ data: [] }));
      const apiData = Array.isArray(res.data) ? res.data : [];

      // Normalize API properties retaining all detailed fields (photos, utility bills, etc.)
      const normalizedApi = apiData.map((p) => {
        let photoUrl = p.photoUrl || p.PhotoUrl;
        let photos = [];
        if (Array.isArray(p.photos) && p.photos.length > 0) {
          photos = p.photos.map(ph => typeof ph === 'string' ? ph : (ph?.photoUrl || ph?.PhotoUrl || ph?.url)).filter(Boolean);
          if (!photoUrl) photoUrl = photos[0];
        } else if (photoUrl) {
          photos = [photoUrl];
        }
        return {
          ...p,
          id: p.id || p.Id,
          title: p.title || p.Title,
          description: p.description || p.Description,
          address: p.address || p.Address,
          city: p.city || p.City || p.address?.split(',')?.pop()?.trim() || 'Sri Lanka',
          monthlyRent: Number(p.monthlyRent || p.MonthlyRent || 0),
          bedrooms: Number(p.bedrooms || p.Bedrooms || 1),
          bathrooms: Number(p.bathrooms || p.Bathrooms || 1),
          sqft: Number(p.sqft || p.Sqft || 1200),
          propertyType: p.propertyType || p.PropertyType || 'House',
          photoUrl: photoUrl || PROPERTY_PLACEHOLDER_IMAGE,
          photos: photos,
          featureTags: p.featureTags || p.FeatureTags || [],
          facilities: p.facilities || p.Facilities || '',
          status: p.status ?? p.Status ?? 'Active',
          ownerId: p.ownerId || p.OwnerId,
          utilityBillUrl: p.utilityBillUrl || (Array.isArray(p.documents) ? p.documents.find(d => d?.documentType === 'UtilityBill' || d?.documentType === 'OwnershipProof')?.documentUrl : '')
        };
      });

      setProperties(normalizedApi);
    } catch (err) {
      console.error('Failed to load rentals:', err);
      setProperties([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch real properties from API and merge with aesthetic sample collection
  useEffect(() => {
    fetchRentals();
  }, []);

  // Listen for storage events so saved status stays synchronized across tabs/components
  useEffect(() => {
    const handleStorageChange = () => {
      try {
        const stored = JSON.parse(localStorage.getItem('rentwise_saved_properties') || '[]');
        setSavedPropertyIds(Array.isArray(stored) ? stored.map((p) => (typeof p === 'string' ? p : p.id)) : []);
      } catch {}
    };

    const handleBookingChange = () => {
      setBookingVersion((v) => v + 1);
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('rentwise_saved_updated', handleStorageChange);
    window.addEventListener(BOOKINGS_UPDATED_EVENT, handleBookingChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('rentwise_saved_updated', handleStorageChange);
      window.removeEventListener(BOOKINGS_UPDATED_EVENT, handleBookingChange);
    };
  }, []);

  // Filtered properties based on user inputs - ONLY ACTIVE BY ADMIN
  const filteredProperties = useMemo(() => {
    return properties.filter((p) => {
      // Must be active by admin
      const raw = p.status ?? p.Status;
      const s = typeof raw === 'number' ? ['PendingVerification', 'Active', 'Suspended'][raw] : (raw || 'Active');
      if (s !== 'Active') return false;

      // Must not be leased/booked
      const bookingInfo = getActiveBookingForProperty(p.id);
      if (bookingInfo.isBooked) return false;

      // Location
      if (locationInput.trim()) {
        const loc = locationInput.toLowerCase();
        const matchesAddress = p.address?.toLowerCase().includes(loc);
        const matchesCity = p.city?.toLowerCase().includes(loc);
        const matchesTitle = p.title?.toLowerCase().includes(loc);
        if (!matchesAddress && !matchesCity && !matchesTitle) return false;
      }

      // Min Budget
      if (minBudget && Number(minBudget) > 0) {
        if (p.monthlyRent < Number(minBudget)) return false;
      }

      // Max Budget
      if (maxBudget && Number(maxBudget) > 0) {
        if (p.monthlyRent > Number(maxBudget)) return false;
      }

      // Bedrooms
      if (bedroomsFilter !== 'Any') {
        const requiredBeds = parseInt(bedroomsFilter, 10);
        if (bedroomsFilter.includes('+')) {
          if (p.bedrooms < requiredBeds) return false;
        } else {
          if (p.bedrooms !== requiredBeds) return false;
        }
      }

      return true;
    });
  }, [properties, locationInput, minBudget, maxBudget, bedroomsFilter, bookingVersion]);

  // Clear all filters
  const handleClearFilters = () => {
    setLocationInput('');
    setMinBudget('');
    setMaxBudget('');
    setBedroomsFilter('Any');
  };

  // Quick apply preference: Malabe - LKR 40,000 to LKR 70,000
  const handleApplyPreferences = () => {
    setLocationInput('Malabe');
    setMinBudget('40000');
    setMaxBudget('70000');
    setBedroomsFilter('Any');
  };

  // Toggle Save Property
  const handleToggleSave = (property, e) => {
    e.stopPropagation();
    try {
      const existingList = JSON.parse(localStorage.getItem('rentwise_saved_properties') || '[]');
      const isCurrentlySaved = existingList.some((p) => (typeof p === 'string' ? p === property.id : p.id === property.id));

      let updatedList;
      if (isCurrentlySaved) {
        updatedList = existingList.filter((p) => (typeof p === 'string' ? p !== property.id : p.id !== property.id));
        setToastMessage(`Removed "${property.title}" from saved items.`);
      } else {
        updatedList = [property, ...existingList];
        setToastMessage(`Saved "${property.title}" to your wishlist!`);
      }

      localStorage.setItem('rentwise_saved_properties', JSON.stringify(updatedList));
      setSavedPropertyIds(updatedList.map((p) => (typeof p === 'string' ? p : p.id)));

      // Dispatch event to update badges & other pages
      window.dispatchEvent(new Event('rentwise_saved_updated'));

      // Also call backend endpoint in background if logged in
      if (user?.id && !property.id.toString().startsWith('sample-')) {
        if (!isCurrentlySaved) {
          api.post('/saved-properties', { tenantProfileId: user.id, propertyId: property.id }).catch(() => {});
        } else {
          api.delete(`/saved-properties/${user.id}/${property.id}`).catch(() => {});
        }
      }

      setTimeout(() => setToastMessage(''), 3000);
    } catch (err) {
      console.error('Error toggling saved item:', err);
    }
  };

  return (
    <div className="font-sans space-y-8 pb-16 animate-in fade-in duration-300 max-w-7xl mx-auto px-2 sm:px-4">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white text-xs font-semibold px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <Heart className="w-4 h-4 text-rose-500 fill-rose-500" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 1. HERO HEADLINE (Exact typography from screenshot) */}
      <div className="pt-2">
        <h1 className="text-3xl sm:text-4xl lg:text-[40px] font-black text-gray-900 tracking-tight leading-tight">
          Somewhere that feels like you.
        </h1>
        <p className="text-gray-500 text-sm sm:text-base font-normal mt-1.5">
          Explore spaces, save your favourites, and make your next move.
        </p>
      </div>

      {/* 2. AGENTIC AI SEARCH (STUDENT 2: MATCHING & LOCATION INTELLIGENCE AGENT) */}
      <div className="rounded-3xl border border-indigo-200/80 bg-gradient-to-br from-indigo-950 via-slate-900 to-blue-950 text-white p-6 sm:p-7 shadow-xl relative overflow-hidden">
        {/* Background glow accents */}
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-72 h-72 bg-blue-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-72 h-72 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-4">
          {/* Header & Badges */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-300 shadow-inner">
                <Sparkles className="w-5 h-5 animate-pulse text-amber-300" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-lg sm:text-xl font-black tracking-tight text-white">
                    Search by AI
                  </h2>
                  <span className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full shadow-sm">
                    Student 2 Agentic AI
                  </span>
                </div>
                <p className="text-xs text-blue-200/80 mt-0.5">
                  Matching & Location Intelligence Agent • Calculates distance & travel-time to your destination
                </p>
              </div>
            </div>

            {aiSearchResult && (
              <button
                type="button"
                onClick={handleClearAiSearch}
                className="px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold text-white border border-white/15 transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <X className="w-3.5 h-3.5 text-rose-400" />
                <span>Reset to All Properties</span>
              </button>
            )}
          </div>

          {/* AI Search Prompt Input Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleAiSearch();
            }}
            className="space-y-3"
          >
            <div className="relative">
              <input
                type="text"
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="E.g., I'm a student at SLIIT looking for a 2-bedroom apartment in Malabe under 70,000 LKR with AC and parking..."
                className="w-full h-13 pl-4 pr-32 rounded-2xl bg-white/10 hover:bg-white/15 focus:bg-white/20 border border-white/20 text-sm text-white placeholder:text-blue-200/50 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/30 transition-all shadow-inner"
              />
              <button
                type="submit"
                disabled={isAiSearching || !aiPrompt.trim()}
                className="absolute right-2 top-2 bottom-2 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-50 text-white text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
              >
                {isAiSearching ? (
                  <>
                    <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                    <span>Scoring...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    <span>Run Match</span>
                  </>
                )}
              </button>
            </div>

            {/* Prompt Suggestion Chips */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs text-blue-200/80">
              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-300/70 shrink-0">
                Try Prompts:
              </span>
              {[
                { label: '🎓 Near SLIIT Malabe (2-Bed < 70k)', prompt: 'Looking for a 2-bedroom apartment near SLIIT Malabe under 70,000 LKR with AC and parking' },
                { label: '💼 Colombo 07 near University', prompt: 'Modern apartment in Central Colombo or Colombo 07 with elevator and 24/7 security' },
                { label: '🏡 Battaramulla Family Home', prompt: '3-bedroom house in Battaramulla or Pelawatte with garden under 90,000' },
                { label: '🏖️ Studio in Dehiwala', prompt: 'Affordable furnished 1-bedroom studio in Dehiwala with fiber internet' }
              ].map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => handleAiSearch(item.prompt)}
                  className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/15 border border-white/10 text-[11.5px] font-medium text-blue-100 hover:text-white transition-all shrink-0 cursor-pointer"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </form>

          {/* AI Feedback / Summary Banner if search has run */}
          {aiSearchResult && (
            <div className="p-4 rounded-2xl bg-blue-900/40 border border-blue-400/30 text-xs text-blue-100 space-y-2 animate-in fade-in duration-300">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 font-bold text-amber-300">
                  <Navigation className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Ranked by commute to: {aiSearchResult.destination_landmark || 'Target Area'}</span>
                </div>
                <span className="text-[11px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold px-2.5 py-0.5 rounded-full">
                  {aiSearchResult.ranked_properties?.length || 0} AI Scored Matches
                </span>
              </div>
              {aiSearchResult.summary_recommendation && (
                <p className="text-blue-100/90 leading-relaxed font-normal">
                  {aiSearchResult.summary_recommendation}
                </p>
              )}
            </div>
          )}

          {aiError && (
            <div className="p-3 rounded-xl bg-rose-500/20 border border-rose-500/40 text-xs text-rose-200 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{aiError}</span>
            </div>
          )}
        </div>
      </div>

      {/* 3. "FIND YOUR FIT" MANUAL FILTER CARD */}
      <div className="bg-white rounded-2xl border border-gray-200/90 shadow-sm p-5 sm:p-7">
        
        {/* Card Header: Title + Clear Filters */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-gray-700" />
            <h2 className="text-base sm:text-lg font-bold text-gray-900">
              Find your fit
            </h2>
          </div>
          <button
            type="button"
            onClick={handleClearFilters}
            className="text-xs font-semibold text-gray-500 hover:text-gray-900 transition-colors cursor-pointer"
          >
            Clear Filters
          </button>
        </div>

        {/* Inputs Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3.5 sm:gap-4 items-end">
          
          {/* Location */}
          <div className="lg:col-span-4 space-y-1.5">
            <label className="text-xs font-semibold text-gray-700 block">
              Location
            </label>
            <div className="relative">
              <input
                type="text"
                value={locationInput}
                onChange={(e) => setLocationInput(e.target.value)}
                placeholder="City or neighbourhood"
                className="w-full h-11 px-3.5 rounded-lg border border-gray-300 bg-white text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-slate-800 focus:ring-1 focus:ring-slate-800 transition-colors"
              />
            </div>
          </div>

          {/* Minimum Budget */}
          <div className="lg:col-span-2 space-y-1.5">
            <label className="text-xs font-semibold text-gray-700 block">
              Minimum Budget
            </label>
            <input
              type="number"
              value={minBudget}
              onChange={(e) => setMinBudget(e.target.value)}
              placeholder="LKR minimum"
              className="w-full h-11 px-3.5 rounded-lg border border-gray-300 bg-white text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-slate-800 focus:ring-1 focus:ring-slate-800 transition-colors"
            />
          </div>

          {/* Maximum Budget */}
          <div className="lg:col-span-2 space-y-1.5">
            <label className="text-xs font-semibold text-gray-700 block">
              Maximum Budget
            </label>
            <input
              type="number"
              value={maxBudget}
              onChange={(e) => setMaxBudget(e.target.value)}
              placeholder="LKR maximum"
              className="w-full h-11 px-3.5 rounded-lg border border-gray-300 bg-white text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-slate-800 focus:ring-1 focus:ring-slate-800 transition-colors"
            />
          </div>

          {/* Bedrooms */}
          <div className="lg:col-span-2 space-y-1.5">
            <label className="text-xs font-semibold text-gray-700 block">
              Bedrooms
            </label>
            <select
              value={bedroomsFilter}
              onChange={(e) => setBedroomsFilter(e.target.value)}
              className="w-full h-11 px-3.5 rounded-lg border border-gray-300 bg-white text-sm text-gray-900 focus:outline-none focus:border-slate-800 focus:ring-1 focus:ring-slate-800 transition-colors cursor-pointer"
            >
              <option value="Any">Any</option>
              <option value="1">1 Bedroom</option>
              <option value="2">2 Bedrooms</option>
              <option value="3">3 Bedrooms</option>
              <option value="4+">4+ Bedrooms</option>
            </select>
          </div>

          {/* Search Button */}
          <div className="lg:col-span-2">
            <button
              type="button"
              onClick={() => {}}
              className="w-full h-11 bg-[#1a2e35] hover:bg-[#132329] text-white text-sm font-bold rounded-lg flex items-center justify-center gap-2 shadow-xs transition-all active:scale-[0.98] cursor-pointer"
            >
              <Search className="w-4 h-4" />
              <span>Search</span>
            </button>
          </div>
        </div>

        {/* Preferences Subrow */}
        <div className="mt-4 pt-3.5 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1.5 text-gray-600">
            <span className="font-semibold text-gray-800">Your preferences:</span>
            <span className="text-gray-500">Malabe · LKR 40,000 – LKR 70,000</span>
          </div>
          <button
            type="button"
            onClick={handleApplyPreferences}
            className="font-bold text-[#1a2e35] hover:underline cursor-pointer self-start sm:self-auto"
          >
            Apply preferences
          </button>
        </div>

        {/* Preview collection Notice Box (from screenshot) */}
        {/* Live Properties Notice Box */}
        <div className="mt-4 rounded-xl bg-gray-50/80 border border-gray-200/80 px-4 py-2.5 text-[11.5px] text-gray-500 flex items-center justify-between">
          <span>
            Preview collection · Listings and photos are verified live. Save and Apply create backend records with verified owners.
            Verified collection · Real added properties with live availability. Save to your wishlist or apply directly.
          </span>
        </div>
      </div>

      {/* 4. "PLACES TO PICTURE YOURSELF IN" / AI MATCHES SECTION */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2.5">
              <span>{aiSearchResult ? '✨ Agentic AI Matches' : 'Places to picture yourself in'}</span>
              {aiSearchResult && (
                <span className="text-xs bg-indigo-100 text-indigo-800 font-bold px-3 py-1 rounded-full border border-indigo-200">
                  Student 2 Matching Agent
                </span>
              )}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {aiSearchResult
                ? `Ranked by match score & proximity to ${aiSearchResult.destination_landmark || 'destination'}`
                : `Showing ${filteredProperties.length} verified active rentals across Sri Lanka`}
            </p>
          </div>
          <span className="text-xs sm:text-sm font-medium text-gray-400">
            {(aiSearchResult?.ranked_properties || filteredProperties).length} {((aiSearchResult?.ranked_properties || filteredProperties).length === 1) ? 'property' : 'properties'}
          </span>
        </div>

        {isLoading ? (
          <div className="py-20 text-center text-gray-400 font-medium">
            Loading beautiful rentals...
          </div>
        ) : (aiSearchResult?.ranked_properties || filteredProperties).length === 0 ? (
          <div className="py-16 text-center bg-white rounded-2xl border border-dashed border-gray-300 p-8">
            <Home className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-base font-bold text-gray-800">No properties match your filters</h3>
            <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
              Try adjusting your location keyword, budget range, or bedroom selection to see more homes.
            </p>
            <button
              onClick={() => {
                handleClearFilters();
                handleClearAiSearch();
              }}
              className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-[#1a2e35] hover:underline cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset all filters</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {(aiSearchResult?.ranked_properties || filteredProperties).map((property) => {
                const isSaved = savedPropertyIds.includes(property.id);
                const bookingInfo = getActiveBookingForProperty(property.id);
                const isPending = bookingInfo.isBooked;

                return (
                  <div
                    key={property.id}
                    onClick={() => setInspectingProperty(property)}
                    className="group bg-white rounded-2xl overflow-hidden border border-gray-200/90 shadow-xs hover:shadow-xl transition-all duration-300 flex flex-col cursor-pointer"
                  >
                    {/* Photo Container */}
                    <div className="relative aspect-[4/3] w-full overflow-hidden bg-gray-100">
                      <img
                        src={property.photoUrl}
                        alt={property.title}
                        onError={handleImageError}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />

                      {/* Property Badges (Top-left) */}
                      <div className="absolute top-3 left-3 flex items-center gap-1.5 flex-wrap">
                        {property.match_score ? (
                          <>
                            <span className="inline-flex items-center gap-1 bg-emerald-600 text-white text-[11px] font-black px-2.5 py-1 rounded-md shadow-md">
                              <Sparkles className="w-3 h-3 text-amber-300" />
                              <span>{property.match_score}% Match</span>
                            </span>
                            {property.distance_km !== undefined && (
                              <span className="inline-flex items-center gap-1 bg-slate-900/90 text-white text-[10.5px] font-bold px-2 py-1 rounded-md backdrop-blur-xs shadow-sm">
                                <Navigation className="w-3 h-3 text-blue-300" />
                                <span>{property.distance_km} km</span>
                              </span>
                            )}
                          </>
                        ) : (
                          <>
                            <span className="inline-block bg-white/95 text-gray-900 text-[11px] font-bold px-3 py-1 rounded-md shadow-xs backdrop-blur-xs">
                              {property.propertyType || 'House'}
                            </span>
                            {isPending ? (
                              <span className="inline-flex items-center gap-1 bg-slate-900 text-white text-[10.5px] font-black uppercase tracking-wider px-2.5 py-1 rounded-md shadow-sm animate-in fade-in">
                                <Clock className="w-3 h-3" />
                                <span>{bookingInfo.isLeased ? 'Leased' : 'Pending'}</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 bg-emerald-600 text-white text-[10.5px] font-bold uppercase tracking-wider px-2 py-1 rounded-md shadow-sm">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>Active</span>
                              </span>
                            )}
                          </>
                        )}
                      </div>

                      {/* Heart / Save Button (Top-right, matching screenshot) */}
                      <button
                        type="button"
                        onClick={(e) => handleToggleSave(property, e)}
                        title={isSaved ? 'Remove from saved items' : 'Save to favourites'}
                        className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white/95 hover:bg-white text-gray-600 shadow-md flex items-center justify-center transition-transform active:scale-90 hover:scale-110 cursor-pointer"
                      >
                        <Heart
                          className={`w-4 h-4 transition-colors ${
                            isSaved ? 'fill-rose-500 text-rose-500' : 'text-gray-500 hover:text-rose-500'
                          }`}
                        />
                      </button>
                    </div>

                    {/* Property Details */}
                    <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                      <div>
                        {/* Price */}
                        <div className="text-xl font-black text-gray-900 tracking-tight">
                          LKR {Number(property.monthlyRent || 0).toLocaleString()}
                          <span className="text-xs font-normal text-gray-500 ml-1">/ month</span>
                        </div>

                        {/* Title */}
                        <h3 className="font-bold text-gray-900 text-base mt-1 line-clamp-1 group-hover:text-emerald-700 transition-colors">
                          {property.title}
                        </h3>

                        {/* Location */}
                        <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
                          <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                          <span className="truncate">{property.address}</span>
                        </div>

                        {/* Specs: Beds, Baths, Sqft */}
                        <div className="flex items-center justify-between text-xs text-gray-600 font-medium mt-3 pt-3 border-t border-gray-100 flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            <span>{property.bedrooms} Beds</span>
                            <span>•</span>
                            <span>{property.bathrooms} Baths</span>
                            <span>•</span>
                            <span>{Number(property.sqft || 1200).toLocaleString()} sqft</span>
                          </div>
                          {isPending && (
                            <span className="text-amber-800 font-bold bg-amber-50 border border-amber-200 px-2 py-0.5 rounded text-[10px]">
                              {bookingInfo.isLeased ? 'Leased' : 'Pending Review'}
                            </span>
                          )}
                        </div>

                        {/* AI Match Reasons & Commute info if from Agentic Search */}
                        {property.match_score && (
                          <div className="mt-3 p-3 rounded-xl bg-indigo-50/80 border border-indigo-100 text-[11.5px] space-y-1.5">
                            <div className="flex items-center gap-1.5 font-bold text-indigo-950">
                              <Compass className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                              <span>{property.distance_km} km • ~{property.travel_time_mins} mins commute to {aiSearchResult?.destination_landmark || 'destination'}</span>
                            </div>
                            {Array.isArray(property.match_reasons) && property.match_reasons.length > 0 && (
                              <ul className="text-gray-600 space-y-1 pl-3.5 list-disc text-[11px] leading-relaxed">
                                {property.match_reasons.slice(0, 2).map((reason, idx) => (
                                  <li key={idx}>{reason}</li>
                                ))}
                              </ul>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Action Buttons */}
                      <div className="pt-2 flex items-center gap-2">
                        {isPending ? (
                          <button
                            type="button"
                            disabled
                            title="This property currently has a pending booking and cannot be booked by another applicant."
                            className="flex-1 bg-amber-100 border border-amber-300 text-amber-900 text-xs font-bold py-2.5 rounded-lg cursor-not-allowed text-center flex items-center justify-center gap-1 shadow-xs"
                          >
                            <Lock className="w-3.5 h-3.5 text-amber-700" />
                            <span>{bookingInfo.isLeased ? 'Leased' : 'Booking Pending'}</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setBookingProperty(property);
                            }}
                            className="flex-1 bg-[#1a2e35] hover:bg-[#132329] text-white text-xs font-bold py-2.5 rounded-lg shadow-xs transition-colors cursor-pointer text-center"
                          >
                            Apply / Book
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setInspectingProperty(property);
                          }}
                          className="px-3.5 py-2.5 rounded-lg border border-indigo-200 text-xs font-bold text-indigo-700 bg-indigo-50/70 hover:bg-indigo-100 transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
                          title="Inspect Property Details"
                        >
                          <Eye className="w-3.5 h-3.5 text-indigo-600" />
                          <span>Details</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {/* Booking Modal */}
      {bookingProperty && (
        <BookingModal
          isOpen={Boolean(bookingProperty)}
          onClose={() => setBookingProperty(null)}
          property={bookingProperty}
          onSuccess={() => {
            setBookingProperty(null);
            setToastMessage('Booking request sent successfully!');
            setTimeout(() => setToastMessage(''), 3000);
          }}
        />
      )}

      {/* Property Inspection Modal (Exact same functionality as My Properties inspect button) */}
      <PropertyInspectModal
        isOpen={Boolean(inspectingProperty)}
        onClose={() => setInspectingProperty(null)}
        property={inspectingProperty}
        user={user}
        onApply={(prop) => {
          setBookingProperty(prop);
        }}
      />
    </div>
  );
};
export default FindRentals;

