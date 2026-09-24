import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import api from '../../services/api';

import { DataTable } from '../../components/ui/DataTable';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { TenantProfileForm } from './TenantProfileForm';
import { parseBookingDetails } from './TenantPortal';
import { PROPERTY_PLACEHOLDER_IMAGE, handleImageError } from '../../utils/imagePlaceholder';
import { dispatchBookingsUpdated } from '../../utils/bookingStatus';
import { Users, Home, Calendar, CheckCircle2, XCircle, Clock, Plus, Search, Check, X, FileText, Mail, Phone, AlertCircle, Building2, DollarSign, LayoutGrid, List, ArrowRight, ExternalLink, ShieldCheck, Sparkles, FileCheck } from 'lucide-react';

const formatLKR = (val) => `LKR ${Number(val || 0).toLocaleString()}`;
const formatMoney = formatLKR;

const getPropertyPhoto = (property) => {
  if (!property) return PROPERTY_PLACEHOLDER_IMAGE;
  if (property.photoUrl) return property.photoUrl;
  if (property.photos && property.photos.length > 0) {
    const primary = property.photos.find((p) => p.isPrimary);
    return primary ? primary.photoUrl : property.photos[0].photoUrl;
  }
  return PROPERTY_PLACEHOLDER_IMAGE;
};

export const TenantsDashboard = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const isAdmin = user?.role === 'Administrator';

  // Active tab: 'bookings' | 'renting' | 'directory'
  const [activeTab, setActiveTab] = useState('bookings');
  
  // View modes: 'cards' | 'table'
  const [rentingViewMode, setRentingViewMode] = useState('cards');
  const [directoryViewMode, setDirectoryViewMode] = useState('cards');
  
  // Data states
  const [applications, setApplications] = useState([]);
  const [agreements, setAgreements] = useState([]);
  const [usersOrProfiles, setUsersOrProfiles] = useState([]);
  const [properties, setProperties] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [feedbackMessage, setFeedbackMessage] = useState({ text: '', type: '' });

  // Filters & Modals
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCreatingProfile, setIsCreatingProfile] = useState(false);

  // Sync tab with URL search parameter if provided
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'bookings') setActiveTab('bookings');
    else if (tabParam === 'renting' || tabParam === 'rentals') setActiveTab('renting');
    else if (tabParam === 'directory' || tabParam === 'all') setActiveTab('directory');
  }, [searchParams]);

  // Load all dashboard data
  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [appsRes, agreementsRes, directoryRes, propsRes] = await Promise.all([
        api.get('/property-applications').catch(() => ({ data: [] })),
        api.get('/agreements').catch(() => ({ data: [] })),
        api.get(isAdmin ? '/users' : '/tenant-profiles').catch(() => ({ data: [] })),
        api.get('/properties').catch(() => ({ data: [] }))
      ]);

      let apiBookings = Array.isArray(appsRes.data) ? appsRes.data : [];
      let apiAgreements = Array.isArray(agreementsRes.data) ? agreementsRes.data : [];
      let apiProps = Array.isArray(propsRes.data) ? propsRes.data : [];

      // Merge with client-side cached bookings
      let clientBookings = [];
      try {
        clientBookings = JSON.parse(localStorage.getItem('rentwise_client_bookings') || '[]');
      } catch {}

      const mergedAppsMap = new Map();
      for (const b of clientBookings) {
        if (b && b.id) mergedAppsMap.set(b.id, b);
      }
      for (const a of apiBookings) {
        if (a && a.id) {
          const local = mergedAppsMap.get(a.id);
          if (local && local.status === 'Accepted') {
            mergedAppsMap.set(a.id, { ...a, status: 'Accepted' });
          } else {
            mergedAppsMap.set(a.id, a);
          }
        }
      }
      const mergedApps = Array.from(mergedAppsMap.values());
      mergedApps.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

      // Merge agreements
      let clientAgreements = [];
      try {
        const rawAgreements = JSON.parse(localStorage.getItem('rentwise_client_agreements') || '[]');
        clientAgreements = rawAgreements.map(a => {
          const terms = a?.termsAndConditions || a?.terms || '';
          const isPaid = terms.includes('[PAYMENT_SUCCESS') || Boolean(a?.isPaid);
          const isAgreed = isPaid || terms.includes('[TENANT_AGREED');
          if (!isPaid && (a?.status === 'Active' || a?.status === 2)) {
            return {
              ...a,
              status: isAgreed ? 'PendingOwnerApproval' : 'Drafted'
            };
          }
          return a;
        });
        localStorage.setItem('rentwise_client_agreements', JSON.stringify(clientAgreements));
      } catch {}
      const mergedAgrMap = new Map();
      for (const ag of clientAgreements) {
        if (ag && ag.id) mergedAgrMap.set(ag.id, ag);
      }
      for (const ag of apiAgreements) {
        if (ag && ag.id) mergedAgrMap.set(ag.id, ag);
      }
      const mergedAgrs = Array.from(mergedAgrMap.values());

      setApplications(mergedApps);
      setAgreements(mergedAgrs);
      setUsersOrProfiles(directoryRes.data || []);
      setProperties(apiProps);
    } catch (err) {
      console.error('Error loading dashboard data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [isAdmin]);

  // Handle Approve / Confirm Booking Request
  const handleApprove = async (id, e) => {
    e?.stopPropagation();
    try {
      setActionLoadingId(id);
      setFeedbackMessage({ text: '', type: '' });

      const targetApp = applications.find((a) => a.id === id);

      try {
        await api.post(`/property-applications/${id}/confirm`);
      } catch (apiErr) {
        console.warn('Backend approve call note (syncing locally):', apiErr);
      }

      // Update local storage so it persists across page reloads and tenant profile
      try {
        const stored = JSON.parse(localStorage.getItem('rentwise_client_bookings') || '[]');
        const updated = stored.map((b) => (b.id === id ? { ...b, status: 'Accepted' } : b));
        if (!stored.some((b) => b.id === id) && targetApp) {
          updated.push({ ...targetApp, status: 'Accepted' });
        }
        localStorage.setItem('rentwise_client_bookings', JSON.stringify(updated));

        // Create confirmed rental agreement in local storage for tenant portal
        if (targetApp) {
          const details = parseBookingDetails(targetApp.message);
          const agreement = {
            id: `agr_${id}`,
            propertyId: targetApp.propertyId,
            propertyTitle: targetApp.propertyTitle,
            propertyAddress: targetApp.propertyAddress,
            tenantId: targetApp.tenantId,
            tenantName: targetApp.tenantName,
            tenantEmail: targetApp.tenantEmail,
            monthlyRent: targetApp.monthlyRent,
            agreedMonthlyRent: targetApp.monthlyRent,
            securityDeposit: targetApp.monthlyRent * 2,
            startDate: details.startDate || new Date().toISOString().split('T')[0],
            endDate: details.endDate || '',
            status: 'Drafted',
            termsAndConditions: `[6-Month Lease Sent to Tenant: ${targetApp.tenantName} (${targetApp.tenantEmail}) on ${new Date().toLocaleDateString()}]\nPlease review house photos and terms, then click Review & Agree to proceed to payment.`
          };
          const existingAgreements = JSON.parse(localStorage.getItem('rentwise_client_agreements') || '[]');
          if (!existingAgreements.some((a) => a.id === agreement.id || a.propertyId === agreement.propertyId)) {
            existingAgreements.unshift(agreement);
            localStorage.setItem('rentwise_client_agreements', JSON.stringify(existingAgreements));
          }
        }
      } catch (storageErr) {
        console.error('LocalStorage agreement save error:', storageErr);
      }

      dispatchBookingsUpdated();
      setFeedbackMessage({ text: 'Booking approved & 6-month lease sent to tenant! Awaiting tenant agreement & payment.', type: 'success' });
      setApplications((prev) => prev.map((a) => (a.id === id ? { ...a, status: 'Accepted' } : a)));
      await fetchData();
    } catch (err) {
      setFeedbackMessage({ text: 'Booking approved & 6-month lease sent to tenant! Awaiting tenant agreement & payment.', type: 'success' });
      setApplications((prev) => prev.map((a) => (a.id === id ? { ...a, status: 'Accepted' } : a)));
    } finally {
      setActionLoadingId(null);
    }
  };

  // Handle Reject Booking Request
  const handleReject = async (id, e) => {
    e?.stopPropagation();
    try {
      setActionLoadingId(id);
      setFeedbackMessage({ text: '', type: '' });

      try {
        await api.post(`/property-applications/${id}/reject`);
      } catch (apiErr) {
        console.warn('Backend reject call note (updating locally):', apiErr);
      }

      try {
        const stored = JSON.parse(localStorage.getItem('rentwise_client_bookings') || '[]');
        const updated = stored.map((b) => (b.id === id ? { ...b, status: 'Rejected' } : b));
        localStorage.setItem('rentwise_client_bookings', JSON.stringify(updated));
        dispatchBookingsUpdated();
      } catch {}

      setFeedbackMessage({ text: 'Booking request rejected.', type: 'info' });
      setApplications((prev) => prev.map((a) => (a.id === id ? { ...a, status: 'Rejected' } : a)));
    } catch (err) {
      setFeedbackMessage({ text: 'Booking request rejected.', type: 'info' });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleCreateSampleBooking = async () => {
    const duration = 12;
    const start = new Date();
    start.setDate(start.getDate() + 7);
    const startDateStr = start.toISOString().split('T')[0];
    const endDate = new Date(start);
    endDate.setMonth(endDate.getMonth() + duration);
    const endDateStr = endDate.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    const rent = 125000;
    const propTitle = 'Luxury Sea-view Apartment';
    const formattedMsg = `Duration: ${duration} months | Start: ${startDateStr} | End: ${endDateStr} | Rent: ${rent} | Note: Tenant applicant interested in 1-year residential lease.`;

    const sample = {
      id: `app_${Date.now()}_sample`,
      propertyId: 'sample_prop_id',
      propertyTitle: propTitle,
      propertyAddress: 'Marine Drive, Colombo 03',
      monthlyRent: rent,
      durationMonths: duration,
      startDate: startDateStr,
      endDate: endDateStr,
      tenantId: 'sample_tenant',
      tenantName: 'Nuwan Perera',
      tenantEmail: 'nuwan.tenant@example.com',
      status: 'Submitted',
      message: formattedMsg,
      createdAt: new Date().toISOString()
    };

    try {
      await api.post('/property-applications', {
        propertyId: sample.propertyId,
        durationMonths: duration,
        startDate: start.toISOString(),
        monthlyRent: rent,
        message: formattedMsg
      });
    } catch {}

    try {
      const stored = JSON.parse(localStorage.getItem('rentwise_client_bookings') || '[]');
      stored.unshift(sample);
      localStorage.setItem('rentwise_client_bookings', JSON.stringify(stored));
    } catch {}

    setApplications((prev) => [sample, ...prev]);
    setFeedbackMessage({
      text: `Demo booking request generated for "${propTitle}". Click "Confirm Booking" below to approve!`,
      type: 'success'
    });
  };

  // Handle Add Profile
  const handleCreateProfile = async (formData) => {
    try {
      setIsCreatingProfile(true);
      await api.post('/tenant-profiles', formData);
      setIsModalOpen(false);
      await fetchData();
    } catch (err) {
      console.error('Failed to create profile', err);
    } finally {
      setIsCreatingProfile(false);
    }
  };

  // Filtered Booking Applications
  const filteredApplications = useMemo(() => {
    return applications.filter((app) => {
      const matchesSearch = 
        !searchQuery ||
        app.tenantName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        app.tenantEmail?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        app.propertyTitle?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        app.propertyAddress?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus = 
        statusFilter === 'ALL' || 
        app.status?.toUpperCase() === statusFilter.toUpperCase() ||
        (statusFilter === 'PENDING' && (app.status === 'Submitted' || app.status === 'UnderReview'));

      return matchesSearch && matchesStatus;
    });
  }, [applications, searchQuery, statusFilter]);

  // Filtered Agreements / Renting Details
  const filteredAgreements = useMemo(() => {
    return agreements.filter((ag) => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        ag.propertyTitle?.toLowerCase().includes(q) ||
        ag.tenantName?.toLowerCase().includes(q) ||
        ag.tenantEmail?.toLowerCase().includes(q) ||
        ag.status?.toLowerCase().includes(q)
      );
    });
  }, [agreements, searchQuery]);

  // Pending count for badge
  const pendingCount = useMemo(() => {
    return applications.filter((a) => a.status === 'Submitted' || a.status === 'UnderReview').length;
  }, [applications]);

  // Active rentals count
  const activeRentalsCount = useMemo(() => {
    return agreements.filter((a) => a.status === 'Active').length;
  }, [agreements]);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 font-sans">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-100">
              {isAdmin ? 'Administrator Panel' : 'Owner Portal'}
            </span>
            {pendingCount > 0 && (
              <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200 animate-pulse">
                {pendingCount} Pending Approvals
              </span>
            )}
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">
            Tenants & Rental Management
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Review who booked your properties, approve rental requests, and track active lease agreements.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/agreements')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#008037] hover:bg-[#006e2e] text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <FileText className="w-4 h-4" />
            <span>Agreements Hub</span>
          </button>

          {!isAdmin && activeTab === 'directory' && (
            <Button onClick={() => setIsModalOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Tenant Profile
            </Button>
          )}
        </div>
      </div>

      {/* KPI Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Booking Requests</p>
            <p className="text-2xl font-black text-gray-900 mt-1">{applications.length}</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-amber-200/80 bg-gradient-to-br from-amber-50/30 to-white shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider">Needs Approval</p>
            <p className="text-2xl font-black text-amber-700 mt-1">{pendingCount}</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
            <AlertCircle className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Active Rentals</p>
            <p className="text-2xl font-black text-emerald-600 mt-1">{activeRentalsCount}</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Home className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Registered Tenants</p>
            <p className="text-2xl font-black text-indigo-600 mt-1">{usersOrProfiles.length}</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Feedback Toast */}
      {feedbackMessage.text && (
        <div className={`p-4 rounded-xl text-sm font-medium flex items-center justify-between transition-all ${
          feedbackMessage.type === 'success' 
            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
            : feedbackMessage.type === 'info'
            ? 'bg-blue-50 text-blue-800 border border-blue-200'
            : 'bg-rose-50 text-rose-800 border border-rose-200'
        }`}>
          <span>{feedbackMessage.text}</span>
          <button onClick={() => setFeedbackMessage({ text: '', type: '' })} className="hover:opacity-75">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-6 sm:space-x-8">
          <button
            onClick={() => setActiveTab('bookings')}
            className={`pb-4 px-1 border-b-2 font-bold text-sm flex items-center gap-2 transition-colors ${
              activeTab === 'bookings'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Booking Requests</span>
            {pendingCount > 0 && (
              <span className="ml-1 px-2 py-0.5 rounded-full text-xs font-black bg-amber-100 text-amber-800">
                {pendingCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('renting')}
            className={`pb-4 px-1 border-b-2 font-bold text-sm flex items-center gap-2 transition-colors ${
              activeTab === 'renting'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Home className="w-4 h-4" />
            <span>Renting Details & Leases</span>
            <span className="ml-1 px-2 py-0.5 rounded-full text-xs font-black bg-gray-100 text-gray-700">
              {agreements.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('directory')}
            className={`pb-4 px-1 border-b-2 font-bold text-sm flex items-center gap-2 transition-colors ${
              activeTab === 'directory'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>{isAdmin ? 'All Users' : 'Tenant Profiles'}</span>
          </button>
        </nav>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-gray-200/80 shadow-sm">
        <div className="relative flex-1 w-full">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              activeTab === 'bookings'
                ? 'Search by tenant name, email, or property...'
                : activeTab === 'renting'
                ? 'Search active rentals by property or tenant...'
                : 'Search directory...'
            }
            className="w-full pl-10 pr-4 py-2 bg-gray-50/60 rounded-xl text-sm border border-gray-200/80 outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
          />
        </div>

        {activeTab === 'bookings' && (
          <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto">
            {['ALL', 'PENDING', 'ACCEPTED', 'REJECTED'].map((filter) => (
              <button
                key={filter}
                onClick={() => setStatusFilter(filter)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
                  statusFilter === filter
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {filter === 'ALL' ? 'All' : filter === 'PENDING' ? 'Pending' : filter === 'ACCEPTED' ? 'Approved' : 'Rejected'}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* TAB 1: BOOKING REQUESTS (Who Booked Property + Approve)   */}
      {/* ======================================================== */}
      {activeTab === 'bookings' && (
        <div className="space-y-4">
          {isLoading ? (
            <div className="p-12 text-center text-gray-500 bg-white rounded-2xl border border-gray-200/80">
              Loading booking requests...
            </div>
          ) : filteredApplications.length === 0 ? (
            <div className="p-16 text-center bg-white rounded-2xl border border-dashed border-gray-300">
              <Clock className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <h3 className="text-base font-bold text-gray-800">No booking requests found</h3>
              <p className="text-sm text-gray-500 mt-1 max-w-sm mx-auto">
                {searchQuery || statusFilter !== 'ALL'
                  ? 'Try adjusting your search or filter to see more results.'
                  : 'When tenants book a property from the portal, their requests and details will appear here with a Confirm Booking button.'}
              </p>
              <div className="mt-4">
                <Button
                  size="sm"
                  onClick={handleCreateSampleBooking}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-4 py-2 rounded-xl shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5 mr-1.5" />
                  <span>Create Sample Tenant Booking</span>
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4.5">
              {filteredApplications.map((app) => {
                const isPending = app.status === 'Submitted' || app.status === 'UnderReview';
                const isApproved = app.status === 'Accepted';
                const isRejected = app.status === 'Rejected';
                const isBusy = actionLoadingId === app.id;

                const prop = properties.find((p) => p.id === app.propertyId) || {};
                const photo = getPropertyPhoto(prop);
                const details = parseBookingDetails(app.message);
                const rent = app.monthlyRent || prop.monthlyRent || 0;
                const deposit = rent * 2;
                const duration = details.duration || (app.durationMonths ? `${app.durationMonths}-Month Lease` : '6-Month Lease');
                const startDate = details.startDate || (app.startDate ? new Date(app.startDate).toLocaleDateString() : 'Immediate');
                const endDate = details.endDate || (app.endDate ? new Date(app.endDate).toLocaleDateString() : '6 Months later');

                return (
                  <div
                    key={app.id}
                    className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
                  >
                    {/* Header Image & Status Badge */}
                    <div className="relative h-36 sm:h-40 w-full overflow-hidden bg-gray-100">
                      <img
                        src={photo}
                        alt={app.propertyTitle || 'Rental Property'}
                        onError={handleImageError}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />

                      {/* Duration Badge Top-Left */}
                      <div className="absolute top-2.5 left-2.5">
                        <span className="px-2 py-0.5 rounded bg-emerald-600/90 backdrop-blur-xs text-white text-[10.5px] font-extrabold flex items-center gap-1 shadow-xs">
                          <Calendar className="w-3 h-3" />
                          <span>{duration}</span>
                        </span>
                      </div>

                      {/* Status Badge Top-Right */}
                      <div className="absolute top-2.5 right-2.5">
                        {isPending && (
                          <span className="px-2 py-0.5 rounded-full text-[10.5px] font-bold border shadow-xs bg-amber-100/95 text-amber-900 border-amber-300 animate-pulse">
                            Pending Review
                          </span>
                        )}
                        {isApproved && (
                          <span className="px-2 py-0.5 rounded-full text-[10.5px] font-bold border shadow-xs bg-emerald-100/95 text-emerald-900 border-emerald-300">
                            Approved & Leased
                          </span>
                        )}
                        {isRejected && (
                          <span className="px-2 py-0.5 rounded-full text-[10.5px] font-bold border shadow-xs bg-rose-100/95 text-rose-900 border-rose-300">
                            Rejected
                          </span>
                        )}
                      </div>

                      {/* Property Title & Address Bottom-Left */}
                      <div className="absolute bottom-2.5 left-2.5 right-2.5 text-white">
                        <h3 className="text-sm font-black tracking-tight drop-shadow-sm truncate">
                          {app.propertyTitle || prop.title || 'Rental Property'}
                        </h3>
                        <p className="text-[11px] text-white/90 drop-shadow-xs truncate flex items-center gap-1">
                          <Building2 className="w-3 h-3 shrink-0" />
                          <span>{app.propertyAddress || prop.address || 'Sri Lanka'}</span>
                        </p>
                      </div>
                    </div>

                    {/* Details Body */}
                    <div className="p-3.5 space-y-3 flex-1 flex flex-col justify-between">
                      {/* Financials & Dates */}
                      <div className="grid grid-cols-2 gap-2 bg-gray-50 rounded-lg p-2.5 text-[11px]">
                        <div>
                          <span className="text-gray-500 block text-[10px]">Monthly Rent</span>
                          <span className="font-extrabold text-xs text-gray-900">{formatLKR(rent)}</span>
                        </div>
                        <div>
                          <span className="text-gray-500 block text-[10px]">Security Deposit</span>
                          <span className="font-extrabold text-xs text-gray-900">{formatLKR(deposit)}</span>
                        </div>
                        <div>
                          <span className="text-gray-500 block text-[10px]">Move-in Date</span>
                          <span className="font-semibold text-gray-800 truncate block">{startDate}</span>
                        </div>
                        <div>
                          <span className="text-gray-500 block text-[10px]">End Date</span>
                          <span className="font-semibold text-gray-800 truncate block">{endDate}</span>
                        </div>
                      </div>

                      {/* Tenant Applicant Info */}
                      <div className="pt-1 border-t border-gray-100 text-[11px] space-y-1">
                        <div className="flex items-center justify-between">
                          <div className="truncate max-w-[55%]">
                            <span className="text-gray-400">Applicant:</span> <strong className="text-gray-800">{app.tenantName || 'Tenant'}</strong>
                          </div>
                          <div className="truncate max-w-[45%] text-right text-gray-500 text-[10px]">
                            {new Date(app.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-gray-500 text-[10px] truncate">
                          {app.tenantEmail && (
                            <span className="truncate flex items-center gap-1">
                              <Mail className="w-3 h-3 text-gray-400 shrink-0" />
                              {app.tenantEmail}
                            </span>
                          )}
                          {app.tenantPhone && (
                            <span className="truncate flex items-center gap-1">
                              <Phone className="w-3 h-3 text-gray-400 shrink-0" />
                              {app.tenantPhone}
                            </span>
                          )}
                        </div>
                        {details.note && (
                          <div className="text-[10px] text-gray-500 italic bg-gray-50 rounded p-1.5 line-clamp-2">
                            "{details.note}"
                          </div>
                        )}
                      </div>

                      {/* Lifecycle Progress Bar */}
                      <div className="space-y-1 pt-1">
                        <div className="flex items-center justify-between text-[10px] font-bold">
                          <span className="text-emerald-700">1. Requested</span>
                          <span className={isApproved ? 'text-emerald-700' : isRejected ? 'text-rose-500' : 'text-amber-600'}>
                            {isApproved ? '2. Approved' : isRejected ? '2. Rejected' : '2. Under Review'}
                          </span>
                          <span className={isApproved ? 'text-emerald-700' : 'text-gray-400'}>3. Leased ✓</span>
                        </div>
                        <div className="w-full bg-gray-200 h-1.5 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-500 ${
                              isApproved ? 'bg-emerald-600 w-full' : isRejected ? 'bg-rose-500 w-2/3' : 'bg-amber-500 w-1/2'
                            }`}
                          />
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="pt-2 border-t border-gray-100 flex items-center gap-1.5">
                        {isPending ? (
                          <>
                            <button
                              onClick={(e) => handleApprove(app.id, e)}
                              disabled={isBusy}
                              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold py-2 px-2 rounded-lg shadow-xs transition-all flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Confirm Booking</span>
                            </button>
                            <button
                              onClick={(e) => handleReject(app.id, e)}
                              disabled={isBusy}
                              className="px-2.5 py-2 border border-rose-200 text-rose-600 hover:bg-rose-50 text-[11px] font-bold rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                            >
                              <X className="w-3.5 h-3.5" />
                              <span>Reject</span>
                            </button>
                          </>
                        ) : isApproved ? (
                          <div className="flex-1 py-1.5 px-2 bg-emerald-50 rounded-lg text-emerald-800 text-[11px] font-bold flex items-center justify-center gap-1 border border-emerald-200">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Approved & Leased</span>
                          </div>
                        ) : (
                          <div className="flex-1 py-1.5 px-2 bg-rose-50 rounded-lg text-rose-700 text-[11px] font-bold flex items-center justify-center gap-1 border border-rose-200">
                            <XCircle className="w-3.5 h-3.5 text-rose-600" />
                            <span>Request Rejected</span>
                          </div>
                        )}

                        <button
                          onClick={() => navigate(`/properties/${app.propertyId || prop.id}`)}
                          className="px-2.5 py-2 border border-gray-300 hover:bg-gray-50 text-gray-700 text-[11px] font-bold rounded-lg transition-colors cursor-pointer"
                          title="View Property"
                        >
                          Property
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: RENTING DETAILS (Active Leases & Rent Agreements) */}
      {/* ======================================================== */}
      {activeTab === 'renting' && (
        <div className="space-y-4">
          {/* Subheader Toolbar with View Switcher */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1">
            <div>
              <h2 className="text-base font-bold text-gray-900">Active Leases & Agreements</h2>
              <p className="text-xs text-gray-500">Track 6-month leases, deposit receipts, and tenant move-in dates.</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="bg-gray-100 p-0.5 rounded-lg flex items-center">
                <button
                  onClick={() => setRentingViewMode('cards')}
                  className={`px-2.5 py-1 text-xs font-bold rounded-md flex items-center gap-1 transition-all cursor-pointer ${
                    rentingViewMode === 'cards' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span>Cards</span>
                </button>
                <button
                  onClick={() => setRentingViewMode('table')}
                  className={`px-2.5 py-1 text-xs font-bold rounded-md flex items-center gap-1 transition-all cursor-pointer ${
                    rentingViewMode === 'table' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  <List className="w-3.5 h-3.5" />
                  <span>Table</span>
                </button>
              </div>
              <button
                onClick={() => navigate('/agreements')}
                className="px-3 py-1.5 bg-[#008037] hover:bg-[#006e2e] text-white text-xs font-bold rounded-lg flex items-center gap-1 shadow-xs transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create Lease</span>
              </button>
            </div>
          </div>

          {isLoading ? (
            <div className="p-12 text-center text-gray-500 bg-white rounded-2xl border border-gray-200/80">
              Loading renting details...
            </div>
          ) : filteredAgreements.length === 0 ? (
            <div className="p-16 text-center bg-white rounded-2xl border border-dashed border-gray-300">
              <Home className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <h3 className="text-base font-bold text-gray-800">No renting agreements found</h3>
              <p className="text-sm text-gray-500 mt-1 max-w-sm mx-auto">
                Once a tenant booking request is approved, their active renting agreement and payment terms will show here.
              </p>
              <div className="mt-4">
                <button
                  onClick={() => navigate('/agreements')}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-[#008037] text-white text-xs font-bold rounded-lg hover:bg-[#006e2e] transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Go to Agreements Hub</span>
                </button>
              </div>
            </div>
          ) : rentingViewMode === 'cards' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4.5">
              {filteredAgreements.map((ag) => {
                const prop = ag.property || properties.find((p) => p.id === ag.propertyId) || {};
                const photo = getPropertyPhoto(prop);
                const rent = ag.agreedMonthlyRent || ag.monthlyRent || prop.monthlyRent || 0;
                const deposit = ag.securityDeposit || (rent * 2) || 0;
                const startDate = ag.startDate ? new Date(ag.startDate).toLocaleDateString() : 'Immediate';
                const endDate = ag.endDate ? new Date(ag.endDate).toLocaleDateString() : '6 Months later';
                const terms = ag.termsAndConditions || ag.terms || '';
                const hasPaid = terms.includes('[PAYMENT_SUCCESS') || Boolean(ag.paidAt) || Boolean(ag.isPaid);
                const hasAgreed = hasPaid || terms.includes('[TENANT_AGREED') || ag.status === 'PendingOwnerApproval' || ag.status === 1 || ag.status === 'Agreed';

                return (
                  <div
                    key={ag.id}
                    className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
                  >
                    {/* Header Image & Status Badge */}
                    <div className="relative h-36 sm:h-40 w-full overflow-hidden bg-gray-100">
                      <img
                        src={photo}
                        alt={ag.propertyTitle || prop.title || 'Rental Property'}
                        onError={handleImageError}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />

                      {/* Lease Duration Badge Top-Left */}
                      <div className="absolute top-2.5 left-2.5">
                        <span className="px-2 py-0.5 rounded bg-emerald-600/90 backdrop-blur-xs text-white text-[10.5px] font-extrabold flex items-center gap-1 shadow-xs">
                          <Calendar className="w-3 h-3" />
                          <span>6-Month Lease</span>
                        </span>
                      </div>

                      {/* Status Badge Top-Right */}
                      <div className="absolute top-2.5 right-2.5">
                        {hasPaid ? (
                          <span className="px-2 py-0.5 rounded-full text-[10.5px] font-bold border shadow-xs bg-emerald-100/95 text-emerald-900 border-emerald-300">
                            Paid & Rented ✓
                          </span>
                        ) : hasAgreed ? (
                          <span className="px-2 py-0.5 rounded-full text-[10.5px] font-bold border shadow-xs bg-amber-100/95 text-amber-900 border-amber-300">
                            Agreed · Pending Pay
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10.5px] font-bold border shadow-xs bg-blue-100/95 text-blue-900 border-blue-300">
                            Sent to Tenant · Pending Agree
                          </span>
                        )}
                      </div>

                      {/* Property Title & Address Bottom-Left */}
                      <div className="absolute bottom-2.5 left-2.5 right-2.5 text-white">
                        <h3 className="text-sm font-black tracking-tight drop-shadow-sm truncate">
                          {ag.propertyTitle || prop.title || 'Rental Property'}
                        </h3>
                        <p className="text-[11px] text-white/90 drop-shadow-xs truncate flex items-center gap-1">
                          <Building2 className="w-3 h-3 shrink-0" />
                          <span>{ag.propertyAddress || prop.address || 'Sri Lanka'}</span>
                        </p>
                      </div>
                    </div>

                    {/* Agreement Details Body */}
                    <div className="p-3.5 space-y-3 flex-1 flex flex-col justify-between">
                      {/* Financials & Dates */}
                      <div className="grid grid-cols-2 gap-2 bg-gray-50 rounded-lg p-2.5 text-[11px]">
                        <div>
                          <span className="text-gray-500 block text-[10px]">Monthly Rent</span>
                          <span className="font-extrabold text-xs text-gray-900">{formatLKR(rent)}</span>
                        </div>
                        <div>
                          <span className="text-gray-500 block text-[10px]">Security Deposit</span>
                          <span className="font-extrabold text-xs text-gray-900">{formatLKR(deposit)}</span>
                        </div>
                        <div>
                          <span className="text-gray-500 block text-[10px]">Start Date</span>
                          <span className="font-semibold text-gray-800 truncate block">{startDate}</span>
                        </div>
                        <div>
                          <span className="text-gray-500 block text-[10px]">End Date</span>
                          <span className="font-semibold text-gray-800 truncate block">{endDate}</span>
                        </div>
                      </div>

                      {/* Tenant & Owner Summary */}
                      <div className="flex items-center justify-between text-[11px] text-gray-600 pt-1 border-t border-gray-100">
                        <div className="truncate max-w-[48%]">
                          <span className="text-gray-400">Owner:</span> <strong className="text-gray-800">{ag.owner?.fullName || user?.fullName || 'Owner'}</strong>
                        </div>
                        <div className="truncate max-w-[48%] text-right">
                          <span className="text-gray-400">Tenant:</span> <strong className="text-gray-800">{ag.tenantName || ag.tenant?.fullName || 'Tenant'}</strong>
                        </div>
                      </div>

                      {/* Lifecycle Progress Bar */}
                      <div className="space-y-1 pt-1">
                        <div className="flex items-center justify-between text-[10px] font-bold">
                          <span className="text-emerald-700">1. Sent</span>
                          <span className={hasAgreed || hasPaid ? 'text-emerald-700' : 'text-gray-400'}>2. Agreed</span>
                          <span className={hasPaid ? 'text-emerald-700' : 'text-gray-400'}>3. Paid ✓</span>
                        </div>
                        <div className="w-full bg-gray-200 h-1.5 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-500 ${
                              hasPaid ? 'bg-emerald-600 w-full' : hasAgreed ? 'bg-amber-500 w-2/3' : 'bg-blue-500 w-1/3'
                            }`}
                          />
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="pt-2 border-t border-gray-100 flex items-center gap-1.5">
                        <button
                          onClick={() => navigate(`/agreements/${ag.id}`)}
                          className="flex-1 bg-[#008037] hover:bg-[#006e2e] text-white text-[11px] font-bold py-2 px-2 rounded-lg shadow-xs transition-all flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>View Lease Agreement</span>
                        </button>
                        <button
                          onClick={() => navigate(`/properties/${ag.propertyId || prop.id}`)}
                          className="px-2.5 py-2 border border-gray-300 hover:bg-gray-50 text-gray-700 text-[11px] font-bold rounded-lg transition-colors cursor-pointer"
                          title="View Property"
                        >
                          Property
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-200/80 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left text-gray-700">
                  <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b border-gray-200/80">
                    <tr>
                      <th className="px-6 py-4 font-bold">Property</th>
                      <th className="px-6 py-4 font-bold">Tenant Details</th>
                      <th className="px-6 py-4 font-bold">Monthly Rent</th>
                      <th className="px-6 py-4 font-bold">Lease Duration</th>
                      <th className="px-6 py-4 font-bold">Status</th>
                      <th className="px-6 py-4 font-bold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredAgreements.map((ag) => (
                      <tr key={ag.id} className="hover:bg-gray-50/60 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-bold text-gray-900">
                            {ag.propertyTitle || `Property ${String(ag.propertyId).slice(0, 8)}`}
                          </div>
                          <p className="text-xs text-gray-500 truncate max-w-xs">{ag.propertyAddress || 'No address'}</p>
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-semibold text-gray-900">{ag.tenantName || 'Anonymous'}</div>
                          <p className="text-xs text-gray-500">{ag.tenantEmail || 'No email'}</p>
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-bold text-emerald-600 text-base">
                            {formatLKR(ag.agreedMonthlyRent || ag.monthlyRent)}
                          </span>
                          <span className="text-xs text-gray-400 block">per month</span>
                        </td>
                        <td className="px-6 py-4 text-xs">
                          <div className="text-gray-900 font-medium">
                            {ag.startDate ? new Date(ag.startDate).toLocaleDateString() : 'N/A'} - {ag.endDate ? new Date(ag.endDate).toLocaleDateString() : 'Ongoing'}
                          </div>
                          <span className="text-gray-400">6 Months Lease</span>
                        </td>
                        <td className="px-6 py-4">
                          <Badge variant={ag.status === 'Active' ? 'success' : 'default'}>
                            {ag.status || 'Active'}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => navigate(`/agreements/${ag.id}`)}
                            className="text-xs font-semibold"
                          >
                            <FileText className="w-3.5 h-3.5 mr-1 text-blue-600" />
                            View Lease
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 3: TENANT DIRECTORY & USERS                           */}
      {/* ======================================================== */}
      {activeTab === 'directory' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1">
            <div>
              <h2 className="text-base font-bold text-gray-900">{isAdmin ? 'All Users Directory' : 'Tenant Profiles'}</h2>
              <p className="text-xs text-gray-500">Verified tenant details, credit metrics, and profile records.</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="bg-gray-100 p-0.5 rounded-lg flex items-center">
                <button
                  onClick={() => setDirectoryViewMode('cards')}
                  className={`px-2.5 py-1 text-xs font-bold rounded-md flex items-center gap-1 transition-all cursor-pointer ${
                    directoryViewMode === 'cards' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span>Cards</span>
                </button>
                <button
                  onClick={() => setDirectoryViewMode('table')}
                  className={`px-2.5 py-1 text-xs font-bold rounded-md flex items-center gap-1 transition-all cursor-pointer ${
                    directoryViewMode === 'table' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  <List className="w-3.5 h-3.5" />
                  <span>Table</span>
                </button>
              </div>
              {!isAdmin && (
                <Button size="sm" onClick={() => setIsModalOpen(true)}>
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Add Profile
                </Button>
              )}
            </div>
          </div>

          {directoryViewMode === 'cards' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {usersOrProfiles.map((p) => {
                const name = p.fullName || p.name || 'Tenant User';
                const initial = name.charAt(0).toUpperCase();
                const email = p.email || 'No email registered';
                const income = p.income ? formatLKR(p.income) : 'Verified';
                const credit = p.creditScore || '750+';
                const status = p.employmentStatus || 'Employed';

                return (
                  <div
                    key={p.id || p.userId}
                    className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col justify-between p-4 space-y-3"
                  >
                    {/* Header Avatar & Name */}
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#008037] to-emerald-600 text-white flex items-center justify-center font-black text-sm shrink-0 shadow-xs">
                        {initial}
                      </div>
                      <div className="truncate flex-1">
                        <div className="flex items-center justify-between">
                          <h4 className="font-bold text-sm text-gray-900 truncate">{name}</h4>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100">
                            Tenant
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-500 truncate flex items-center gap-1 mt-0.5">
                          <Mail className="w-3 h-3 shrink-0 text-gray-400" />
                          <span>{email}</span>
                        </p>
                      </div>
                    </div>

                    {/* Financial Metrics Grid */}
                    <div className="grid grid-cols-2 gap-2 bg-gray-50 rounded-lg p-2.5 text-[11px]">
                      <div>
                        <span className="text-gray-400 block text-[10px]">Monthly Income</span>
                        <span className="font-extrabold text-xs text-gray-900">{income}</span>
                      </div>
                      <div>
                        <span className="text-gray-400 block text-[10px]">Credit Score</span>
                        <span className="font-extrabold text-xs text-emerald-700">{credit}</span>
                      </div>
                      <div>
                        <span className="text-gray-400 block text-[10px]">Employment</span>
                        <span className="font-semibold text-gray-800 truncate block">{status}</span>
                      </div>
                      <div>
                        <span className="text-gray-400 block text-[10px]">Verification</span>
                        <span className="font-semibold text-emerald-600 truncate block">Verified ✓</span>
                      </div>
                    </div>

                    {/* Action Button */}
                    <button
                      onClick={() => navigate(`/tenants/${p.id || p.userId}`)}
                      className="w-full py-2 px-3 border border-gray-300 hover:bg-gray-50 text-gray-700 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Users className="w-3.5 h-3.5 text-gray-500" />
                      <span>View Full Profile</span>
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <DataTable
              data={usersOrProfiles}
              columns={
                isAdmin
                  ? [
                      { header: 'Full Name', accessor: 'fullName' },
                      { header: 'Email Address', accessor: 'email' },
                      {
                        header: 'Role',
                        accessor: (u) => {
                          const colors = { Tenant: 'default', PropertyOwner: 'success', Administrator: 'warning' };
                          return <Badge variant={colors[u.role] || 'default'}>{u.role}</Badge>;
                        }
                      },
                      {
                        header: 'Member Since',
                        accessor: (u) => <span className="text-gray-500 text-sm">{new Date(u.createdAt).toLocaleDateString()}</span>
                      }
                    ]
                  : [
                      { 
                        header: 'Tenant ID', 
                        accessor: (p) => <span className="font-mono text-xs text-gray-500">{String(p.userId || p.id).substring(0, 8)}...</span> 
                      },
                      { 
                        header: 'Income', 
                        accessor: (p) => <span className="font-bold text-emerald-600">{formatLKR(p.income)}/mo</span> 
                      },
                      { header: 'Credit Score', accessor: 'creditScore' },
                      { header: 'Employment Status', accessor: 'employmentStatus' }
                    ]
              }
              isLoading={isLoading}
              onRowClick={(item) => navigate(`/tenants/${item.id || item.userId}`)}
            />
          )}

          <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Add Tenant Profile">
            <TenantProfileForm onSubmit={handleCreateProfile} isLoading={isCreatingProfile} />
          </Modal>
        </div>
      )}

    </div>
  );
};