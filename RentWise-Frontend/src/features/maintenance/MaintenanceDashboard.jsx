import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import api from '../../services/api';

import { DataTable } from '../../components/ui/DataTable';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { RequestForm } from './RequestForm';
import { 
  Plus, 
  Wrench, 
  Home, 
  MapPin, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  DollarSign, 
  Sparkles,
  ArrowRight,
  Filter,
  Image as ImageIcon
} from 'lucide-react';

const money = (val) => `Rs. ${Number(val || 0).toLocaleString()}`;

export const MaintenanceDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isTenant = user?.role === 'Tenant';

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPropertyForModal, setSelectedPropertyForModal] = useState(null);
  
  const [requests, setRequests] = useState([]);
  const [bookedProperties, setBookedProperties] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState({ text: '', type: '' });
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Load Booked Properties and Maintenance Requests
  const loadData = async () => {
    setIsLoading(true);
    setError('');
    try {
      if (isTenant) {
        // Fetch Tenant's bookings, active agreements, and maintenance requests
        const [agreementsRes, appsRes, requestsRes, allPropsRes] = await Promise.all([
          api.get('/agreements/mine').catch(() => ({ data: [] })),
          api.get('/property-applications').catch(() => ({ data: [] })),
          api.get('/maintenance-requests/mine').catch(() => ({ data: [] })),
          api.get('/properties').catch(() => ({ data: [] }))
        ]);

        const allPropsMap = new Map();
        (allPropsRes.data || []).forEach((p) => {
          if (p && p.id) allPropsMap.set(p.id, p);
        });

        // 1. Process Tenant Booked Properties
        const propMap = new Map();

        // From active agreements in backend
        (agreementsRes.data || []).forEach((ag) => {
          const propId = ag.propertyId;
          const fullProp = allPropsMap.get(propId);
          propMap.set(propId, {
            id: propId,
            propertyId: propId,
            title: ag.propertyTitle || fullProp?.title || `Property #${String(propId).slice(0, 8)}`,
            address: ag.propertyAddress || fullProp?.address || 'Address on file',
            monthlyRent: ag.agreedMonthlyRent || ag.monthlyRent || fullProp?.monthlyRent || 0,
            statusBadge: 'Active Lease',
            statusVariant: 'success'
          });
        });

        // From applications (approved or pending)
        (appsRes.data || []).forEach((app) => {
          const isMyBooking = app.tenantId === user?.id || app.tenantEmail === user?.email;
          if (isMyBooking && (app.status === 'Accepted' || app.status === 'Approved' || app.status === 'Submitted')) {
            const propId = app.propertyId;
            if (!propMap.has(propId)) {
              const fullProp = allPropsMap.get(propId);
              propMap.set(propId, {
                id: propId,
                propertyId: propId,
                title: app.propertyTitle || fullProp?.title || `Property #${String(propId).slice(0, 8)}`,
                address: app.propertyAddress || fullProp?.address || 'Address on file',
                monthlyRent: app.monthlyRent || fullProp?.monthlyRent || 0,
                statusBadge: app.status === 'Accepted' ? 'Booking Approved' : 'Booking Request',
                statusVariant: app.status === 'Accepted' ? 'success' : 'warning'
              });
            }
          }
        });

        // Merge local storage cached agreements
        try {
          const localAgreements = JSON.parse(localStorage.getItem('rentwise_client_agreements') || '[]');
          localAgreements.forEach((ag) => {
            const propId = ag.propertyId;
            if (propId && !propMap.has(propId)) {
              propMap.set(propId, {
                id: propId,
                propertyId: propId,
                title: ag.propertyTitle || `Property #${String(propId).slice(0, 8)}`,
                address: ag.propertyAddress || 'Address on file',
                monthlyRent: ag.agreedMonthlyRent || ag.monthlyRent || 0,
                statusBadge: 'Active Lease',
                statusVariant: 'success'
              });
            }
          });

          const localBookings = JSON.parse(localStorage.getItem('rentwise_client_bookings') || '[]');
          localBookings.forEach((b) => {
            const propId = b.propertyId;
            if (propId && !propMap.has(propId) && (b.status === 'Accepted' || b.status === 'Submitted')) {
              propMap.set(propId, {
                id: propId,
                propertyId: propId,
                title: b.propertyTitle || `Property #${String(propId).slice(0, 8)}`,
                address: b.propertyAddress || 'Address on file',
                monthlyRent: b.monthlyRent || 0,
                statusBadge: b.status === 'Accepted' ? 'Booking Approved' : 'Booking Request',
                statusVariant: b.status === 'Accepted' ? 'success' : 'warning'
              });
            }
          });
        } catch (e) {
          console.error('LocalStorage load note:', e);
        }

        const bookedList = Array.from(propMap.values());
        setBookedProperties(bookedList);

        // 2. Process Requests
        let reqList = Array.isArray(requestsRes.data) ? requestsRes.data : [];
        
        // Enrich requests with property names if missing
        reqList = reqList.map((r) => {
          const foundProp = propMap.get(r.propertyId) || allPropsMap.get(r.propertyId);
          return {
            ...r,
            propertyTitle: r.property?.title || foundProp?.title || `Property #${String(r.propertyId).slice(0, 8)}`,
            propertyAddress: r.property?.address || foundProp?.address || ''
          };
        });

        setRequests(reqList);
      } else {
        // Owner or Admin
        const [requestsRes, allPropsRes] = await Promise.all([
          api.get('/maintenance-requests').catch(() => ({ data: [] })),
          api.get('/properties').catch(() => ({ data: [] }))
        ]);

        const allPropsMap = new Map();
        (allPropsRes.data || []).forEach((p) => {
          if (p && p.id) allPropsMap.set(p.id, p);
        });

        let reqList = Array.isArray(requestsRes.data) ? requestsRes.data : [];
        reqList = reqList.map((r) => {
          const foundProp = allPropsMap.get(r.propertyId);
          return {
            ...r,
            propertyTitle: r.property?.title || foundProp?.title || `Property #${String(r.propertyId).slice(0, 8)}`,
            propertyAddress: r.property?.address || foundProp?.address || ''
          };
        });

        setRequests(reqList);
      }
    } catch (err) {
      console.error('Failed to load maintenance data', err);
      setError('Could not load maintenance requests.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  // Handle open modal for a specific booked property
  const handleOpenForProperty = (property) => {
    setSelectedPropertyForModal(property);
    setIsModalOpen(true);
  };

  // Handle open modal generally
  const handleOpenGeneral = () => {
    setSelectedPropertyForModal(null);
    setIsModalOpen(true);
  };

  // Submit new maintenance request
  const handleCreate = async (formData) => {
    try {
      setIsCreating(true);
      setFeedback({ text: '', type: '' });

      const payload = {
        propertyId: formData.propertyId,
        tenantId: user?.id || formData.tenantId,
        description: formData.description,
        photoUrl: formData.photoUrl || '',
        aiCategory: formData.aiCategory || 'General',
        aiPriority: formData.aiPriority || 'Medium',
        status: formData.status || 'Reported'
      };

      const res = await api.post('/maintenance-requests', payload);
      
      // Feedback & state update
      setFeedback({
        text: 'Maintenance request created successfully! Our team will triage and review it.',
        type: 'success'
      });
      setIsModalOpen(false);

      // Refresh list
      await loadData();
    } catch (err) {
      console.error('Failed to submit maintenance request', err);
      const errMsg = err.response?.data?.message || err.response?.data || 'Failed to submit maintenance request. Please verify details.';
      setFeedback({
        text: typeof errMsg === 'string' ? errMsg : 'Failed to submit maintenance request.',
        type: 'error'
      });
    } finally {
      setIsCreating(false);
    }
  };

  // Filter requests
  const filteredRequests = useMemo(() => {
    if (statusFilter === 'ALL') return requests;
    return requests.filter((r) => String(r.status).toLowerCase() === statusFilter.toLowerCase());
  }, [requests, statusFilter]);

  const priorityVariants = { 
    Emergency: 'danger', 
    High: 'warning', 
    Medium: 'default', 
    Low: 'info' 
  };
  
  const statusVariants = { 
    Completed: 'success', 
    InProgress: 'info', 
    Assigned: 'warning', 
    Reported: 'default' 
  };

  const columns = [
    {
      header: 'Property',
      accessor: (r) => (
        <div>
          <span className="font-bold text-gray-900 block text-sm">
            {r.propertyTitle || r.property?.title || `Property #${String(r.propertyId).slice(0, 8)}`}
          </span>
          {r.propertyAddress && (
            <span className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
              <MapPin className="w-3 h-3 text-gray-400 shrink-0" />
              <span className="truncate max-w-xs">{r.propertyAddress}</span>
            </span>
          )}
        </div>
      )
    },
    {
      header: 'Category',
      accessor: (r) => (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-gray-100 text-gray-700">
          <Wrench className="w-3 h-3 text-gray-500" />
          {r.aiCategory || 'General'}
        </span>
      )
    },
    {
      header: 'Issue Description',
      accessor: (r) => (
        <div className="max-w-md">
          <span className="text-gray-900 text-sm font-medium line-clamp-2">
            {r.description || r.issueDescription || 'Maintenance inspection'}
          </span>
          {r.photoUrl && (
            <span className="inline-flex items-center gap-1 text-[11px] text-blue-600 font-semibold mt-1">
              <ImageIcon className="w-3 h-3" /> Photo Attached
            </span>
          )}
        </div>
      )
    },
    {
      header: 'Priority',
      accessor: (r) => {
        const priority = r.aiPriority || r.priority || 'Medium';
        return <Badge variant={priorityVariants[priority] || 'default'}>{priority}</Badge>;
      }
    },
    {
      header: 'Status',
      accessor: (r) => {
        const status = r.status || 'Reported';
        return <Badge variant={statusVariants[status] || 'default'}>{status}</Badge>;
      }
    },
    {
      header: 'Reported Date',
      accessor: (r) => (
        <span className="text-xs text-gray-500">
          {new Date(r.createdAt || r.reportedAt || Date.now()).toLocaleDateString()}
        </span>
      )
    }
  ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 font-sans pb-12">
      
      {/* 1. TOP HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-100">
              {isTenant ? 'Tenant Support Portal' : 'Property Maintenance'}
            </span>
            <span className="text-xs font-semibold text-gray-500">
              {requests.length} Total Requests
            </span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">
            Maintenance & Repairs
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {isTenant
              ? 'Select your booked property to submit repair tickets, or track active maintenance requests.'
              : 'Review and triage property maintenance requests across your portfolio.'}
          </p>
        </div>

        <Button 
          onClick={handleOpenGeneral}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-2.5 rounded-xl shadow-lg shadow-blue-600/25"
        >
          <Plus className="w-4 h-4 mr-2" />
          Report Issue
        </Button>
      </div>

      {/* Feedback Banner */}
      {feedback.text && (
        <div 
          className={`p-4 rounded-2xl flex items-center justify-between gap-3 text-sm font-semibold border animate-in fade-in ${
            feedback.type === 'success' 
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            )}
            <span>{feedback.text}</span>
          </div>
          <button 
            onClick={() => setFeedback({ text: '', type: '' })}
            className="text-xs font-bold underline opacity-70 hover:opacity-100"
          >
            Dismiss
          </button>
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-50 text-rose-600 rounded-2xl border border-rose-100 text-sm font-medium">
          {error}
        </div>
      )}

      {/* ========================================================== */}
      {/* 2. TENANT SECTION: MY BOOKED PROPERTIES CARDS              */}
      {/* ========================================================== */}
      {isTenant && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-extrabold text-gray-900 flex items-center gap-2">
                <Home className="w-5 h-5 text-blue-600" />
                <span>My Booked Properties</span>
                <span className="text-xs font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                  {bookedProperties.length}
                </span>
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Choose a booked property to quickly request maintenance or report an issue.
              </p>
            </div>

            <button
              onClick={() => navigate('/properties')}
              className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 hover:underline"
            >
              <span>Browse more homes</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {bookedProperties.length === 0 ? (
            <div className="p-8 rounded-3xl bg-white border border-dashed border-gray-200 text-center">
              <Home className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-sm font-bold text-gray-700">No Booked Properties Found</p>
              <p className="text-xs text-gray-400 mt-1 max-w-md mx-auto">
                You do not have any active booked properties yet. Once you book a rental home and it is confirmed, you can submit maintenance requests for it here.
              </p>
              <button
                onClick={() => navigate('/properties')}
                className="mt-4 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-600/20"
              >
                Browse & Book Properties
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {bookedProperties.map((prop) => (
                <div
                  key={prop.id}
                  className="rounded-3xl bg-white border border-gray-200/80 p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group"
                >
                  <div className="space-y-3">
                    {/* Header: Icon & Status */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="w-11 h-11 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                        <Home className="w-5 h-5" />
                      </div>
                      <Badge variant={prop.statusVariant || 'success'} className="text-[11px] font-bold">
                        {prop.statusBadge || 'Booked'}
                      </Badge>
                    </div>

                    {/* Title & Address */}
                    <div>
                      <h3 className="text-base font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                        {prop.title}
                      </h3>
                      <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                        <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        <span className="truncate">{prop.address}</span>
                      </p>
                    </div>

                    {/* Rent Info */}
                    <div className="p-3 bg-gray-50 rounded-2xl flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-gray-500">Monthly Rent</span>
                      <span className="text-sm font-extrabold text-blue-600">
                        {money(prop.monthlyRent)} <span className="text-[11px] font-normal text-gray-400">/ mo</span>
                      </span>
                    </div>
                  </div>

                  {/* Primary Action Button */}
                  <div className="mt-5 pt-3 border-t border-gray-100">
                    <button
                      onClick={() => handleOpenForProperty(prop)}
                      className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-sm hover:shadow shadow-blue-600/20"
                    >
                      <Wrench className="w-4 h-4" />
                      <span>Request Maintenance</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ========================================================== */}
      {/* 3. MAINTENANCE TICKETS SECTION                            */}
      {/* ========================================================== */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-extrabold text-gray-900">
              {isTenant ? 'My Maintenance Requests' : 'All Maintenance Tickets'}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Track status updates, technician assignments, and repair resolution.
            </p>
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-1.5 bg-gray-100 p-1 rounded-xl">
            {['ALL', 'Reported', 'Assigned', 'InProgress', 'Completed'].map((tab) => {
              const active = statusFilter === tab;
              return (
                <button
                  key={tab}
                  onClick={() => setStatusFilter(tab)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    active ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  {tab === 'ALL' ? 'All' : tab === 'InProgress' ? 'In Progress' : tab}
                </button>
              );
            })}
          </div>
        </div>

        {/* Requests DataTable */}
        <DataTable
          data={filteredRequests}
          columns={columns}
          isLoading={isLoading}
          emptyMessage={
            isTenant
              ? "You haven't submitted any maintenance requests yet. Click 'Request Maintenance' above to report an issue."
              : "No maintenance requests found matching your filter."
          }
          onRowClick={(r) => navigate(`/maintenance/${r.id}`)}
        />
      </section>

      {/* ========================================================== */}
      {/* 4. MODAL FORM: CREATE MAINTENANCE REQUEST                 */}
      {/* ========================================================== */}
      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title="Create Maintenance Request"
        className="max-w-xl"
      >
        <RequestForm 
          properties={bookedProperties}
          selectedProperty={selectedPropertyForModal}
          onSubmit={handleCreate}
          onCancel={() => setIsModalOpen(false)}
          isLoading={isCreating}
        />
      </Modal>
    </div>
  );
};