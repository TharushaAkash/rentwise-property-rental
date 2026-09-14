import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { 
  Home, 
  Search, 
  SlidersHorizontal, 
  MapPin, 
  Bed, 
  Bath, 
  ShieldCheck, 
  Sparkles, 
  ArrowRight, 
  Building2, 
  Key, 
  Compass, 
  ChevronRight,
  Star,
  CheckCircle2,
  Bookmark,
  Bell,
  Share2,
  X,
  Camera
} from 'lucide-react';
import { formatLankaPrice } from '../../data/lankaProperties';
import { LankaPropertyCard } from '../../components/LankaPropertyCard';
import { PROPERTY_PLACEHOLDER_IMAGE } from '../../utils/imagePlaceholder';
import { matchPropertiesWithAi, AI_SUGGESTED_PROMPTS } from '../../utils/aiPropertyMatcher';


const InstagramIcon = (props) => (
  <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <rect width="20" height="20" x="2" y="2" rx="5" ry="5"/>
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
    <line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/>
  </svg>
);

const LinkedinIcon = (props) => (
  <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/>
    <rect width="4" height="12" x="2" y="9"/>
    <circle cx="4" cy="4" r="2"/>
  </svg>
);

const TwitterIcon = (props) => (
  <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z"/>
  </svg>
);

const HERO_BG = 'https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&w=2160&q=85';
const LEGACY_IMG_1 = 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80';
const LEGACY_IMG_2 = 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1200&q=80';

const FALLBACK_PROPERTY_IMAGES = [
  'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1600566753376-12c8ab7fb75b?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1613977257363-707ba9348227?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1600585154526-990dced4db0d?auto=format&fit=crop&w=1200&q=80'
];

const formatMoney = (val) => `Rs. ${Number(val || 0).toLocaleString()}`;

export const Landing = () => {
  const navigate = useNavigate();
  const [properties, setProperties] = useState([]);
  const [loadingProperties, setLoadingProperties] = useState(true);

  // Search & Filter States
  const [searchLocation, setSearchLocation] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [propertyType, setPropertyType] = useState('');
  const [bedrooms, setBedrooms] = useState('');

  // AI Matching States
  const [searchMode, setSearchMode] = useState('standard'); // 'standard' | 'ai'
  const [aiPrompt, setAiPrompt] = useState('');
  const [activeAiPrompt, setActiveAiPrompt] = useState('');
  const [isAiSearching, setIsAiSearching] = useState(false);
  const [aiMatchedProperties, setAiMatchedProperties] = useState(null);

  // Favorites
  const [savedIds, setSavedIds] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('rentwise_saved_properties') || '[]');
    } catch {
      return [];
    }
  });

  const toggleSave = (propertyId, e) => {
    if (e) e.stopPropagation();
    setSavedIds((prev) => {
      const next = prev.includes(propertyId) ? prev.filter((id) => id !== propertyId) : [...prev, propertyId];
      try {
        localStorage.setItem('rentwise_saved_properties', JSON.stringify(next));
      } catch (err) {
        console.error(err);
      }
      return next;
    });
  };

  // Fetch real properties added to the system
  useEffect(() => {
    setLoadingProperties(true);
    api.get('/properties')
      .then((res) => {
        setProperties(res.data || []);
      })
      .catch((err) => {
        console.error('Failed to load properties', err);
        setProperties([]);
      })
      .finally(() => {
        setLoadingProperties(false);
      });
  }, []);

  // Map ONLY real added properties from the system
  const realProperties = useMemo(() => {
    return properties.map((p) => {
      const primaryPhoto = p.photos && Array.isArray(p.photos) && p.photos.length > 0 
        ? (p.photos.find((ph) => ph.isPrimary || ph.IsPrimary)?.photoUrl || 
           p.photos.find((ph) => ph.isPrimary || ph.IsPrimary)?.PhotoUrl || 
           p.photos[0]?.photoUrl || 
           p.photos[0]?.PhotoUrl || 
           p.photos[0]?.url)
        : (p.photoUrl || p.PhotoUrl || PROPERTY_PLACEHOLDER_IMAGE);

      return {
        id: p.id,
        title: p.title || 'Untitled Property',
        address: p.address || 'Address not specified',
        city: p.city || p.address?.split(',').pop()?.trim() || 'Colombo',
        monthlyRent: p.monthlyRent || 0,
        bedrooms: p.bedrooms || 0,
        bathrooms: p.bathrooms || 0,
        sqft: p.sqft || (p.bedrooms ? p.bedrooms * 750 + 500 : 1200),
        propertyType: p.propertyType || (p.title?.toLowerCase().includes('apartment') ? 'Apartment' : 'House'),
        photosCount: p.photos?.length || (primaryPhoto && primaryPhoto !== PROPERTY_PLACEHOLDER_IMAGE ? 1 : 0),
        photoUrl: primaryPhoto,
        photos: p.photos || [],
        description: p.description || 'No description provided.',
        featureTag: p.facilities?.split(',')[0]?.trim() || (p.status || 'Verified Listing'),
        isUrgent: p.status === 'Urgent' || Boolean(p.isUrgent)
      };
    });
  }, [properties]);

  // Filter ONLY real properties dynamically by standard filters
  const filteredProperties = useMemo(() => {
    return realProperties.filter((p) => {
      const text = `${p.title || ''} ${p.address || ''} ${p.city || ''} ${p.facilities || ''} ${p.description || ''}`.toLowerCase();
      const matchesQuery = !searchLocation || text.includes(searchLocation.toLowerCase());
      const matchesPrice = !minPrice || Number(p.monthlyRent || 0) <= Number(minPrice);
      const matchesBeds = !bedrooms || Number(p.bedrooms || 0) >= Number(bedrooms);
      const matchesType = !propertyType || (p.propertyType && p.propertyType.toLowerCase() === propertyType.toLowerCase()) || text.includes(propertyType.toLowerCase());
      return matchesQuery && matchesPrice && matchesBeds && matchesType;
    });
  }, [realProperties, searchLocation, minPrice, propertyType, bedrooms]);

  // Execute AI semantic matching search
  const handleAiSearch = (promptOverride) => {
    const target = typeof promptOverride === 'string' ? promptOverride : aiPrompt;
    if (!target || !target.trim()) return;

    setAiPrompt(target);
    setIsAiSearching(true);

    setTimeout(() => {
      const results = matchPropertiesWithAi(target, realProperties);
      setAiMatchedProperties(results);
      setActiveAiPrompt(target);
      setIsAiSearching(false);
      document.getElementById('featured')?.scrollIntoView({ behavior: 'smooth' });
    }, 350);
  };

  // Clear AI active search filter
  const handleClearAiSearch = () => {
    setActiveAiPrompt('');
    setAiMatchedProperties(null);
    setAiPrompt('');
  };

  // Properties to display (either ranked by AI or filtered by standard criteria)
  const displayedProperties = useMemo(() => {
    if (activeAiPrompt && aiMatchedProperties !== null) {
      return aiMatchedProperties;
    }
    return filteredProperties;
  }, [activeAiPrompt, aiMatchedProperties, filteredProperties]);

  const handleSearch = (e) => {
    e.preventDefault();
    handleClearAiSearch();
    document.getElementById('featured')?.scrollIntoView({ behavior: 'smooth' });
  };


  return (
    <div className="min-h-screen bg-[#0d1322] text-slate-100 font-sans selection:bg-blue-600 selection:text-white">
      
      {/* 1. Translucent Luxury Navbar */}
      <nav className="fixed w-full z-50 top-0 transition-all duration-300 bg-slate-950/60 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          
          {/* Brand Logo */}
          <div 
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="flex items-center gap-2.5 cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/30 group-hover:scale-105 transition-transform">
              <Home className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-black tracking-tight text-white">
              Rent<span className="text-blue-500">Wise</span>
            </span>
          </div>

          {/* Navigation Links */}
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-300">
            <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="text-white hover:text-blue-400 transition-colors">
              Home
            </button>
            <button onClick={() => navigate('/properties')} className="hover:text-white transition-colors">
              Properties ({properties.length})
            </button>
            <a href="#about" className="hover:text-white transition-colors">
              About
            </a>
            <a href="#featured" className="hover:text-white transition-colors">
              Collection
            </a>
            <a href="#contact" className="hover:text-white transition-colors">
              Contact
            </a>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            <button 
              onClick={() => navigate('/login')} 
              className="px-5 py-2 text-sm font-medium text-white/90 hover:text-white bg-white/10 hover:bg-white/15 rounded-full border border-white/20 backdrop-blur-sm transition-all"
            >
              Sign In
            </button>
            <button 
              onClick={() => navigate('/register')} 
              className="px-6 py-2 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 rounded-full shadow-lg shadow-blue-600/30 hover:shadow-blue-600/50 hover:-translate-y-0.5 transition-all"
            >
              Join Now
            </button>
          </div>
        </div>
      </nav>

      {/* 2. Hero Section with Luxury Villa Sunset Background */}
      <section className="relative min-h-screen flex flex-col justify-between pt-32 pb-16 px-6 overflow-hidden">
        {/* Full-bleed Photo with Deep Gradient Overlays */}
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-transform duration-1000 scale-100"
          style={{ backgroundImage: `url('${HERO_BG}')` }}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-[#0d1322] via-black/45 to-black/60" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-transparent to-black/40" />
        </div>

        {/* Hero Content */}
        <div className="relative z-10 max-w-5xl mx-auto text-center mt-12 sm:mt-20">
          
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/20 text-blue-300 text-xs font-semibold tracking-wider uppercase backdrop-blur-md mb-6 animate-in fade-in duration-700">
            <Sparkles className="w-3.5 h-3.5 text-blue-400" />
            Curated Architectural Residences
          </div>

          <h1 className="text-5xl sm:text-7xl font-extrabold text-white tracking-tight leading-[1.08] drop-shadow-lg max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700">
            Your Dream Home Awaits
          </h1>

          <p className="mt-5 text-lg sm:text-xl text-slate-200/90 max-w-2xl mx-auto leading-relaxed drop-shadow animate-in fade-in slide-in-from-bottom-6 duration-700 delay-150">
            Discover the finest luxury real estate. From elegant city apartments to sprawling country estates, find your perfect match with RentWise.
          </p>
        </div>

        {/* 3. Floating Interactive Real Estate Search Widget */}
        <div className="relative z-10 max-w-4xl w-full mx-auto mt-12 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-300">
          <div className="rounded-3xl bg-slate-900/85 backdrop-blur-2xl border border-white/15 p-5 sm:p-6 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.7)]">
            
            {/* Top Bar: Search Mode Tabs + Real-time Live Badge */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 border-b border-white/10 pb-4">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSearchMode('standard')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                    searchMode === 'standard'
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30'
                      : 'text-slate-300 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Search className="w-4 h-4" />
                  <span>Standard Filters</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSearchMode('ai')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                    searchMode === 'ai'
                      ? 'bg-gradient-to-r from-violet-600 via-indigo-600 to-blue-600 text-white shadow-lg shadow-indigo-500/30 border border-white/20'
                      : 'text-slate-300 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
                  <span>AI Property Match</span>
                  <span className="px-1.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300 text-[10px] uppercase font-black tracking-wider border border-amber-400/30">
                    AI
                  </span>
                </button>
              </div>

              {/* Status Indicator */}
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-full bg-emerald-500 text-slate-950 font-black text-[10.5px] tracking-wider uppercase shadow-md shadow-emerald-500/20">
                  RENT
                </span>
                <span className="text-xs text-slate-400 font-medium">
                  {properties.length > 0 ? `${properties.length} listings available` : 'MLS Catalog'}
                </span>
              </div>
            </div>

            {/* Mode 1: Standard Filter Form */}
            {searchMode === 'standard' && (
              <form onSubmit={handleSearch} className="space-y-3 animate-in fade-in duration-200">
                {/* Primary Location Input + Search Button */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                      <Search className="w-5 h-5" />
                    </div>
                    <input
                      type="text"
                      value={searchLocation}
                      onChange={(e) => setSearchLocation(e.target.value)}
                      placeholder="Type a city, district, or property title (e.g. Colombo, Kandy, Galle)..."
                      className="w-full pl-12 pr-4 py-3.5 rounded-2xl bg-white/10 border border-white/15 text-white placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white/15 transition-all"
                    />
                  </div>
                  
                  <button
                    type="submit"
                    className="px-8 py-3.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold rounded-2xl shadow-lg shadow-orange-500/30 hover:shadow-orange-500/50 transition-all flex items-center justify-center gap-2 text-sm tracking-wide uppercase cursor-pointer"
                  >
                    <Search className="w-4 h-4" />
                    <span>Search</span>
                  </button>
                </div>

                {/* Secondary Filter Dropdowns */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  <select
                    value={minPrice}
                    onChange={(e) => setMinPrice(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-white/10 border border-white/15 text-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all cursor-pointer"
                  >
                    <option value="" className="bg-slate-900 text-white">Max Rent (Any)</option>
                    <option value="50000" className="bg-slate-900 text-white">Under Rs. 50,000</option>
                    <option value="100000" className="bg-slate-900 text-white">Under Rs. 100,000</option>
                    <option value="200000" className="bg-slate-900 text-white">Under Rs. 200,000</option>
                    <option value="500000" className="bg-slate-900 text-white">Under Rs. 500,000</option>
                  </select>

                  <select
                    value={propertyType}
                    onChange={(e) => setPropertyType(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-white/10 border border-white/15 text-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all cursor-pointer"
                  >
                    <option value="" className="bg-slate-900 text-white">Property Keyword (All)</option>
                    <option value="Villa" className="bg-slate-900 text-white">Luxury Villa</option>
                    <option value="Apartment" className="bg-slate-900 text-white">City Apartment</option>
                    <option value="House" className="bg-slate-900 text-white">Private House</option>
                    <option value="Modern" className="bg-slate-900 text-white">Modern Residence</option>
                  </select>

                  <select
                    value={bedrooms}
                    onChange={(e) => setBedrooms(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-white/10 border border-white/15 text-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all cursor-pointer"
                  >
                    <option value="" className="bg-slate-900 text-white">Bedrooms (Any)</option>
                    <option value="1" className="bg-slate-900 text-white">1+ Bedroom</option>
                    <option value="2" className="bg-slate-900 text-white">2+ Bedrooms</option>
                    <option value="3" className="bg-slate-900 text-white">3+ Bedrooms</option>
                    <option value="4" className="bg-slate-900 text-white">4+ Bedrooms</option>
                  </select>
                </div>

                {/* Switch to AI callout */}
                <div className="pt-2 text-center sm:text-left">
                  <button
                    type="button"
                    onClick={() => setSearchMode('ai')}
                    className="inline-flex items-center gap-1.5 text-xs text-indigo-300 hover:text-indigo-200 font-medium hover:underline cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    <span>Have specific requirements? Try our <strong>AI Property Matcher</strong> &rarr;</span>
                  </button>
                </div>
              </form>
            )}

            {/* Mode 2: Dedicated AI Matching Search Box */}
            {searchMode === 'ai' && (
              <div className="space-y-4 animate-in fade-in duration-300">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping" />
                      <span>Natural Language AI Property Finder</span>
                    </h3>
                    <p className="text-[11.5px] text-slate-300 mt-0.5">
                      Describe your ideal living space in plain words (rooms, city, amenities, budget).
                    </p>
                  </div>
                  <span className="text-[10px] font-bold text-indigo-300 bg-indigo-500/20 px-2.5 py-1 rounded-full border border-indigo-500/30 shrink-0 self-start sm:self-center">
                    Instant AI Scoring
                  </span>
                </div>

                {/* AI Input Form */}
                <form onSubmit={(e) => { e.preventDefault(); handleAiSearch(); }} className="relative">
                  <div className="relative rounded-2xl bg-white/10 border-2 border-indigo-500/40 hover:border-indigo-500/70 focus-within:border-indigo-400 transition-all p-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 backdrop-blur-md shadow-inner">
                    <div className="flex-1 flex items-center gap-3 px-3 py-1.5">
                      <Sparkles className="w-5 h-5 text-indigo-400 shrink-0 animate-pulse" />
                      <input
                        type="text"
                        value={aiPrompt}
                        onChange={(e) => setAiPrompt(e.target.value)}
                        placeholder="e.g. 2 bedroom luxury apartment in Colombo with swimming pool and AC under 150k..."
                        className="w-full bg-transparent text-white placeholder-slate-400 text-xs sm:text-sm outline-none font-medium"
                      />
                      {aiPrompt && (
                        <button
                          type="button"
                          onClick={() => setAiPrompt('')}
                          className="text-slate-400 hover:text-white p-1 cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    <button
                      type="submit"
                      disabled={isAiSearching || !aiPrompt.trim()}
                      className="px-7 py-3 rounded-xl bg-gradient-to-r from-violet-600 via-indigo-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 text-white font-bold text-xs sm:text-sm uppercase tracking-wider shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer shrink-0 active:scale-95"
                    >
                      {isAiSearching ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>Matching...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 text-amber-300" />
                          <span>Match with AI</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>

                {/* Quick Inspiration Prompt Pills */}
                <div className="pt-1">
                  <div className="flex items-center gap-1.5 mb-2 text-[11px] font-semibold text-slate-400">
                    <span>Try asking the AI:</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {AI_SUGGESTED_PROMPTS.map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        onClick={() => handleAiSearch(prompt)}
                        className="px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/15 border border-white/10 text-xs text-slate-300 hover:text-white transition-all text-left flex items-center gap-1.5 cursor-pointer active:scale-95"
                      >
                        <span>{prompt}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 4. "Our Legacy" Section matching mockup */}
      <section id="about" className="py-24 sm:py-32 px-6 bg-white text-slate-900">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-12 gap-12 lg:gap-16 items-center">
            
            {/* Visual Side: Multi-image overlapping architectural cards */}
            <div className="lg:col-span-6 relative">
              <div className="relative z-10 w-[85%] rounded-[32px] overflow-hidden shadow-2xl border-4 border-white">
                <img 
                  src={LEGACY_IMG_1} 
                  alt="Luxury modern interior" 
                  className="w-full h-[380px] sm:h-[420px] object-cover hover:scale-105 transition-transform duration-700"
                />
              </div>
              
              {/* Secondary Overlapping Pool Terrace Image */}
              <div className="absolute -bottom-10 -right-2 sm:-right-4 z-20 w-[65%] rounded-[28px] overflow-hidden shadow-2xl border-4 border-white">
                <img 
                  src={LEGACY_IMG_2} 
                  alt="Sunset pool terrace" 
                  className="w-full h-[240px] sm:h-[280px] object-cover hover:scale-105 transition-transform duration-700"
                />
              </div>

              {/* Decorative Glow */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-blue-100 rounded-full blur-3xl -z-10" />
            </div>

            {/* Content Side */}
            <div className="lg:col-span-6 space-y-6 lg:pl-6 mt-10 lg:mt-0">
              <div className="inline-block text-xs font-extrabold uppercase tracking-[0.25em] text-blue-600">
                OUR LEGACY
              </div>

              <h2 className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight">
                Redefining the Higher Standard of Living
              </h2>

              <p className="text-slate-600 text-base sm:text-lg leading-relaxed">
                At RentWise, we don't just list properties; we curate lifestyle benchmarks. Our portfolio represents the pinnacle of architectural excellence, community integration, and effortless digital management.
              </p>

              {/* Stats Counters */}
              <div className="grid grid-cols-3 gap-6 pt-4 border-t border-slate-100">
                <div>
                  <div className="text-3xl sm:text-4xl font-black text-blue-600">
                    12k+
                  </div>
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mt-1">
                    Premium Assets
                  </div>
                </div>
                <div>
                  <div className="text-3xl sm:text-4xl font-black text-blue-600">
                    98%
                  </div>
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mt-1">
                    Success Rate
                  </div>
                </div>
                <div>
                  <div className="text-3xl sm:text-4xl font-black text-blue-600">
                    25y
                  </div>
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mt-1">
                    Real Estate Glory
                  </div>
                </div>
              </div>

              {/* Call to Action */}
              <div className="pt-4">
                <button
                  onClick={() => document.getElementById('featured')?.scrollIntoView({ behavior: 'smooth' })}
                  className="px-8 py-4 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm tracking-wide shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:-translate-y-0.5 transition-all inline-flex items-center gap-2"
                >
                  <span>Begin Your Journey</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* 5. LankaPropertyWeb Style Real Properties Showcase */}
      <section id="featured" className="py-14 px-4 sm:px-6 lg:px-8 bg-[#f8faf9] text-gray-900 border-t border-gray-200">
        <div className="max-w-7xl mx-auto space-y-6">
          
          {/* Breadcrumbs, Header Title, and Actions Toolbar */}
          <div className="space-y-3">
            <div className="text-[11.5px] text-gray-500 flex items-center gap-1">
              <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="hover:text-[#008037] cursor-pointer">Home</button>
              <span>&gt;</span>
              <span className="hover:text-[#008037] cursor-pointer">Rentals</span>
              <span>&gt;</span>
              <span className="text-gray-800 font-medium">{propertyType ? `${propertyType}s` : 'Houses'}</span>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-200 pb-3">
              <div>
                <h2 className="text-xl sm:text-2xl font-extrabold text-gray-900 tracking-tight">
                  {activeAiPrompt ? 'AI Matched Properties' : (propertyType ? `${propertyType}s` : 'Real Properties')} for rent in Sri Lanka{' '}
                  <span className="text-gray-500 font-normal text-sm">
                    ({displayedProperties.length} {displayedProperties.length === 1 ? 'property' : 'properties'})
                  </span>
                </h2>
              </div>

              {/* Action Pills & Pagination */}
              <div className="flex items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => alert('Search filters saved to your session.')}
                  className="inline-flex items-center gap-1 border border-gray-300 rounded px-2.5 py-1 text-gray-700 hover:bg-gray-50 font-medium bg-white shadow-2xs cursor-pointer"
                >
                  <Bookmark className="w-3.5 h-3.5 text-gray-500" />
                  <span>Save Search</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (navigator.clipboard) {
                      navigator.clipboard.writeText(window.location.href);
                      alert('Listing link copied to clipboard!');
                    }
                  }}
                  className="inline-flex items-center gap-1 border border-gray-300 rounded px-2.5 py-1 text-gray-700 hover:bg-gray-50 font-medium bg-white shadow-2xs cursor-pointer"
                >
                  <Share2 className="w-3.5 h-3.5 text-gray-500" />
                  <span>Share</span>
                </button>

                {/* Pagination */}
                <div className="hidden sm:flex items-center gap-1 ml-2">
                  <span className="w-6 h-6 rounded bg-[#008037] text-white font-bold flex items-center justify-center text-xs shadow-xs">
                    1
                  </span>
                  <span className="w-6 h-6 rounded border border-gray-200 text-gray-600 font-medium flex items-center justify-center text-xs hover:bg-gray-50 cursor-pointer bg-white">
                    2
                  </span>
                  <span className="w-6 h-6 rounded border border-gray-200 text-gray-600 font-medium flex items-center justify-center text-xs hover:bg-gray-50 cursor-pointer bg-white">
                    3
                  </span>
                  <span className="w-6 h-6 rounded border border-gray-200 text-gray-600 font-medium flex items-center justify-center text-xs hover:bg-gray-50 cursor-pointer bg-white">
                    &gt;
                  </span>
                </div>
              </div>
            </div>

            {/* Active AI Search Status Banner */}
            {activeAiPrompt && (
              <div className="rounded-xl bg-gradient-to-r from-violet-900 via-indigo-900 to-slate-900 text-white p-4 shadow-sm border border-indigo-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center text-white shrink-0 shadow-sm">
                    <Sparkles className="w-5 h-5 text-amber-300 animate-pulse" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold text-indigo-300 uppercase tracking-wider">AI Property Match Active</span>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-extrabold border border-emerald-500/30">
                        {displayedProperties.length} {displayedProperties.length === 1 ? 'Match' : 'Matches'}
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm font-semibold text-white mt-0.5">
                      "{activeAiPrompt}"
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleClearAiSearch}
                  className="px-3.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/20 transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Clear AI Filter</span>
                </button>
              </div>
            )}

            {/* Inline AI Quick Search Bar (Alternative Search Box right above listings) */}
            <div className="rounded-xl bg-white border border-indigo-100 p-3 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white shrink-0 shadow-xs">
                  <Sparkles className="w-4 h-4 text-amber-300" />
                </div>
                <div>
                  <div className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                    <span>AI Property Matcher</span>
                    <span className="text-[9.5px] font-black uppercase text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200">New</span>
                  </div>
                  <p className="text-[11px] text-gray-500">Search naturally by budget, location, and desired amenities</p>
                </div>
              </div>

              <form 
                onSubmit={(e) => { e.preventDefault(); handleAiSearch(); }}
                className="flex items-center gap-2 flex-1 max-w-lg"
              >
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    placeholder="e.g. 2-bed apartment in Colombo with pool under 150k..."
                    className="w-full pl-3 pr-8 py-2 rounded-lg bg-gray-50 border border-gray-300 text-gray-900 placeholder-gray-400 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                  />
                  {aiPrompt && (
                    <button
                      type="button"
                      onClick={() => setAiPrompt('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isAiSearching || !aiPrompt.trim()}
                  className="px-4 py-2 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold text-xs shadow-xs flex items-center gap-1.5 shrink-0 transition-all cursor-pointer disabled:opacity-50 active:scale-95"
                >
                  {isAiSearching ? (
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  )}
                  <span>Match with AI</span>
                </button>
              </form>
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
                    onClick={() => setPropertyType(propertyType === pill.val ? '' : pill.val)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition-all cursor-pointer ${
                      propertyType === pill.val
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
              <span className="text-gray-500 font-semibold text-[11px] uppercase mr-1">Top Cities:</span>
              {['Colombo', 'Dehiwala', 'Nugegoda', 'Kandy', 'Rajagiriya', 'Battaramulla', 'Negombo', 'Galle'].map((cityName) => (
                <button
                  key={cityName}
                  type="button"
                  onClick={() => setSearchLocation(searchLocation === cityName ? '' : cityName)}
                  className={`rounded-full border px-3 py-0.5 text-xs font-medium transition-all cursor-pointer ${
                    searchLocation === cityName
                      ? 'border-[#008037] bg-emerald-50 text-[#008037] font-bold shadow-xs'
                      : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400 hover:bg-gray-50'
                  }`}
                >
                  {cityName}
                </button>
              ))}
            </div>

            {/* Active Filters Tag Pills */}
            {(propertyType || searchLocation || minPrice || bedrooms) && (
              <div className="flex flex-wrap items-center gap-2 text-xs pt-1">
                {propertyType && (
                  <span className="inline-flex items-center gap-1.5 rounded bg-gray-200/80 border border-gray-300 px-2.5 py-1 font-semibold text-gray-800">
                    <span>{propertyType}</span>
                    <button type="button" onClick={() => setPropertyType('')} className="text-gray-400 hover:text-gray-700 font-bold cursor-pointer">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
                )}
                {searchLocation && (
                  <span className="inline-flex items-center gap-1.5 rounded bg-gray-200/80 border border-gray-300 px-2.5 py-1 font-semibold text-gray-800">
                    <span>{searchLocation}</span>
                    <button type="button" onClick={() => setSearchLocation('')} className="text-gray-400 hover:text-gray-700 font-bold cursor-pointer">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
                )}
                {minPrice && (
                  <span className="inline-flex items-center gap-1.5 rounded bg-gray-200/80 border border-gray-300 px-2.5 py-1 font-semibold text-gray-800">
                    <span>Under Rs. {Number(minPrice).toLocaleString()}</span>
                    <button type="button" onClick={() => setMinPrice('')} className="text-gray-400 hover:text-gray-700 font-bold cursor-pointer">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
                )}
                {bedrooms && (
                  <span className="inline-flex items-center gap-1.5 rounded bg-gray-200/80 border border-gray-300 px-2.5 py-1 font-semibold text-gray-800">
                    <span>{bedrooms}+ Beds</span>
                    <button type="button" onClick={() => setBedrooms('')} className="text-gray-400 hover:text-gray-700 font-bold cursor-pointer">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setPropertyType('');
                    setSearchLocation('');
                    setMinPrice('');
                    setBedrooms('');
                  }}
                  className="text-[11px] font-bold text-[#0066cc] hover:underline uppercase tracking-wide ml-1 cursor-pointer"
                >
                  RESET ALL
                </button>
              </div>
            )}
          </div>

          {/* 3-Column Grid + Right Sidebar */}
          <div className="flex flex-col lg:flex-row gap-6 items-start">
            {/* Left/Center: Property Listings Grid */}
            <div className="flex-1 min-w-0">
              {loadingProperties ? (
                <div className="py-24 text-center text-gray-500 font-medium bg-white rounded-xl border border-gray-200">
                  <div className="w-8 h-8 border-3 border-[#008037] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                  Loading verified property catalog...
                </div>
              ) : displayedProperties.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-300 p-16 text-center text-gray-500 bg-white">
                  <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="font-bold text-gray-800 text-lg">
                    {activeAiPrompt 
                      ? 'No Properties Match Your AI Query' 
                      : properties.length === 0 
                      ? 'No Properties Added Yet' 
                      : 'No properties match your current search'}
                  </p>
                  <p className="text-xs text-gray-500 mt-1 max-w-md mx-auto">
                    {activeAiPrompt
                      ? `We couldn't find listings matching "${activeAiPrompt}". Try asking with a different budget or broader location.`
                      : properties.length === 0
                      ? 'Real properties added by property owners will appear here in real-time. Register as a Property Owner to publish your first listing.'
                      : 'Try clearing your search terms or resetting filters to view all active listings.'}
                  </p>
                  {activeAiPrompt ? (
                    <button
                      onClick={handleClearAiSearch}
                      className="mt-4 rounded bg-[#008037] hover:bg-[#00662c] px-5 py-2 text-xs font-bold text-white shadow-sm cursor-pointer"
                    >
                      Clear AI Search & Show All Listings
                    </button>
                  ) : properties.length === 0 ? (
                    <button
                      onClick={() => navigate('/register')}
                      className="mt-5 rounded bg-[#ff5a00] hover:bg-[#e04f00] px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-sm cursor-pointer transition-all"
                    >
                      Register as Property Owner
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        setSearchLocation('');
                        setMinPrice('');
                        setPropertyType('');
                        setBedrooms('');
                      }}
                      className="mt-4 rounded bg-[#ff5a00] hover:bg-[#e04f00] px-5 py-2 text-xs font-bold text-white shadow-sm cursor-pointer"
                    >
                      Reset All Filters
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                  {displayedProperties.map((property, index) => {
                    const isSaved = savedIds.includes(property.id);

                    return (
                      <React.Fragment key={property.id}>
                        {/* Insert Auth Callout Banner after 9 items (matching Row 3 -> Row 4 transition in screenshot) */}
                        {index === 9 && (
                          <div className="col-span-1 sm:col-span-2 xl:col-span-3 rounded-lg border border-gray-200 bg-white p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4 my-2">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xl">
                                👤
                              </div>
                              <span className="text-xs sm:text-sm font-semibold text-gray-800">
                                Log in or register here to access features and facilities.
                              </span>
                            </div>
                            <div className="flex items-center gap-2.5 shrink-0">
                              <button
                                onClick={() => navigate('/login')}
                                className="px-5 py-2 rounded bg-[#008037] hover:bg-[#00662c] text-white text-xs font-bold uppercase tracking-wider shadow-xs transition-all cursor-pointer"
                              >
                                Login
                              </button>
                              <button
                                onClick={() => navigate('/register')}
                                className="px-5 py-2 rounded bg-[#008037] hover:bg-[#00662c] text-white text-xs font-bold uppercase tracking-wider shadow-xs transition-all cursor-pointer"
                              >
                                Register
                              </button>
                            </div>
                          </div>
                        )}

                        <LankaPropertyCard
                          property={property}
                          isSaved={isSaved}
                          onToggleSave={toggleSave}
                          onSelect={(p) => navigate(`/properties/${p.id}`, { state: { property: p } })}
                          onBook={(p) => navigate(`/properties/${p.id}?book=true`, { state: { property: p } })}
                          actionButtonText="View & Book"
                        />
                      </React.Fragment>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Right Sidebar: Featured Projects, Other Top Cities, Ad Banner, Top Searches */}
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
                  onClick={() => { setSearchLocation('Colombo'); document.getElementById('featured')?.scrollIntoView({ behavior: 'smooth' }); }}
                  className="mt-3 w-full py-1.5 text-xs font-bold text-[#008037] border border-[#008037] rounded hover:bg-emerald-50 transition-colors text-center cursor-pointer"
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
                      onClick={() => { setSearchLocation(city); document.getElementById('featured')?.scrollIntoView({ behavior: 'smooth' }); }}
                      className="text-left text-gray-700 hover:text-[#008037] hover:underline font-medium truncate cursor-pointer"
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
                  onClick={() => navigate('/register')}
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
                    'One-room rentals in Sri Lanka',
                    'Houses for rent in Sri Lanka for less than 50,000',
                    'Houses for rent in Sri Lanka for less than 30,000'
                  ].map((searchItem) => (
                    <li key={searchItem}>
                      <button
                        type="button"
                        onClick={() => {
                          if (searchItem.includes('50,000')) setMinPrice('50000');
                          else if (searchItem.includes('30,000')) setMinPrice('30000');
                          else if (searchItem.includes('Apartment')) setPropertyType('Apartment');
                          else if (searchItem.includes('Villa')) setPropertyType('Villa');
                          else setSearchLocation(searchItem.split(' ')[0]);
                          document.getElementById('featured')?.scrollIntoView({ behavior: 'smooth' });
                        }}
                        className="text-left text-gray-600 hover:text-[#008037] hover:underline text-[11.5px] cursor-pointer"
                      >
                        {searchItem}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>

            </div>
          </div>

        </div>
      </section>

      {/* 6. Luxury Footer directly matching screenshot */}
      <footer id="contact" className="bg-[#070b14] text-slate-400 pt-20 pb-12 border-t border-slate-800/80">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 pb-16 border-b border-slate-800/60">
            
            {/* Brand column */}
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white">
                  <Home className="w-4 h-4" />
                </div>
                <span className="text-xl font-black text-white">
                  Rent<span className="text-blue-500">Wise</span>
                </span>
              </div>
              <p className="text-sm text-slate-400 leading-relaxed max-w-sm">
                The global benchmark for luxury real estate discovery and asset management. Built for discerning owners and tenants.
              </p>
            </div>

            {/* Ecosystem column */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-widest text-slate-200 mb-4">
                Ecosystem
              </h4>
              <ul className="space-y-2.5 text-sm">
                <li><button onClick={() => navigate('/properties')} className="hover:text-white transition-colors">Marketplace</button></li>
                <li><button onClick={() => navigate('/properties')} className="hover:text-white transition-colors">Investment Hub</button></li>
                <li><button onClick={() => navigate('/login')} className="hover:text-white transition-colors">Owner Mode</button></li>
                <li><button onClick={() => navigate('/tenants')} className="hover:text-white transition-colors">Tenant Matching</button></li>
              </ul>
            </div>

            {/* Company column */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-widest text-slate-200 mb-4">
                Company
              </h4>
              <ul className="space-y-2.5 text-sm">
                <li><a href="#about" className="hover:text-white transition-colors">Our Vision</a></li>
                <li><a href="#about" className="hover:text-white transition-colors">Leadership</a></li>
                <li><a href="#about" className="hover:text-white transition-colors">Advisory Board</a></li>
                <li><button onClick={() => navigate('/login')} className="hover:text-white transition-colors">Partnerships</button></li>
              </ul>
            </div>

            {/* Connectivity column */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-widest text-slate-200 mb-4">
                Connectivity
              </h4>
              <div className="flex items-center gap-3 mt-3 text-slate-300">
                <a href="#" className="w-9 h-9 rounded-xl bg-slate-900 hover:bg-blue-600 hover:text-white flex items-center justify-center transition-all">
                  <InstagramIcon className="w-4 h-4" />
                </a>
                <a href="#" className="w-9 h-9 rounded-xl bg-slate-900 hover:bg-blue-600 hover:text-white flex items-center justify-center transition-all">
                  <LinkedinIcon className="w-4 h-4" />
                </a>
                <a href="#" className="w-9 h-9 rounded-xl bg-slate-900 hover:bg-blue-600 hover:text-white flex items-center justify-center transition-all">
                  <TwitterIcon className="w-4 h-4" />
                </a>
              </div>
              <p className="text-xs text-slate-500 mt-4">
                Inquiries: luxury@rentwise.com
              </p>
            </div>

          </div>

          {/* Bottom Copyright */}
          <div className="pt-8 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-4">
            <p>© 2026 RentWise Global Portfolio. Engineered for Excellence.</p>
            <div className="flex items-center gap-6">
              <a href="#" className="hover:text-slate-400">Privacy Policy</a>
              <a href="#" className="hover:text-slate-400">Terms of Service</a>
              <a href="#" className="hover:text-slate-400">Security Architecture</a>
            </div>
          </div>
        </div>
      </footer>

    </div>
  );
};
