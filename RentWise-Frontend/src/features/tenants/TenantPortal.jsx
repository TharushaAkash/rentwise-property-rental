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
  FileText
} from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { BookingModal } from './BookingModal';
import { PaymentModal } from './PaymentModal';

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

export const TenantPropertyPortal = () => {
  const navigate = useNavigate();
  const [properties, setProperties] = useState([]);
  const [selectedPropertyForBooking, setSelectedPropertyForBooking] = useState(null);
  const [query, setQuery] = useState('');
  const [maxRent, setMaxRent] = useState('');
  const [bedrooms, setBedrooms] = useState('');
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiMatches, setAiMatches] = useState(null);
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    api.get('/properties')
      .then((response) => setProperties(response.data || []))
      .catch(() => setMessage('Unable to load property listings.'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const source = aiMatches || properties;
    return source.filter((property) => {
      const text = `${property.title} ${property.address} ${property.facilities || ''}`.toLowerCase();
      return (
        (!query || text.includes(query.toLowerCase())) &&
        (!maxRent || Number(property.monthlyRent) <= Number(maxRent)) &&
        (!bedrooms || Number(property.bedrooms) >= Number(bedrooms))
      );
    });
  }, [properties, aiMatches, query, maxRent, bedrooms]);

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

  const book = async (property) => {
    try {
      await api.post('/property-applications', {
        propertyId: property.id,
        message: 'Booking request from tenant portal.'
      });
      setMessage(`Booking request sent for ${property.title}.`);
    } catch (error) {
      setMessage(error.response?.data || 'Unable to send booking request.');
    }
  };

  return (
    <div className="space-y-10 font-sans">
      <section className="relative -mx-4 overflow-visible bg-[#0f172a] px-6 pb-24 pt-20 text-white sm:-mx-8 sm:px-12 lg:-mx-12 lg:px-20 rounded-b-3xl">
        <div
          className="absolute inset-0 opacity-40 rounded-b-3xl"
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 20%, #2563eb 0, transparent 35%), radial-gradient(circle at 80% 10%, #4f46e5 0, transparent 35%), linear-gradient(135deg, #0f172a, #020617)'
          }}
        />
        <div className="relative mx-auto max-w-6xl">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-blue-400">
            RentWise Luxury Homes
          </p>
          <h1 className="mt-4 max-w-3xl text-4xl sm:text-6xl font-extrabold tracking-tight leading-tight">
            Find a place made for your life.
          </h1>
          <p className="mt-4 max-w-xl text-base sm:text-lg text-slate-300">
            Explore verified luxury rental homes, compare monthly rent, and book directly with landlords.
          </p>
          <button
            onClick={() => navigate('/tenants')}
            className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/30 px-6 py-2.5 text-sm font-semibold text-white hover:bg-white hover:text-slate-900 transition-all"
          >
            <UserRound className="w-4 h-4" />
            <span>View My Profile & Bookings</span>
          </button>
        </div>

        {/* Floating Quick Search */}
        <div className="absolute -bottom-10 left-1/2 w-[calc(100%-2rem)] max-w-5xl -translate-x-1/2 rounded-2xl bg-white p-3 shadow-2xl sm:w-[calc(100%-6rem)] border border-gray-100">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="flex flex-1 items-center gap-3 rounded-xl bg-gray-50 px-4 py-3">
              <Search className="h-5 w-5 text-blue-600" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full bg-transparent text-gray-900 outline-none text-sm"
                placeholder="Search by location, address, or property title..."
              />
            </div>
            <select
              value={bedrooms}
              onChange={(e) => setBedrooms(e.target.value)}
              className="rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-700 outline-none"
            >
              <option value="">Any Bedrooms</option>
              <option value="1">1+ Bedroom</option>
              <option value="2">2+ Bedrooms</option>
              <option value="3">3+ Bedrooms</option>
            </select>
            <input
              value={maxRent}
              onChange={(e) => setMaxRent(e.target.value)}
              type="number"
              className="rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-700 outline-none"
              placeholder="Max rent (Rs.)"
            />
            <button
              onClick={() => document.getElementById('listings')?.scrollIntoView({ behavior: 'smooth' })}
              className="rounded-xl bg-blue-600 hover:bg-blue-700 px-8 py-3 font-bold uppercase tracking-wider text-xs text-white transition-all shadow-md"
            >
              Search
            </button>
          </div>
        </div>
      </section>

      {/* AI Property Search */}
      <Card className="border-blue-100 bg-gradient-to-br from-blue-50/50 to-white mt-16">
        <CardContent className="p-6">
          <form onSubmit={askAi} className="flex flex-col gap-3 md:flex-row">
            <div className="flex flex-1 items-center rounded-xl border border-blue-200 bg-white px-4 shadow-sm">
              <Sparkles className="mr-3 h-5 w-5 text-blue-600" />
              <input
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                className="w-full py-3 outline-none text-sm text-gray-900"
                placeholder="Ask AI: Find a 2-bedroom modern apartment near Colombo under Rs. 150,000..."
              />
            </div>
            <Button type="submit" isLoading={aiLoading} className="bg-blue-600 hover:bg-blue-700">
              <Sparkles className="mr-2 h-4 w-4" />
              Ask AI Matcher
            </Button>
          </form>
        </CardContent>
      </Card>

      {message && (
        <div className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-sm text-blue-700 font-medium">
          {message}
        </div>
      )}

      {/* Listings Grid */}
      <div id="listings">
        {loading ? (
          <div className="py-16 text-center text-gray-500">Loading properties...</div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 p-16 text-center text-gray-500">
            No properties match your filters.
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((property) => (
              <Card key={property.id} className="overflow-hidden border border-gray-200/80 hover:shadow-lg transition-all flex flex-col justify-between">
                <div className="relative h-44 bg-gradient-to-br from-blue-100 to-slate-100 flex items-center justify-center overflow-hidden">
                  {property.photos && property.photos.length > 0 ? (
                    <img 
                      src={property.photos.find(p => p.isPrimary)?.photoUrl || property.photos[0].photoUrl} 
                      alt={property.title} 
                      className="w-full h-full object-cover" 
                    />
                  ) : (
                    <Home className="h-12 w-12 text-blue-400" />
                  )}
                  <div className="absolute top-3 right-3">
                    <Badge variant="success">{property.status || 'Active'}</Badge>
                  </div>
                </div>

                <CardContent className="p-5 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">{property.title}</h3>
                    <p className="mt-1 text-xs text-gray-500 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      {property.address}
                    </p>
                    <div className="mt-4 flex gap-4 text-xs font-semibold text-gray-600">
                      <span>{property.bedrooms} Bedrooms</span>
                      <span>•</span>
                      <span>{property.bathrooms} Bathrooms</span>
                    </div>
                  </div>

                  <div className="mt-5 pt-4 border-t border-gray-100 flex items-center justify-between">
                    <div>
                      <p className="text-xl font-extrabold text-blue-600">
                        {money(property.monthlyRent)}
                      </p>
                      <span className="text-[11px] text-gray-400">per month</span>
                    </div>

                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        onClick={() => setSelectedPropertyForBooking(property)} 
                        className="bg-blue-600 hover:bg-blue-700 text-xs font-bold shadow-sm shadow-blue-500/20"
                      >
                        Book Property
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => navigate(`/properties/${property.id}`)} className="text-xs">
                        Details
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Booking Modal asking for rental duration in months, start date, and note */}
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
  const { user } = useAuth();
  
  const [profile, setProfile] = useState(null);
  const [agreements, setAgreements] = useState([]);
  const [maintenance, setMaintenance] = useState([]);
  const [payments, setPayments] = useState([]);
  const [myBookings, setMyBookings] = useState([]);
  const [selectedAgreementForPayment, setSelectedAgreementForPayment] = useState(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

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
      api.get('/agreements/mine').catch(() => ({ data: [] })),
      api.get('/maintenance-requests/mine').catch(() => ({ data: [] })),
      api.get('/property-applications').catch(() => ({ data: [] }))
    ])
      .then(async ([profileRes, agreementRes, maintenanceRes, bookingsRes]) => {
        let agreementData = Array.isArray(agreementRes?.data) ? agreementRes.data : [];
        let bookingData = Array.isArray(bookingsRes?.data) ? bookingsRes.data : [];

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

        setProfile(profileRes?.data || null);
        setAgreements(agreementData);
        setMaintenance(maintenanceRes?.data || []);
        setMyBookings(bookingData);

        // Fetch payments for tenant's agreements
        const paymentResponses = await Promise.all(
          agreementData.map((agreement) =>
            api.get(`/agreements/${agreement.id}/payments`).catch(() => ({ data: [] }))
          )
        );
        setPayments(paymentResponses.flatMap((res) => res.data || []));
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
  }, []);

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
                {profile?.telephoneNumber && (
                  <span className="flex items-center gap-1.5">
                    <Phone className="w-4 h-4 text-slate-400" />
                    {profile.telephoneNumber}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-3">
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

    </div>
  );
};
