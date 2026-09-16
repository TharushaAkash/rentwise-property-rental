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
  CheckCircle2
} from 'lucide-react';

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

  // Filter real properties dynamically
  const filteredProperties = useMemo(() => {
    return properties.filter((p) => {
      const text = `${p.title || ''} ${p.address || ''} ${p.facilities || ''}`.toLowerCase();
      const matchesQuery = !searchLocation || text.includes(searchLocation.toLowerCase());
      const matchesPrice = !minPrice || Number(p.monthlyRent || 0) <= Number(minPrice);
      const matchesBeds = !bedrooms || Number(p.bedrooms || 0) >= Number(bedrooms);
      const matchesType = !propertyType || text.includes(propertyType.toLowerCase());
      return matchesQuery && matchesPrice && matchesBeds && matchesType;
    });
  }, [properties, searchLocation, minPrice, propertyType, bedrooms]);

  const handleSearch = (e) => {
    e.preventDefault();
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
            
            {/* Status Pill Indicator */}
            <div className="flex items-center justify-between gap-2 mb-4">
              <div className="flex items-center gap-2">
                <span className="px-3.5 py-1 rounded-full bg-emerald-500 text-slate-950 font-black text-[11px] tracking-wider uppercase shadow-md shadow-emerald-500/20">
                  RENT
                </span>
                <span className="text-xs text-slate-400 font-medium">
                  {properties.length > 0 
                    ? `${properties.length} added properties available in real-time`
                    : 'Verified property listings ready for move-in'}
                </span>
              </div>

              <span className="text-xs text-blue-400 font-bold hidden sm:inline">
                Live MLS Database
              </span>
            </div>

            <form onSubmit={handleSearch} className="space-y-3">
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
                  className="px-8 py-3.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold rounded-2xl shadow-lg shadow-orange-500/30 hover:shadow-orange-500/50 transition-all flex items-center justify-center gap-2 text-sm tracking-wide uppercase"
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
                  className="w-full px-4 py-2.5 rounded-xl bg-white/10 border border-white/15 text-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
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
                  className="w-full px-4 py-2.5 rounded-xl bg-white/10 border border-white/15 text-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
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
                  className="w-full px-4 py-2.5 rounded-xl bg-white/10 border border-white/15 text-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                >
                  <option value="" className="bg-slate-900 text-white">Bedrooms (Any)</option>
                  <option value="1" className="bg-slate-900 text-white">1+ Bedroom</option>
                  <option value="2" className="bg-slate-900 text-white">2+ Bedrooms</option>
                  <option value="3" className="bg-slate-900 text-white">3+ Bedrooms</option>
                  <option value="4" className="bg-slate-900 text-white">4+ Bedrooms</option>
                </select>
              </div>
            </form>
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

      {/* 5. Real Properties Showcase (Fetched from Backend API) */}
      <section id="featured" className="py-24 px-6 bg-slate-900">
        <div className="max-w-7xl mx-auto">
          
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-14 gap-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-[0.25em] text-blue-400">
                LIVE PROPERTY COLLECTION
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-white mt-2">
                Available Added Residences
              </h2>
              <p className="text-sm text-slate-400 mt-1">
                Real properties published and managed on RentWise.
              </p>
            </div>
            
            <button
              onClick={() => navigate('/properties')}
              className="inline-flex items-center gap-2 text-sm font-bold text-blue-400 hover:text-blue-300 transition-colors"
            >
              <span>Explore all {properties.length} properties</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {loadingProperties ? (
            <div className="py-20 text-center text-slate-400">
              <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="font-semibold text-sm">Loading added properties from the network...</p>
            </div>
          ) : filteredProperties.length === 0 ? (
            <div className="py-16 px-6 rounded-3xl bg-slate-800/40 border border-slate-700/60 text-center max-w-xl mx-auto">
              <Building2 className="w-12 h-12 text-slate-500 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-white">No properties match your filter</h3>
              <p className="text-xs text-slate-400 mt-1">
                {properties.length === 0 
                  ? 'No properties have been published yet. Property owners can sign in to list their homes.'
                  : 'Try clearing your search or filters to see all available residences.'}
              </p>
              {properties.length > 0 ? (
                <button
                  onClick={() => {
                    setSearchLocation('');
                    setMinPrice('');
                    setPropertyType('');
                    setBedrooms('');
                  }}
                  className="mt-4 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold"
                >
                  Clear Filters
                </button>
              ) : (
                <button
                  onClick={() => navigate('/register')}
                  className="mt-4 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold"
                >
                  Register as Property Owner
                </button>
              )}
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {filteredProperties.map((property, index) => {
                const photoSrc = property.photos && property.photos.length > 0 && property.photos[0].url
                  ? property.photos[0].url
                  : FALLBACK_PROPERTY_IMAGES[index % FALLBACK_PROPERTY_IMAGES.length];

                return (
                  <div
                    key={property.id}
                    className="group rounded-3xl bg-slate-800/80 border border-slate-700/60 overflow-hidden shadow-xl hover:shadow-2xl hover:border-slate-600 transition-all duration-300 flex flex-col justify-between"
                  >
                    {/* Property Image */}
                    <div className="relative h-64 overflow-hidden bg-slate-950">
                      <img 
                        src={photoSrc} 
                        alt={property.title} 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                      />
                      <div className="absolute top-4 left-4 px-3 py-1 rounded-full bg-slate-950/70 backdrop-blur-md text-white font-bold text-xs border border-white/10 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>{property.status || 'Active'}</span>
                      </div>
                      <div className="absolute bottom-4 right-4 px-3 py-1.5 rounded-xl bg-blue-600/90 backdrop-blur-md text-white font-extrabold text-sm shadow-md">
                        {formatMoney(property.monthlyRent)} <span className="text-xs font-normal text-blue-100">/mo</span>
                      </div>
                    </div>

                    {/* Property Details */}
                    <div className="p-6 flex-1 flex flex-col justify-between">
                      <div>
                        <h3 className="text-xl font-bold text-white group-hover:text-blue-400 transition-colors line-clamp-1">
                          {property.title}
                        </h3>
                        <div className="flex items-center gap-1.5 text-slate-400 text-xs mt-2">
                          <MapPin className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                          <span className="truncate">{property.address}</span>
                        </div>

                        {/* Beds & Baths & Facilities */}
                        <div className="grid grid-cols-3 gap-2 py-4 my-4 border-y border-slate-700/60 text-xs text-slate-300">
                          <div className="flex items-center gap-1.5">
                            <Bed className="w-4 h-4 text-blue-400" />
                            <span>{property.bedrooms || 0} Beds</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Bath className="w-4 h-4 text-blue-400" />
                            <span>{property.bathrooms || 0} Baths</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Compass className="w-4 h-4 text-blue-400" />
                            <span className="truncate">{property.facilities || 'Furnished'}</span>
                          </div>
                        </div>

                        {property.description && (
                          <p className="text-xs text-slate-400 line-clamp-2 mb-4">
                            {property.description}
                          </p>
                        )}
                      </div>

                      <button
                        onClick={() => navigate(`/properties/${property.id}`)}
                        className="w-full py-3 rounded-xl bg-white/10 hover:bg-blue-600 text-white font-semibold text-xs tracking-wider uppercase transition-all duration-200 text-center"
                      >
                        View Details & Book
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

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
