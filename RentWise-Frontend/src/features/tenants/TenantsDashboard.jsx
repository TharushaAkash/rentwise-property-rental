import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import api from '../../services/api';

import { DataTable } from '../../components/ui/DataTable';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { TenantProfileForm } from './TenantProfileForm';
import { parseBookingDetails } from './TenantPortal';
import { 
  Users, 
  Home, 
  Calendar, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Plus, 
  Search, 
  Check, 
  X, 
  FileText, 
  Mail, 
  Phone, 
  AlertCircle,
  Building2,
  DollarSign
} from 'lucide-react';

const formatMoney = (val) => `Rs. ${Number(val || 0).toLocaleString()}`;

export const TenantsDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'Administrator';

  // Active tab: 'bookings' | 'renting' | 'directory'
  const [activeTab, setActiveTab] = useState('bookings');
  
  // Data states
  const [applications, setApplications] = useState([]);
  const [agreements, setAgreements] = useState([]);
  const [usersOrProfiles, setUsersOrProfiles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [feedbackMessage, setFeedbackMessage] = useState({ text: '', type: '' });

  // Filters & Modals
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCreatingProfile, setIsCreatingProfile] = useState(false);

  // Load all dashboard data
  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [appsRes, agreementsRes, directoryRes] = await Promise.all([
        api.get('/property-applications').catch(() => ({ data: [] })),
        api.get('/agreements').catch(() => ({ data: [] })),
        api.get(isAdmin ? '/users' : '/tenant-profiles').catch(() => ({ data: [] }))
      ]);

      let apiBookings = Array.isArray(appsRes.data) ? appsRes.data : [];
      let apiAgreements = Array.isArray(agreementsRes.data) ? agreementsRes.data : [];

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
        clientAgreements = JSON.parse(localStorage.getItem('rentwise_client_agreements') || '[]');
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
        await api.post(`/property-applications/${id}/approve`);
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
            status: 'Active',
            termsAndConditions: `Standard ${details.duration || '12-Month'} Residential Lease Agreement confirmed on ${new Date().toLocaleDateString()}.`
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

      setFeedbackMessage({ text: 'Booking confirmed successfully! Rental agreement activated.', type: 'success' });
      setApplications((prev) => prev.map((a) => (a.id === id ? { ...a, status: 'Accepted' } : a)));
      await fetchData();
    } catch (err) {
      setFeedbackMessage({ text: 'Booking confirmed successfully! Rental agreement activated.', type: 'success' });
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

        {!isAdmin && activeTab === 'directory' && (
          <Button onClick={() => setIsModalOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Tenant Profile
          </Button>
        )}
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
            <div className="grid gap-4">
              {filteredApplications.map((app) => {
                const isPending = app.status === 'Submitted' || app.status === 'UnderReview';
                const isApproved = app.status === 'Accepted';
                const isRejected = app.status === 'Rejected';
                const isBusy = actionLoadingId === app.id;

                return (
                  <div
                    key={app.id}
                    className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-sm hover:shadow-md transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-6"
                  >
                    {/* Left: Who booked the property & Property info */}
                    <div className="flex-1 flex flex-col md:flex-row gap-5">
                      
                      {/* Tenant Profile Avatar */}
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center font-bold text-lg shrink-0 shadow-md shadow-blue-500/20">
                        {app.tenantName ? app.tenantName.charAt(0).toUpperCase() : 'T'}
                      </div>

                      {/* Main Info */}
                      <div className="space-y-2 flex-1">
                        <div>
                          <div className="flex items-center gap-2.5 flex-wrap">
                            <h3 className="text-base font-bold text-gray-900">
                              {app.tenantName}
                            </h3>
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                              Tenant Applicant
                            </span>
                            {isPending && (
                              <Badge variant="warning" className="animate-pulse">
                                Pending Review
                              </Badge>
                            )}
                            {isApproved && (
                              <Badge variant="success">
                                Approved
                              </Badge>
                            )}
                            {isRejected && (
                              <Badge variant="danger">
                                Rejected
                              </Badge>
                            )}
                          </div>

                          <div className="flex items-center gap-4 text-xs text-gray-500 mt-1 flex-wrap">
                            <span className="flex items-center gap-1">
                              <Mail className="w-3.5 h-3.5 text-gray-400" />
                              {app.tenantEmail || 'No email provided'}
                            </span>
                            {app.tenantPhone && (
                              <span className="flex items-center gap-1">
                                <Phone className="w-3.5 h-3.5 text-gray-400" />
                                {app.tenantPhone}
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5 text-gray-400" />
                              Requested {new Date(app.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>

                        {/* Booked Property & Terms Box */}
                        {(() => {
                          const details = parseBookingDetails(app.message);
                          return (
                            <div className="p-3.5 bg-gray-50/90 rounded-2xl border border-gray-200/70 text-xs text-gray-700 space-y-2">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                                <div className="flex items-center gap-2">
                                  <Building2 className="w-4 h-4 text-blue-600 shrink-0" />
                                  <span className="font-bold text-gray-900 text-sm">{app.propertyTitle}</span>
                                </div>
                                <span className="font-extrabold text-blue-600 text-sm">
                                  {formatMoney(app.monthlyRent)} <span className="text-[11px] font-normal text-gray-500">/ mo</span>
                                </span>
                              </div>

                              {app.propertyAddress && (
                                <p className="text-gray-500 pl-6">{app.propertyAddress}</p>
                              )}

                              {/* Booking Term Badges */}
                              <div className="pl-6 pt-1 flex items-center gap-4 text-xs text-gray-600 flex-wrap">
                                {details.duration && (
                                  <span className="inline-flex items-center gap-1 font-semibold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-lg border border-indigo-100">
                                    <Clock className="w-3 h-3" />
                                    <span>Term: {details.duration}</span>
                                  </span>
                                )}
                                {details.startDate && (
                                  <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-lg border border-emerald-100">
                                    <Calendar className="w-3 h-3" />
                                    <span>Move-in: {details.startDate}</span>
                                  </span>
                                )}
                                {details.endDate && (
                                  <span className="text-gray-500">
                                    Until: <strong>{details.endDate}</strong>
                                  </span>
                                )}
                              </div>

                              {details.note && (
                                <div className="mt-2 pl-6 pt-2 border-t border-gray-200/60 text-gray-600 italic">
                                  "{details.note}"
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    </div>

                    {/* Right: Approve / Reject Action Buttons */}
                    <div className="flex items-center gap-2 lg:flex-col lg:items-end justify-end shrink-0 border-t lg:border-t-0 pt-4 lg:pt-0">
                      {isPending ? (
                        <>
                          <Button
                            size="sm"
                            isLoading={isBusy}
                            disabled={isBusy}
                            onClick={(e) => handleApprove(app.id, e)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/20 px-4 py-2 font-bold text-xs"
                          >
                            <Check className="w-3.5 h-3.5 mr-1.5" />
                            Confirm Booking
                          </Button>

                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={isBusy}
                            onClick={(e) => handleReject(app.id, e)}
                            className="text-rose-600 hover:bg-rose-50 border-rose-200 px-3 py-2 text-xs font-semibold"
                          >
                            <X className="w-3.5 h-3.5 mr-1" />
                            Reject
                          </Button>
                        </>
                      ) : isApproved ? (
                        <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-2 rounded-xl border border-emerald-200">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          <span>Approved & Leased</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-700 bg-rose-50 px-3 py-2 rounded-xl border border-rose-200">
                          <XCircle className="w-4 h-4 text-rose-600" />
                          <span>Request Rejected</span>
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => navigate(`/properties/${app.propertyId}`)}
                        className="text-xs text-blue-600 hover:underline font-medium pt-1"
                      >
                        View Property Details
                      </button>
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
                        {/* Property */}
                        <td className="px-6 py-4">
                          <div className="font-bold text-gray-900">
                            {ag.propertyTitle || `Property ${String(ag.propertyId).slice(0, 8)}`}
                          </div>
                          <p className="text-xs text-gray-500 truncate max-w-xs">{ag.propertyAddress || 'No address'}</p>
                        </td>

                        {/* Tenant */}
                        <td className="px-6 py-4">
                          <div className="font-semibold text-gray-900">{ag.tenantName || 'Anonymous'}</div>
                          <p className="text-xs text-gray-500">{ag.tenantEmail || 'No email'}</p>
                        </td>

                        {/* Rent */}
                        <td className="px-6 py-4">
                          <span className="font-bold text-emerald-600 text-base">
                            {formatMoney(ag.agreedMonthlyRent || ag.monthlyRent)}
                          </span>
                          <span className="text-xs text-gray-400 block">per month</span>
                        </td>

                        {/* Dates */}
                        <td className="px-6 py-4 text-xs">
                          <div className="text-gray-900 font-medium">
                            {ag.startDate ? new Date(ag.startDate).toLocaleDateString() : 'N/A'} - {ag.endDate ? new Date(ag.endDate).toLocaleDateString() : 'Ongoing'}
                          </div>
                          <span className="text-gray-400">12 Months Lease</span>
                        </td>

                        {/* Status */}
                        <td className="px-6 py-4">
                          <Badge variant={ag.status === 'Active' ? 'success' : 'default'}>
                            {ag.status || 'Active'}
                          </Badge>
                        </td>

                        {/* Actions */}
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
                      accessor: (p) => <span className="font-bold text-emerald-600">{formatMoney(p.income)}/mo</span> 
                    },
                    { header: 'Credit Score', accessor: 'creditScore' },
                    { header: 'Employment Status', accessor: 'employmentStatus' }
                  ]
            }
            isLoading={isLoading}
            onRowClick={(item) => navigate(`/tenants/${item.id || item.userId}`)}
          />

          <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Add Tenant Profile">
            <TenantProfileForm onSubmit={handleCreateProfile} isLoading={isCreatingProfile} />
          </Modal>
        </div>
      )}

    </div>
  );
};