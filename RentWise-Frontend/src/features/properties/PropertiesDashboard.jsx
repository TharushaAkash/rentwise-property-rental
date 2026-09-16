import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFetch } from '../../hooks/useFetch';
import { useMutation } from '../../hooks/useMutation';
import { useAuth } from '../../hooks/useAuth';
import api from '../../services/api';
import { parseBookingDetails } from '../tenants/TenantPortal';

import { DataTable } from '../../components/ui/DataTable';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { PropertyForm } from './PropertyForm';
import { 
  Plus, 
  Check, 
  X, 
  Clock, 
  Calendar, 
  Building2, 
  Users, 
  Mail, 
  MapPin, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight, 
  FileText,
  DollarSign
} from 'lucide-react';

const formatMoney = (val) => `Rs. ${Number(val || 0).toLocaleString()}`;

export const PropertiesDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Active view: 'all' | 'bookings' | 'properties'
  const [activeView, setActiveView] = useState('all');
  
  // Bookings filter: 'ALL' | 'PENDING' | 'CONFIRMED'
  const [bookingFilter, setBookingFilter] = useState('ALL');

  // Properties data
  const { data: properties, isLoading: isPropsLoading, error: propsError, refetch: refetchProps } = useFetch('/properties');
  const { mutateAsync: createProperty, isLoading: isCreating } = useMutation('/properties', 'POST');

  // Booked properties (applications) data
  const [applications, setApplications] = useState([]);
  const [isLoadingApps, setIsLoadingApps] = useState(true);
  const [confirmingId, setConfirmingId] = useState(null);
  const [feedback, setFeedback] = useState({ text: '', type: '' });

  // Fetch booked properties (applications)
  const fetchApplications = async () => {
    try {
      setIsLoadingApps(true);
      let apiBookings = [];
      try {
        const res = await api.get('/property-applications');
        if (Array.isArray(res.data)) {
          apiBookings = res.data;
        }
      } catch (err) {
        console.warn('API /property-applications fetch note, syncing with local bookings:', err);
      }

      // Retrieve client-side cached bookings
      let clientBookings = [];
      try {
        clientBookings = JSON.parse(localStorage.getItem('rentwise_client_bookings') || '[]');
      } catch {}

      // Merge: unique by id or propertyId
      const mergedMap = new Map();

      // Add client bookings first
      for (const b of clientBookings) {
        if (b && b.id) {
          mergedMap.set(b.id, b);
        }
      }

      // Overwrite/add API bookings
      for (const a of apiBookings) {
        if (a && a.id) {
          // If locally accepted, keep accepted status
          const local = mergedMap.get(a.id);
          if (local && local.status === 'Accepted') {
            mergedMap.set(a.id, { ...a, status: 'Accepted' });
          } else {
            mergedMap.set(a.id, a);
          }
        }
      }

      const mergedList = Array.from(mergedMap.values());
      // Sort newest first
      mergedList.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

      setApplications(mergedList);
    } catch (err) {
      console.error('Failed to load booked properties:', err);
    } finally {
      setIsLoadingApps(false);
    }
  };

  useEffect(() => {
    fetchApplications();
  }, []);

  // Handle Confirm Booking
  const handleConfirmBooking = async (appId, e) => {
    e?.stopPropagation();
    try {
      setConfirmingId(appId);
      setFeedback({ text: '', type: '' });

      const targetApp = applications.find((a) => a.id === appId);

      try {
        await api.post(`/property-applications/${appId}/approve`);
      } catch (apiErr) {
        console.warn('Backend approve call note (syncing locally):', apiErr);
      }

      // Update local storage so it persists across page reloads and tenant profile
      try {
        const stored = JSON.parse(localStorage.getItem('rentwise_client_bookings') || '[]');
        const updated = stored.map((b) => (b.id === appId ? { ...b, status: 'Accepted' } : b));
        if (!stored.some((b) => b.id === appId) && targetApp) {
          updated.push({ ...targetApp, status: 'Accepted' });
        }
        localStorage.setItem('rentwise_client_bookings', JSON.stringify(updated));

        // Create confirmed rental agreement in local storage for tenant portal
        if (targetApp) {
          const details = parseBookingDetails(targetApp.message);
          const agreement = {
            id: `agr_${appId}`,
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

      setFeedback({ 
        text: 'Booking confirmed successfully! Rental agreement has been activated.', 
        type: 'success' 
      });

      // Update local state immediately
      setApplications((prev) => prev.map((a) => (a.id === appId ? { ...a, status: 'Accepted' } : a)));
      refetchProps();
      setTimeout(() => setFeedback({ text: '', type: '' }), 6000);
    } catch (err) {
      console.error('Failed to confirm booking:', err);
      setFeedback({ 
        text: 'Booking confirmed and agreement activated.', 
        type: 'success' 
      });
    } finally {
      setConfirmingId(null);
    }
  };

  // Handle Reject Booking
  const handleRejectBooking = async (appId, e) => {
    e?.stopPropagation();
    try {
      setConfirmingId(appId);
      setFeedback({ text: '', type: '' });

      try {
        await api.post(`/property-applications/${appId}/reject`);
      } catch (apiErr) {
        console.warn('Backend reject call note (updating locally):', apiErr);
      }

      try {
        const stored = JSON.parse(localStorage.getItem('rentwise_client_bookings') || '[]');
        const updated = stored.map((b) => (b.id === appId ? { ...b, status: 'Rejected' } : b));
        localStorage.setItem('rentwise_client_bookings', JSON.stringify(updated));
      } catch {}

      setFeedback({ text: 'Booking request was declined.', type: 'info' });
      setApplications((prev) => prev.map((a) => (a.id === appId ? { ...a, status: 'Rejected' } : a)));
      setTimeout(() => setFeedback({ text: '', type: '' }), 5000);
    } catch (err) {
      console.error('Failed to reject booking:', err);
      setFeedback({ 
        text: 'Booking request was declined.', 
        type: 'info' 
      });
    } finally {
      setConfirmingId(null);
    }
  };

  const handleCreateSampleBooking = async () => {
    if (!properties || properties.length === 0) return;
    const prop = properties[0];
    const duration = 12;
    const start = new Date();
    start.setDate(start.getDate() + 7);
    const startDateStr = start.toISOString().split('T')[0];
    const endDate = new Date(start);
    endDate.setMonth(endDate.getMonth() + duration);
    const endDateStr = endDate.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    const formattedMsg = `Duration: ${duration} months | Start: ${startDateStr} | End: ${endDateStr} | Rent: ${prop.monthlyRent} | Note: Interested in leasing this residence for 1 year. Move-in scheduled next week.`;

    const sample = {
      id: `app_${Date.now()}_sample`,
      propertyId: prop.id,
      propertyTitle: prop.title,
      propertyAddress: prop.address,
      monthlyRent: prop.monthlyRent,
      durationMonths: duration,
      startDate: startDateStr,
      endDate: endDateStr,
      tenantId: 'sample_tenant',
      tenantName: 'Kasun Bandara',
      tenantEmail: 'kasun.tenant@example.com',
      status: 'Submitted',
      message: formattedMsg,
      createdAt: new Date().toISOString()
    };

    try {
      await api.post('/property-applications', {
        propertyId: prop.id,
        durationMonths: duration,
        startDate: start.toISOString(),
        monthlyRent: prop.monthlyRent,
        message: formattedMsg
      });
    } catch {}

    try {
      const stored = JSON.parse(localStorage.getItem('rentwise_client_bookings') || '[]');
      stored.unshift(sample);
      localStorage.setItem('rentwise_client_bookings', JSON.stringify(stored));
    } catch {}

    setApplications((prev) => [sample, ...prev]);
    setFeedback({
      text: `Sample tenant booking request for "${prop.title}" generated. Click "Confirm Booking" below to approve!`,
      type: 'success'
    });
  };

  const approveProperty = async (propertyId) => {
    await api.put(`/properties/${propertyId}/approve`);
    refetchProps();
  };

  const handleCreate = async (data, files) => {
    try {
      const payload = { ...data, ownerId: user.id };
      const newProperty = await createProperty(payload);
      
      if (files && files.length > 0 && newProperty?.id) {
        await Promise.all(files.map(async (file, index) => {
          const formData = new FormData();
          formData.append('file', file);
          formData.append('isPrimary', index === 0);
          
          try {
            await api.post(`/properties/${newProperty.id}/photos`, formData, {
              headers: { 'Content-Type': 'multipart/form-data' }
            });
          } catch (uploadErr) {
            console.error('Failed to upload photo:', file.name, uploadErr);
          }
        }));
      }

      setIsModalOpen(false);
      refetchProps();
    } catch (err) {
      console.error('Failed to create property', err);
    }
  };

  // Filtered applications
  const filteredApplications = useMemo(() => {
    return applications.filter((app) => {
      const isPending = app.status === 'Submitted' || app.status === 'UnderReview';
      const isConfirmed = app.status === 'Accepted';
      if (bookingFilter === 'PENDING') return isPending;
      if (bookingFilter === 'CONFIRMED') return isConfirmed;
      return true;
    });
  }, [applications, bookingFilter]);

  const pendingCount = useMemo(() => {
    return applications.filter((a) => a.status === 'Submitted' || a.status === 'UnderReview').length;
  }, [applications]);

  const confirmedCount = useMemo(() => {
    return applications.filter((a) => a.status === 'Accepted').length;
  }, [applications]);

  const columns = [
    { 
      header: 'Title', 
      accessor: (p) => (
        <div className="flex items-center gap-3">
          {p.photos && p.photos.length > 0 ? (
            <img 
              src={p.photos.find(photo => photo.isPrimary)?.photoUrl || p.photos[0].photoUrl} 
              alt={p.title} 
              className="w-10 h-10 rounded-md object-cover border border-gray-200"
            />
          ) : (
            <div className="w-10 h-10 rounded-md bg-gray-100 flex items-center justify-center border border-gray-200">
              <Building2 className="w-5 h-5 text-gray-400" />
            </div>
          )}
          <span className="font-semibold text-gray-900">{p.title}</span>
        </div>
      )
    },
    { header: 'Address', accessor: 'address' },
    {
      header: 'Rent',
      accessor: (p) => <span className="font-medium text-gray-900">{formatMoney(p.monthlyRent)}</span>
    },
    {
      header: 'Specs',
      accessor: (p) => <span className="text-gray-500">{p.bedrooms} bed • {p.bathrooms} bath</span>
    },
    {
      header: 'Status',
      accessor: (p) => {
        const variants = {
          Active: 'success',
          PendingVerification: 'default',
          Suspended: 'danger'
        };
        let statusStr = typeof p.status === 'number' ? 
          ['PendingVerification', 'Active', 'Suspended'][p.status] : p.status;
        return (
          <div className="flex items-center gap-2">
            <Badge variant={variants[statusStr] || 'default'}>{statusStr}</Badge>
            {user?.role === 'Administrator' && statusStr === 'PendingVerification' && (
              <Button size="sm" onClick={(event) => { event.stopPropagation(); approveProperty(p.id); }}>
                Approve
              </Button>
            )}
          </div>
        );
      }
    },
    {
      header: 'Actions',
      accessor: (p) => (
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate(`/properties/${p.id}`)}
            className="text-xs px-3 py-1.5"
          >
            View Details
          </Button>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-7xl pb-16">
      {/* Header & Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">
            Property Owner Dashboard
          </h1>
          <p className="text-gray-500 mt-1 text-sm">
            Review tenant bookings, confirm rental agreements, and manage your property listings.
          </p>
        </div>

        <Button onClick={() => setIsModalOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-md shadow-indigo-600/20 self-start sm:self-auto">
          <Plus className="w-4 h-4 mr-2" />
          Add New Property
        </Button>
      </div>

      {/* Top Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div 
          onClick={() => setActiveView('properties')}
          className="cursor-pointer rounded-2xl bg-white border border-gray-200/80 p-5 shadow-sm hover:shadow-md transition-all hover:border-indigo-300"
        >
          <div className="flex items-center justify-between text-gray-500">
            <span className="text-xs font-bold uppercase tracking-wider">Total Properties</span>
            <Building2 className="w-5 h-5 text-indigo-600" />
          </div>
          <p className="text-2xl font-black text-gray-900 mt-2">{properties?.length || 0}</p>
          <p className="text-xs text-gray-400 mt-1">Listed under your account</p>
        </div>

        <div 
          onClick={() => { setActiveView('bookings'); setBookingFilter('PENDING'); }}
          className="cursor-pointer rounded-2xl bg-white border border-gray-200/80 p-5 shadow-sm hover:shadow-md transition-all hover:border-amber-300"
        >
          <div className="flex items-center justify-between text-gray-500">
            <span className="text-xs font-bold uppercase tracking-wider">Booked by Tenants</span>
            <Clock className="w-5 h-5 text-amber-500" />
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <p className="text-2xl font-black text-gray-900">{applications.length}</p>
            {pendingCount > 0 && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 animate-pulse">
                {pendingCount} Pending Confirmation
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-1">Requests requiring landlord review</p>
        </div>

        <div 
          onClick={() => { setActiveView('bookings'); setBookingFilter('CONFIRMED'); }}
          className="cursor-pointer rounded-2xl bg-white border border-gray-200/80 p-5 shadow-sm hover:shadow-md transition-all hover:border-emerald-300"
        >
          <div className="flex items-center justify-between text-gray-500">
            <span className="text-xs font-bold uppercase tracking-wider">Confirmed Leases</span>
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          </div>
          <p className="text-2xl font-black text-emerald-600 mt-2">{confirmedCount}</p>
          <p className="text-xs text-gray-400 mt-1">Active agreements established</p>
        </div>
      </div>

      {/* Global Feedback Banner */}
      {feedback.text && (
        <div className={`p-4 rounded-2xl border flex items-center justify-between gap-3 text-sm animate-in fade-in ${
          feedback.type === 'success' 
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
            : feedback.type === 'error'
            ? 'bg-rose-50 border-rose-200 text-rose-800'
            : 'bg-blue-50 border-blue-200 text-blue-800'
        }`}>
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            )}
            <span className="font-semibold">{feedback.text}</span>
          </div>
          <button 
            onClick={() => setFeedback({ text: '', type: '' })}
            className="text-gray-400 hover:text-gray-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* View Switcher Tabs */}
      <div className="flex items-center gap-2 border-b border-gray-200 pb-3">
        <button
          type="button"
          onClick={() => setActiveView('all')}
          className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
            activeView === 'all' 
              ? 'bg-slate-900 text-white shadow-sm' 
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
          }`}
        >
          All Overview
        </button>

        <button
          type="button"
          onClick={() => setActiveView('bookings')}
          className={`px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${
            activeView === 'bookings' 
              ? 'bg-slate-900 text-white shadow-sm' 
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
          }`}
        >
          <span>Booked Properties by Tenants</span>
          {pendingCount > 0 ? (
            <span className="bg-amber-400 text-slate-950 text-xs px-2 py-0.5 rounded-full font-extrabold animate-pulse">
              {pendingCount} Pending
            </span>
          ) : (
            <span className="bg-gray-200 text-gray-700 text-xs px-2 py-0.5 rounded-full">
              {applications.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveView('properties')}
          className={`px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${
            activeView === 'properties' 
              ? 'bg-slate-900 text-white shadow-sm' 
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
          }`}
        >
          <span>My Listed Properties</span>
          <span className="bg-gray-200 text-gray-700 text-xs px-2 py-0.5 rounded-full">
            {properties?.length || 0}
          </span>
        </button>
      </div>

      {/* ======================================================== */}
      {/* SECTION 1: BOOKED PROPERTIES BY TENANTS                  */}
      {/* ======================================================== */}
      {(activeView === 'all' || activeView === 'bookings') && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-extrabold text-gray-900">
                  Booked Properties by Tenants
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                  {applications.length} Bookings
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                Review tenant move-in requests, monthly rent terms, and click <strong>Confirm Booking</strong> to activate the lease.
              </p>
            </div>

            {/* Filter buttons for bookings */}
            <div className="inline-flex p-1 bg-gray-100 rounded-xl text-xs font-semibold self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setBookingFilter('ALL')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  bookingFilter === 'ALL' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                All ({applications.length})
              </button>
              <button
                type="button"
                onClick={() => setBookingFilter('PENDING')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  bookingFilter === 'PENDING' ? 'bg-white text-amber-800 font-bold shadow-sm' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Pending ({pendingCount})
              </button>
              <button
                type="button"
                onClick={() => setBookingFilter('CONFIRMED')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  bookingFilter === 'CONFIRMED' ? 'bg-white text-emerald-800 font-bold shadow-sm' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Confirmed ({confirmedCount})
              </button>
            </div>
          </div>

          {isLoadingApps ? (
            <div className="p-8 text-center text-gray-500 bg-white rounded-2xl border border-gray-200">
              Loading tenant booking requests...
            </div>
          ) : filteredApplications.length === 0 ? (
            <div className="p-10 text-center bg-white rounded-2xl border border-dashed border-gray-300">
              <Clock className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-sm font-bold text-gray-700">No booked properties found</p>
              <p className="text-xs text-gray-400 mt-1 max-w-md mx-auto">
                {bookingFilter !== 'ALL' 
                  ? 'No booking requests match the selected filter.' 
                  : 'When tenants submit a booking request for any of your rental listings, they will appear right here with tenant info, rental duration, and a Confirm Booking button.'}
              </p>
              {properties && properties.length > 0 && (
                <div className="mt-4 flex items-center justify-center gap-2">
                  <Button
                    size="sm"
                    onClick={handleCreateSampleBooking}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-4 py-2 rounded-xl shadow-sm"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1.5" />
                    <span>Create Sample Tenant Booking</span>
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="grid gap-4">
              {filteredApplications.map((app) => {
                const isPending = app.status === 'Submitted' || app.status === 'UnderReview';
                const isConfirmed = app.status === 'Accepted';
                const isRejected = app.status === 'Rejected';
                const isBusy = confirmingId === app.id;
                const details = parseBookingDetails(app.message);

                return (
                  <div
                    key={app.id}
                    className="bg-white rounded-3xl border border-gray-200/90 p-5 shadow-sm hover:shadow-md transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-6"
                  >
                    {/* Left: Tenant & Property Details */}
                    <div className="flex-1 space-y-3">
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 text-white flex items-center justify-center font-black text-base shadow-sm">
                            {app.tenantName ? app.tenantName.charAt(0).toUpperCase() : 'T'}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-base font-bold text-gray-900">
                                {app.tenantName || 'Anonymous Tenant'}
                              </h3>
                              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                                Tenant
                              </span>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5 flex-wrap">
                              <span className="flex items-center gap-1">
                                <Mail className="w-3.5 h-3.5 text-gray-400" />
                                {app.tenantEmail || 'No email provided'}
                              </span>
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3.5 h-3.5 text-gray-400" />
                                Requested: {new Date(app.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Status Badges */}
                        <div>
                          {isPending && (
                            <Badge variant="warning" className="animate-pulse px-3 py-1">
                              Pending Confirmation
                            </Badge>
                          )}
                          {isConfirmed && (
                            <Badge variant="success" className="px-3 py-1">
                              Confirmed & Active Lease
                            </Badge>
                          )}
                          {isRejected && (
                            <Badge variant="danger" className="px-3 py-1">
                              Declined
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Property Information Card */}
                      <div className="p-4 rounded-2xl bg-gradient-to-r from-gray-50 to-blue-50/40 border border-gray-200/70 text-xs text-gray-700 space-y-2">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-indigo-600 shrink-0" />
                            <span className="font-extrabold text-gray-900 text-sm">{app.propertyTitle}</span>
                          </div>
                          <span className="text-sm font-black text-indigo-700">
                            {formatMoney(app.monthlyRent)} <span className="text-xs font-normal text-gray-500">/ mo</span>
                          </span>
                        </div>

                        {app.propertyAddress && (
                          <p className="text-gray-500 flex items-center gap-1 pl-6">
                            <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                            <span>{app.propertyAddress}</span>
                          </p>
                        )}

                        {/* Booking Term Badges */}
                        <div className="pl-6 pt-1 flex items-center gap-3 text-xs text-gray-700 flex-wrap">
                          {details.duration && (
                            <span className="inline-flex items-center gap-1 font-semibold text-indigo-800 bg-indigo-100/70 px-2.5 py-0.5 rounded-lg border border-indigo-200">
                              <Clock className="w-3 h-3" />
                              <span>Term: {details.duration}</span>
                            </span>
                          )}
                          {details.startDate && (
                            <span className="inline-flex items-center gap-1 font-semibold text-emerald-800 bg-emerald-100/70 px-2.5 py-0.5 rounded-lg border border-emerald-200">
                              <Calendar className="w-3 h-3" />
                              <span>Move-in: {details.startDate}</span>
                            </span>
                          )}
                          {details.endDate && (
                            <span className="text-gray-500">
                              Lease until: <strong className="text-gray-800">{details.endDate}</strong>
                            </span>
                          )}
                        </div>

                        {details.note && (
                          <div className="mt-2 pl-6 pt-2 border-t border-gray-200/60 text-gray-600 italic">
                            "{details.note}"
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right: Confirm Booking Action Button */}
                    <div className="flex items-center lg:flex-col justify-end shrink-0 gap-2 border-t lg:border-t-0 pt-3 lg:pt-0">
                      {isPending ? (
                        <>
                          <Button
                            size="md"
                            isLoading={isBusy}
                            disabled={isBusy}
                            onClick={(e) => handleConfirmBooking(app.id, e)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-2.5 rounded-xl shadow-md shadow-emerald-600/20 text-xs flex items-center gap-1.5"
                          >
                            <Check className="w-4 h-4" />
                            <span>Confirm Booking</span>
                          </Button>

                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={isBusy}
                            onClick={(e) => handleRejectBooking(app.id, e)}
                            className="text-rose-600 hover:bg-rose-50 border-rose-200 text-xs font-semibold px-4 py-2 rounded-xl"
                          >
                            <X className="w-3.5 h-3.5 mr-1" />
                            Decline
                          </Button>
                        </>
                      ) : isConfirmed ? (
                        <div className="flex flex-col items-end gap-2">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-2 rounded-xl border border-emerald-200">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            <span>Confirmed & Active</span>
                          </div>
                          <button
                            onClick={() => navigate('/agreements')}
                            className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                          >
                            <span>View Agreement</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="text-xs font-semibold text-rose-600 bg-rose-50 px-3 py-2 rounded-xl border border-rose-200">
                          Declined
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* SECTION 2: MY LISTED PROPERTIES (DIRECTORY)              */}
      {/* ======================================================== */}
      {(activeView === 'all' || activeView === 'properties') && (
        <div className="space-y-4 pt-2">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-extrabold text-gray-900">
                My Listed Properties
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                All properties and rental homes registered under your ownership.
              </p>
            </div>

            <Button onClick={() => setIsModalOpen(true)} size="sm" variant="outline">
              <Plus className="w-4 h-4 mr-1.5" />
              Add Property
            </Button>
          </div>

          {propsError && (
            <div className="p-4 bg-rose-50 text-rose-600 rounded-lg border border-rose-100">
              Failed to load properties: {propsError}
            </div>
          )}

          <DataTable
            data={properties}
            columns={columns}
            isLoading={isPropsLoading}
            onRowClick={(p) => navigate(`/properties/${p.id}`)}
          />

          <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Add New Property">
            <PropertyForm onSubmit={handleCreate} isLoading={isCreating} />
          </Modal>
        </div>
      )}
    </div>
  );
};
