import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import api from '../../services/api';

import { DataTable } from '../../components/ui/DataTable';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { RequestForm } from './RequestForm';
import { Plus, Wrench, Home, MapPin, Clock, CheckCircle2, AlertCircle, DollarSign, Sparkles, ArrowRight, Filter, Trash2, Image as ImageIcon, LayoutGrid, List, Search, Building2, Calendar, CalendarDays, User, Mail, Phone, ShieldAlert, Check, RotateCcw, SlidersHorizontal, ChevronRight } from 'lucide-react';
import { PROPERTY_PLACEHOLDER_IMAGE, handleImageError } from '../../utils/imagePlaceholder';

const money = (val) => `Rs. ${Number(val || 0).toLocaleString()}`;

const extractPropertyPhoto = (p) => {
  if (!p) return null;
  if (p.photoUrl && typeof p.photoUrl === 'string') return p.photoUrl;
  if (p.PhotoUrl && typeof p.PhotoUrl === 'string') return p.PhotoUrl;
  const photoList = p.photos || p.Photos;
  if (Array.isArray(photoList) && photoList.length > 0) {
    const primary = photoList.find((ph) => ph && (ph.isPrimary || ph.IsPrimary));
    const chosen = primary || photoList[0];
    return chosen?.photoUrl || chosen?.PhotoUrl || chosen?.url || null;
  }
  return null;
};

const CATEGORY_ICONS = {
  Plumbing: '🚰',
  Electrical: '⚡',
  HVAC: '❄️',
  Appliance: '🔌',
  Structural: '🔨',
  Carpentry: '🪚',
  Pest: '🐜',
  Painting: '🎨',
  General: '🛠️'
};

const AVAILABLE_CATEGORIES = [
  { value: 'Plumbing', label: 'Plumbing', icon: '🚰' },
  { value: 'Electrical', label: 'Electrical', icon: '⚡' },
  { value: 'HVAC', label: 'HVAC & AC', icon: '❄️' },
  { value: 'Appliance', label: 'Appliance', icon: '🔌' },
  { value: 'Structural', label: 'Structural', icon: '🔨' },
  { value: 'Carpentry', label: 'Carpentry', icon: '🪚' },
  { value: 'Pest', label: 'Pest Control', icon: '🐜' },
  { value: 'Painting', label: 'Painting', icon: '🎨' },
  { value: 'General', label: 'General Handyman', icon: '🛠️' }
];

const getProviderCategories = (sp) => {
  if (Array.isArray(sp?.categories) && sp.categories.length > 0) {
    return sp.categories;
  }
  if (typeof sp?.category === 'string' && sp.category.trim()) {
    return sp.category.split(',').map((s) => s.trim()).filter(Boolean);
  }
  return ['General'];
};

const getPriorityStyle = (priority) => {
  const p = (priority || 'Medium').toLowerCase();
  if (p === 'emergency' || p === 'urgent') {
    return {
      label: 'Emergency',
      badgeClass: 'bg-rose-600 text-white shadow-xs animate-pulse',
      cardBorder: 'border-rose-300 hover:border-rose-400'
    };
  }
  if (p === 'high') {
    return {
      label: 'High Priority',
      badgeClass: 'bg-amber-600 text-white shadow-xs',
      cardBorder: 'border-amber-300 hover:border-amber-400'
    };
  }
  if (p === 'low') {
    return {
      label: 'Low Priority',
      badgeClass: 'bg-slate-600 text-white shadow-xs',
      cardBorder: 'border-slate-200 hover:border-slate-300'
    };
  }
  return {
    label: 'Medium Priority',
    badgeClass: 'bg-blue-600 text-white shadow-xs',
    cardBorder: 'border-blue-200 hover:border-blue-300'
  };
};

const getStatusStyle = (status) => {
  const s = (status || 'Reported').toLowerCase();
  if (s === 'completed') {
    return {
      label: 'Completed ✓',
      badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      dotClass: 'bg-emerald-500'
    };
  }
  if (s === 'inprogress') {
    return {
      label: 'In Progress',
      badgeClass: 'bg-blue-100 text-blue-800 border-blue-300',
      dotClass: 'bg-blue-500'
    };
  }
  if (s === 'assigned') {
    return {
      label: 'Assigned',
      badgeClass: 'bg-amber-100 text-amber-800 border-amber-300',
      dotClass: 'bg-amber-500'
    };
  }
  return {
    label: 'Reported (New)',
    badgeClass: 'bg-slate-100 text-slate-800 border-slate-300',
    dotClass: 'bg-slate-400'
  };
};

export const MaintenanceDashboard = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
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

  useEffect(() => {
    if (searchParams.get('action') === 'new') {
      setIsModalOpen(true);
    }
  }, [searchParams]);

  // Main Tabs: 'requests' | 'providers'
  const [activeMainTab, setActiveMainTab] = useState('requests');

  // Filter & View states for Maintenance Requests
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'Reported' | 'Assigned' | 'InProgress' | 'Completed'
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('cards'); // 'cards' | 'table'

  // Service Providers State (Loaded ONLY from database / API / owner entries)
  const [serviceProviders, setServiceProviders] = useState([]);
  const [providerSearchQuery, setProviderSearchQuery] = useState('');
  const [providerCategoryFilter, setProviderCategoryFilter] = useState('ALL');

  // Add Service Provider Modal State
  const [isProviderModalOpen, setIsProviderModalOpen] = useState(false);
  const [isSavingProvider, setIsSavingProvider] = useState(false);
  const [providerForm, setProviderForm] = useState({
    name: '',
    categories: ['Plumbing'],
    contactNumber: '',
    serviceArea: ''
  });

  const toggleProviderCategory = (cat) => {
    setProviderForm((prev) => {
      const current = prev.categories || [];
      if (current.includes(cat)) {
        if (current.length === 1) return prev; // Keep at least one category selected
        return { ...prev, categories: current.filter((c) => c !== cat) };
      } else {
        return { ...prev, categories: [...current, cat] };
      }
    });
  };

  // Quick Status Update Modal State
  const [statusModalItem, setStatusModalItem] = useState(null);
  const [statusTarget, setStatusTarget] = useState('InProgress');
  const [statusNotes, setStatusNotes] = useState('');
  const [isSavingStatus, setIsSavingStatus] = useState(false);

  // Load Booked Properties and Maintenance Requests
  const loadData = async () => {
    setIsLoading(true);
    setError('');
    try {
      if (isTenant) {
        // Fetch Tenant's bookings, active agreements, and maintenance requests
        const [agreementsRes, appsRes, requestsRes, allPropsRes] = await Promise.all([
          api.get('/agreements/mine').catch(() => api.get('/agreements').catch(() => ({ data: [] }))),
          api.get('/property-applications').catch(() => ({ data: [] })),
          api.get('/maintenance-requests/mine').catch(() => api.get('/maintenance-requests').catch(() => ({ data: [] }))),
          api.get('/properties').catch(() => ({ data: [] }))
        ]);

        const allPropsMap = new Map();

        (allPropsRes.data || []).forEach((p) => {
          if (p && p.id) {
            allPropsMap.set(String(p.id), p);
            allPropsMap.set(p.id, p);
          }
        });

        // 1. Process Tenant Booked Properties
        const propMap = new Map();

        try {
          const localAgreements = JSON.parse(localStorage.getItem('rentwise_client_agreements') || '[]');
          localAgreements.forEach(ag => {
            if (ag && (!ag.tenantId || !user?.id || ag.tenantId === user?.id)) {
              if (ag.status !== 'Rejected' && ag.status !== 'Terminated') {
                if (!agreementsRes.data) agreementsRes.data = [];
                agreementsRes.data.push(ag);
              }
            }
          });

          const localBookings = JSON.parse(localStorage.getItem('rentwise_client_bookings') || '[]');
          localBookings.forEach(app => {
            if (app && (!app.tenantId || !user?.id || app.tenantId === user?.id)) {
              if (!appsRes.data) appsRes.data = [];
              appsRes.data.push(app);
            }
          });
        } catch (e) {
          console.warn('Could not load local agreements/bookings for maintenance', e);
        }

        (agreementsRes.data || []).forEach((ag) => {
          const propId = ag.propertyId;
          const fullProp = allPropsMap.get(String(propId)) || ag.property;
          const photoUrl = extractPropertyPhoto(fullProp) || extractPropertyPhoto(ag.property) || ag.photoUrl || PROPERTY_PLACEHOLDER_IMAGE;
          propMap.set(String(propId), {
            id: propId,
            propertyId: propId,
            title: ag.propertyTitle || fullProp?.title || `Property #${String(propId).slice(0, 8)}`,
            address: ag.propertyAddress || fullProp?.address || 'Colombo, Sri Lanka',
            monthlyRent: ag.agreedMonthlyRent || ag.monthlyRent || fullProp?.monthlyRent || 0,
            photoUrl: photoUrl,
            statusBadge: 'Active Lease',
            statusVariant: 'success'
          });
        });

        (appsRes.data || []).forEach((app) => {
          const isMyBooking = app.tenantId === user?.id || app.tenantEmail === user?.email;
          if (isMyBooking && (app.status === 'Accepted' || app.status === 'Approved' || app.status === 'Submitted')) {
            const propId = app.propertyId;
            if (!propMap.has(String(propId))) {
              const fullProp = allPropsMap.get(String(propId)) || app.property;
              const photoUrl = extractPropertyPhoto(fullProp) || extractPropertyPhoto(app.property) || app.photoUrl || PROPERTY_PLACEHOLDER_IMAGE;
              propMap.set(String(propId), {
                id: propId,
                propertyId: propId,
                title: app.propertyTitle || fullProp?.title || `Property #${String(propId).slice(0, 8)}`,
                address: app.propertyAddress || fullProp?.address || 'Colombo, Sri Lanka',
                monthlyRent: app.monthlyRent || fullProp?.monthlyRent || 0,
                photoUrl: photoUrl,
                statusBadge: app.status === 'Accepted' ? 'Booking Approved' : 'Booking Request',
                statusVariant: app.status === 'Accepted' ? 'success' : 'warning'
              });
            }
          }
        });

        const bookedList = Array.from(propMap.values());
        setBookedProperties(bookedList);

        // 2. Process Requests
        let reqList = Array.isArray(requestsRes.data) ? requestsRes.data : [];

        try {
          const localMaint = JSON.parse(localStorage.getItem('rentwise_client_maintenance') || '[]');
          if (localMaint.length > 0) {
            const reqMap = new Map();
            reqList.forEach((r) => { if (r && r.id) reqMap.set(String(r.id), r); });
            localMaint.forEach((lr) => {
              if (lr && lr.id && (!lr.tenantId || !user?.id || lr.tenantId === user?.id)) {
                if (!reqMap.has(String(lr.id))) {
                  reqMap.set(String(lr.id), lr);
                }
              }
            });
            reqList = Array.from(reqMap.values());
          }
        } catch (e) {}
        
        reqList = reqList.map((r) => {
          const foundProp = propMap.get(String(r.propertyId)) || 
                            allPropsMap.get(String(r.propertyId)) ||
                            r.property;
          const photoUrl = r.photoUrl || extractPropertyPhoto(r.property) || extractPropertyPhoto(foundProp) || PROPERTY_PLACEHOLDER_IMAGE;
          return {
            ...r,
            propertyTitle: r.propertyTitle || r.property?.title || foundProp?.title || `Property #${String(r.propertyId).slice(0, 8)}`,
            propertyAddress: r.propertyAddress || r.property?.address || foundProp?.address || 'Colombo, Sri Lanka',
            photoUrl: photoUrl
          };
        });

        setRequests(reqList);
      } else {
        // Owner or Administrator
        const [requestsRes, allPropsRes, agreementsRes] = await Promise.all([
          api.get('/maintenance-requests/mine').catch(() => api.get('/maintenance-requests').catch(() => ({ data: [] }))),
          api.get('/properties').catch(() => ({ data: [] })),
          api.get('/agreements/mine').catch(() => api.get('/agreements').catch(() => ({ data: [] })))
        ]);

        const allPropsList = Array.isArray(allPropsRes.data) ? allPropsRes.data : [];
        const allPropsMap = new Map();
        allPropsList.forEach((p) => {
          if (p && p.id) allPropsMap.set(String(p.id), p);
        });

        // Set owner properties as options for reporting issues
        setBookedProperties(allPropsList.map(p => ({
          ...p,
          propertyId: p.id,
          photoUrl: extractPropertyPhoto(p) || PROPERTY_PLACEHOLDER_IMAGE
        })));

        const agrTenantMap = new Map();
        (agreementsRes.data || []).forEach((ag) => {
          if (ag && ag.propertyId) {
            agrTenantMap.set(String(ag.propertyId), {
              name: ag.tenantName || ag.tenant?.fullName || 'Tenant Resident',
              email: ag.tenantEmail || ag.tenant?.email || 'tenant@rentwise.lk',
              phone: ag.tenantPhone || ag.tenant?.phoneNumber || '077 123 4567'
            });
          }
        });

        let reqList = Array.isArray(requestsRes.data) ? requestsRes.data : [];

        // Merge with client-side cached maintenance requests
        try {
          const rawLocalMaint = JSON.parse(localStorage.getItem('rentwise_client_maintenance') || '[]');
          const reqMap = new Map();
          reqList.forEach((r) => { if (r && r.id) reqMap.set(String(r.id), r); });
          rawLocalMaint.forEach((lr) => {
            if (lr && lr.id && !reqMap.has(String(lr.id))) {
              reqMap.set(String(lr.id), lr);
            }
          });
          reqList = Array.from(reqMap.values());
        } catch (e) {}

        reqList = reqList.map((r) => {
          const foundProp = allPropsMap.get(String(r.propertyId)) || r.property;
          const photoUrl = r.photoUrl || extractPropertyPhoto(r.property) || extractPropertyPhoto(foundProp) || PROPERTY_PLACEHOLDER_IMAGE;
          const tenantInfo = agrTenantMap.get(String(r.propertyId)) || {};
          return {
            ...r,
            propertyTitle: r.propertyTitle || r.property?.title || foundProp?.title || `Property #${String(r.propertyId).slice(0, 8)}`,
            propertyAddress: r.propertyAddress || r.property?.address || foundProp?.address || 'Colombo, Sri Lanka',
            photoUrl: photoUrl,
            tenantName: r.tenantName || r.tenant?.fullName || tenantInfo.name || 'Tenant Resident',
            tenantEmail: r.tenantEmail || r.tenant?.email || tenantInfo.email || 'tenant@rentwise.lk',
            tenantPhone: r.tenantPhone || r.tenant?.phoneNumber || tenantInfo.phone || '077 123 4567'
          };
        });

        setRequests(reqList);
      }

      // 3. Fetch Service Providers from API / Database (Owner database ONLY)
      try {
        const provRes = await api.get('/service-providers');
        let dbList = Array.isArray(provRes.data) ? provRes.data : [];

        try {
          const stored = JSON.parse(localStorage.getItem('rentwise_client_service_providers') || '[]');
          // Keep only genuine owner-added records (filter out old mock sp-1 to sp-12)
          const genuineStored = stored.filter(s => s && s.id && !String(s.id).startsWith('sp-'));
          
          const map = new Map();
          dbList.forEach(p => map.set(String(p.id), p));
          genuineStored.forEach(p => { if (!map.has(String(p.id))) map.set(String(p.id), p); });
          dbList = Array.from(map.values());

          // Clean localStorage so mock providers never reappear
          localStorage.setItem('rentwise_client_service_providers', JSON.stringify(dbList));
        } catch {}

        setServiceProviders(dbList);
      } catch (provErr) {
        try {
          const stored = JSON.parse(localStorage.getItem('rentwise_client_service_providers') || '[]');
          const genuineStored = stored.filter(s => s && s.id && !String(s.id).startsWith('sp-'));
          localStorage.setItem('rentwise_client_service_providers', JSON.stringify(genuineStored));
          setServiceProviders(genuineStored);
        } catch {
          setServiceProviders([]);
        }
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

  // Handle Add Service Provider to Database (Owner Feature)
  const handleCreateProvider = async (e) => {
    e.preventDefault();
    if (!providerForm.name.trim() || !providerForm.contactNumber.trim()) {
      setFeedback({ text: 'Please provide both the provider name and contact phone number.', type: 'error' });
      return;
    }

    const selectedCats = providerForm.categories && providerForm.categories.length > 0
      ? providerForm.categories
      : (providerForm.category ? [providerForm.category] : ['General']);

    try {
      setIsSavingProvider(true);
      const payload = {
        name: providerForm.name.trim(),
        category: selectedCats.join(', '),
        categories: selectedCats,
        contactNumber: providerForm.contactNumber.trim(),
        serviceArea: providerForm.serviceArea.trim() || 'Colombo & Suburbs'
      };

      let created = null;
      try {
        const res = await api.post('/service-providers', payload);
        created = res.data;
      } catch (postErr) {
        console.warn('Backend service-providers POST note, storing locally:', postErr);
      }

      const newRecord = created || {
        id: `sp_${Date.now()}`,
        ...payload,
        createdAt: new Date().toISOString()
      };

      try {
        const stored = JSON.parse(localStorage.getItem('rentwise_client_service_providers') || '[]');
        const updated = [newRecord, ...stored.filter(s => s.id !== newRecord.id)];
        localStorage.setItem('rentwise_client_service_providers', JSON.stringify(updated));
      } catch {}

      setServiceProviders(prev => [newRecord, ...prev.filter(p => p.id !== newRecord.id)]);
      setIsProviderModalOpen(false);
      setProviderForm({ name: '', categories: ['Plumbing'], contactNumber: '', serviceArea: '' });
      setFeedback({
        text: `Service provider "${newRecord.name}" (${selectedCats.join(', ')}) added to database successfully!`,
        type: 'success'
      });
      setTimeout(() => setFeedback({ text: '', type: '' }), 4000);
    } catch (err) {
      console.error('Failed to create service provider:', err);
      setFeedback({ text: 'Failed to add service provider.', type: 'error' });
    } finally {
      setIsSavingProvider(false);
    }
  };

  // Compute Metrics & Counts for Owner Dashboard
  const metrics = useMemo(() => {
    const totalCount = requests.length;
    const reportedCount = requests.filter((r) => (r.status || '').toLowerCase() === 'reported').length;
    const assignedCount = requests.filter((r) => (r.status || '').toLowerCase() === 'assigned').length;
    const inProgressCount = requests.filter((r) => (r.status || '').toLowerCase() === 'inprogress').length;
    const completedCount = requests.filter((r) => (r.status || '').toLowerCase() === 'completed').length;
    const activeWorkCount = assignedCount + inProgressCount;
    const urgentCount = requests.filter((r) => {
      const p = (r.aiPriority || r.priority || '').toLowerCase();
      return p === 'emergency' || p === 'urgent' || p === 'high';
    }).length;

    return {
      totalCount,
      reportedCount,
      assignedCount,
      inProgressCount,
      completedCount,
      activeWorkCount,
      urgentCount
    };
  }, [requests]);

  // Filter requests
  const filteredRequests = useMemo(() => {
    return requests.filter((r) => {
      // Status Filter
      if (statusFilter !== 'ALL') {
        const curStatus = (r.status || 'Reported').toLowerCase();
        if (curStatus !== statusFilter.toLowerCase()) return false;
      }

      // Category Filter
      if (categoryFilter !== 'ALL') {
        const cat = (r.aiCategory || r.category || 'General').toLowerCase();
        if (cat !== categoryFilter.toLowerCase()) return false;
      }

      // Search Query
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        (r.description && r.description.toLowerCase().includes(q)) ||
        (r.propertyTitle && r.propertyTitle.toLowerCase().includes(q)) ||
        (r.propertyAddress && r.propertyAddress.toLowerCase().includes(q)) ||
        (r.tenantName && r.tenantName.toLowerCase().includes(q)) ||
        (r.aiCategory && r.aiCategory.toLowerCase().includes(q)) ||
        (r.aiPriority && r.aiPriority.toLowerCase().includes(q)) ||
        (r.status && r.status.toLowerCase().includes(q))
      );
    });
  }, [requests, statusFilter, categoryFilter, searchQuery]);

  // Filter Service Providers for Directory
  const filteredProviders = useMemo(() => {
    return serviceProviders.filter((sp) => {
      const spCats = getProviderCategories(sp).map(c => c.toLowerCase());
      if (providerCategoryFilter !== 'ALL') {
        const target = providerCategoryFilter.toLowerCase();
        if (!spCats.includes(target) && !spCats.some(c => c.includes(target) || target.includes(c))) {
          return false;
        }
      }
      if (!providerSearchQuery) return true;
      const q = providerSearchQuery.toLowerCase();
      return (
        (sp.name && sp.name.toLowerCase().includes(q)) ||
        spCats.some(c => c.includes(q)) ||
        (sp.category && sp.category.toLowerCase().includes(q)) ||
        (sp.contactNumber && sp.contactNumber.toLowerCase().includes(q)) ||
        (sp.serviceArea && sp.serviceArea.toLowerCase().includes(q))
      );
    });
  }, [serviceProviders, providerCategoryFilter, providerSearchQuery]);

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

      const newId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `maint_${Date.now()}`;
      const payload = {
        propertyId: formData.propertyId,
        tenantId: user?.id || formData.tenantId,
        description: formData.description,
        photoUrl: formData.photoUrl || '',
        aiCategory: formData.aiCategory || 'General',
        aiPriority: formData.aiPriority || 'Medium',
        assignedServiceProviderId: formData.assignedServiceProviderId,
        assignedProviderName: formData.assignedProviderName,
        status: formData.status || (formData.assignedProviderName ? 'Assigned' : 'Reported')
      };

      let savedRecord = null;
      try {
        const res = await api.post('/maintenance-requests', payload);
        savedRecord = res.data;
      } catch (postErr) {
        console.warn('Backend maintenance-requests POST error, persisting locally:', postErr);
      }

      // Persist to localStorage for client-side resilience and immediate sync
      try {
        const localList = JSON.parse(localStorage.getItem('rentwise_client_maintenance') || '[]');
        const targetProp = bookedProperties.find((p) => (p.id || p.propertyId) === formData.propertyId);
        const entryToSave = {
          id: savedRecord?.id || newId,
          propertyId: formData.propertyId,
          propertyTitle: targetProp?.title || targetProp?.propertyTitle || 'Booked Property',
          propertyAddress: targetProp?.address || targetProp?.propertyAddress || '',
          description: formData.description,
          photoUrl: formData.photoUrl || '',
          aiCategory: formData.aiCategory || 'General',
          aiPriority: formData.aiPriority || 'Medium',
          assignedServiceProviderId: formData.assignedServiceProviderId,
          assignedProviderName: formData.assignedProviderName,
          status: formData.status || (formData.assignedProviderName ? 'Assigned' : 'Reported'),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          tenantId: user?.id || ''
        };
        const updated = [entryToSave, ...localList.filter((item) => item.id !== entryToSave.id)];
        localStorage.setItem('rentwise_client_maintenance', JSON.stringify(updated));
        window.dispatchEvent(new Event('storage'));
      } catch (locErr) {
        console.error('Failed to save to localStorage:', locErr);
      }
      
      setFeedback({
        text: 'Maintenance request created successfully! Our team will triage and review it.',
        type: 'success'
      });
      setIsModalOpen(false);
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

  // Quick Status Update for Owner Card Action
  const handleQuickStatusUpdate = async (request, newStatus, customNotes = '') => {
    try {
      // Optimistic UI update
      setRequests((prev) =>
        prev.map((r) => (r.id === request.id ? { ...r, status: newStatus, updatedAt: new Date().toISOString() } : r))
      );

      // Backend API call
      try {
        await api.put(`/maintenance-requests/${request.id}/status`, {
          status: newStatus,
          notes: customNotes || `Status updated to ${newStatus} by property owner.`
        });
      } catch (apiErr) {
        console.warn('Backend status note, syncing locally:', apiErr);
      }

      // Sync local storage
      try {
        const stored = JSON.parse(localStorage.getItem('rentwise_client_maintenance') || '[]');
        const updated = stored.map((item) => (item.id === request.id ? { ...item, status: newStatus, updatedAt: new Date().toISOString() } : item));
        localStorage.setItem('rentwise_client_maintenance', JSON.stringify(updated));
        window.dispatchEvent(new Event('storage'));
      } catch {}

      setFeedback({
        text: `Request status updated to "${newStatus}"!`,
        type: 'success'
      });
      setTimeout(() => setFeedback({ text: '', type: '' }), 4000);
      setStatusModalItem(null);
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  // Delete maintenance request
  const handleDeleteRequest = async (id, title, e) => {
    e?.stopPropagation();
    if (!window.confirm(`Are you sure you want to delete this maintenance request?`)) return;
    try {
      await api.delete(`/maintenance-requests/${id}`).catch(() => {});

      try {
        const localList = JSON.parse(localStorage.getItem('rentwise_client_maintenance') || '[]');
        const updated = localList.filter((item) => item.id !== id);
        localStorage.setItem('rentwise_client_maintenance', JSON.stringify(updated));
        window.dispatchEvent(new Event('storage'));
      } catch {}

      setRequests((prev) => prev.filter((r) => r.id !== id));
      setFeedback({ text: 'Maintenance request deleted successfully.', type: 'success' });
      setTimeout(() => setFeedback({ text: '', type: '' }), 4000);
    } catch (err) {
      console.error('Failed to delete request', err);
      const errMsg = err.response?.data?.message || 'Failed to delete maintenance request.';
      setFeedback({ text: errMsg, type: 'error' });
    }
  };

  // Table Columns Definition
  const priorityVariants = { Emergency: 'danger', High: 'warning', Medium: 'default', Low: 'info' };
  const statusVariants = { Completed: 'success', InProgress: 'info', Assigned: 'warning', Reported: 'default' };

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
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-gray-100 text-gray-700">
          <span>{CATEGORY_ICONS[r.aiCategory] || '🛠️'}</span>
          <span>{r.aiCategory || 'General'}</span>
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
            <span className="inline-flex items-center gap-1 text-[11px] text-blue-600 font-semibold mt-1 mr-2">
              <ImageIcon className="w-3 h-3" /> Photo Attached
            </span>
          )}
          {(r.assignedProviderName || r.assigned_provider || r.assignedServiceProvider?.name) && (
            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-bold mt-1 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              <Sparkles className="w-3 h-3 text-emerald-600" />
              {r.assignedProviderName || r.assigned_provider || r.assignedServiceProvider?.name}
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
    },
    {
      header: 'Actions',
      accessor: (r) => {
        const canDelete = isTenant || r.tenantId === user?.id || user?.role === 'Administrator' || user?.role === 'PropertyOwner';
        return (
          <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => navigate(`/maintenance/${r.id}`)}
              className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
              title="View Details"
            >
              <ArrowRight className="w-4 h-4" />
            </button>
            {canDelete && (
              <button
                onClick={(e) => handleDeleteRequest(r.id, r.propertyTitle || r.description, e)}
                className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                title="Delete Request"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        );
      }
    }
  ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 font-sans pb-16">
      
      {/* ========================================================== */}
      {/* 1. TOP HEADER & TITLE                                      */}
      {/* ========================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-[#008037] bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
              {isTenant ? 'Tenant Support Portal' : 'Owner Maintenance Hub'}
            </span>
            <span className="text-xs font-semibold text-gray-500">
              {requests.length} Total Requests
            </span>
            {metrics.urgentCount > 0 && (
              <span className="text-xs font-extrabold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200 animate-pulse flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                <span>{metrics.urgentCount} Urgent</span>
              </span>
            )}
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">
            Maintenance & Repairs
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {isTenant
              ? 'Select your booked property to submit repair tickets, or track active maintenance requests.'
              : 'Review, triage, and manage property repair tickets reported by tenants across your portfolio.'}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {!isTenant && (
            <Button
              onClick={() => setIsProviderModalOpen(true)}
              variant="outline"
              className="border-emerald-600/30 text-emerald-800 bg-emerald-50 hover:bg-emerald-100 font-bold px-4 py-2.5 rounded-xl shadow-xs flex items-center gap-2 cursor-pointer transition-all"
            >
              <Plus className="w-4 h-4 text-emerald-600" />
              <span>Add Service Provider</span>
            </Button>
          )}
          <Button 
            onClick={handleOpenGeneral}
            className="bg-[#008037] hover:bg-[#006e2e] text-white font-bold px-5 py-2.5 rounded-xl shadow-md shadow-emerald-700/20 flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Report Issue</span>
          </Button>
        </div>
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
            className="text-xs font-bold underline opacity-70 hover:opacity-100 cursor-pointer"
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
      {/* 2. TOP METRICS CARDS WITH LIVE COUNTS                      */}
      {/* ========================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Metric 1: Total Requests */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-sm relative overflow-hidden bg-gradient-to-br from-slate-50/70 via-white to-white">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200">
              Total Tickets
            </span>
            <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-xs">
              <Wrench className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl font-black text-gray-900">{metrics.totalCount}</span>
            <p className="text-xs text-gray-500 font-medium mt-0.5">Recorded across properties</p>
          </div>
        </div>

        {/* Metric 2: Needs Attention / Reported */}
        <div className="bg-white rounded-2xl p-5 border border-amber-200/90 shadow-sm relative overflow-hidden bg-gradient-to-br from-amber-50/50 via-white to-white">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800 bg-amber-100/80 px-2.5 py-0.5 rounded-full border border-amber-200">
              Needs Attention
            </span>
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-xs">
              <AlertCircle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-amber-900">{metrics.reportedCount}</span>
              {metrics.reportedCount > 0 && (
                <span className="text-[11px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full animate-pulse">
                  Action Required
                </span>
              )}
            </div>
            <p className="text-xs text-amber-700 font-medium mt-0.5">New issues awaiting review</p>
          </div>
        </div>

        {/* Metric 3: Active Repairs Underway */}
        <div className="bg-white rounded-2xl p-5 border border-blue-200/90 shadow-sm relative overflow-hidden bg-gradient-to-br from-blue-50/50 via-white to-white">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-blue-800 bg-blue-100/80 px-2.5 py-0.5 rounded-full border border-blue-200">
              Repairs Underway
            </span>
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl font-black text-blue-900">{metrics.activeWorkCount}</span>
            <p className="text-xs text-blue-700 font-medium mt-0.5">{metrics.assignedCount} assigned • {metrics.inProgressCount} in progress</p>
          </div>
        </div>

        {/* Metric 4: Completed & Resolved */}
        <div className="bg-white rounded-2xl p-5 border border-emerald-200/90 shadow-sm relative overflow-hidden bg-gradient-to-br from-emerald-50/50 via-white to-white">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-100/80 px-2.5 py-0.5 rounded-full border border-emerald-200">
              Resolved & Closed
            </span>
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl font-black text-emerald-900">{metrics.completedCount}</span>
            <p className="text-xs text-emerald-700 font-medium mt-0.5">Fixed and verified ✓</p>
          </div>
        </div>

      </div>

      {/* ========================================================== */}
      {/* 2.5 MAIN TAB SWITCHER (FOR OWNERS & ADMINS)                */}
      {/* ========================================================== */}
      {!isTenant && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-200 pb-3">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveMainTab('requests')}
              className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center gap-2 cursor-pointer ${
                activeMainTab === 'requests'
                  ? 'bg-slate-900 text-white shadow-md'
                  : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              <Wrench className="w-4 h-4 text-emerald-400" />
              <span>Maintenance Requests</span>
              <span className={`px-2 py-0.5 rounded-full text-[11px] ${
                activeMainTab === 'requests' ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-700'
              }`}>
                {requests.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveMainTab('providers')}
              className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center gap-2 cursor-pointer ${
                activeMainTab === 'providers'
                  ? 'bg-slate-900 text-white shadow-md'
                  : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              <User className="w-4 h-4 text-emerald-400" />
              <span>Service Providers Directory</span>
              <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                activeMainTab === 'providers' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              }`}>
                {serviceProviders.length} in DB
              </span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              onClick={() => setIsProviderModalOpen(true)}
              className="bg-[#008037] hover:bg-[#006e2e] text-white font-bold px-4 py-2 rounded-xl text-xs shadow-xs flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Add Service Provider</span>
            </Button>
          </div>
        </div>
      )}

      {activeMainTab === 'providers' && !isTenant ? (
        /* ========================================================== */
        /* SERVICE PROVIDERS DIRECTORY VIEW                           */
        /* ========================================================== */
        <div className="space-y-6 animate-in fade-in duration-300">
          {/* Directory Filters & Search Bar */}
          <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
            {/* Category Filter Pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
              {['ALL', 'Plumbing', 'Electrical', 'HVAC', 'Appliance', 'Structural', 'Pest', 'Painting', 'General'].map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setProviderCategoryFilter(cat)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                    providerCategoryFilter.toLowerCase() === cat.toLowerCase()
                      ? 'bg-emerald-700 text-white shadow-xs'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {cat !== 'ALL' && <span>{CATEGORY_ICONS[cat] || '🛠️'}</span>}
                  <span>{cat === 'ALL' ? 'All Trades' : cat}</span>
                </button>
              ))}
            </div>

            {/* Provider Search */}
            <div className="relative w-full md:w-72 shrink-0">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={providerSearchQuery}
                onChange={(e) => setProviderSearchQuery(e.target.value)}
                placeholder="Search contractors, area..."
                className="w-full pl-9 pr-8 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-semibold text-gray-900 placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-emerald-500"
              />
              {providerSearchQuery && (
                <button
                  type="button"
                  onClick={() => setProviderSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600 cursor-pointer"
                >
                  &times;
                </button>
              )}
            </div>
          </div>

          {/* Providers Grid */}
          {filteredProviders.length === 0 ? (
            <div className="py-20 text-center bg-white rounded-3xl border border-dashed border-gray-300 p-8">
              <User className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <h3 className="text-base font-extrabold text-gray-800">No Service Providers in Database</h3>
              <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
                {providerSearchQuery ? 'No providers match your search filter.' : 'Only service providers registered in your database are displayed. Click "+ Add Service Provider" to add verified contractors.'}
              </p>
              <Button
                type="button"
                onClick={() => setIsProviderModalOpen(true)}
                className="mt-4 bg-[#008037] hover:bg-[#006e2e] text-white text-xs font-bold"
              >
                + Add Service Provider
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredProviders.map((sp) => {
                const catIcon = CATEGORY_ICONS[sp.category] || '🛠️';
                return (
                  <div
                    key={sp.id}
                    className="bg-white rounded-3xl p-5 border border-gray-200/90 shadow-xs hover:shadow-md transition-all flex flex-col justify-between group space-y-4"
                  >
                    <div className="space-y-3">
                      {/* Top Row: Category Badges & AI Auto-Match Pill */}
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <div className="flex flex-wrap gap-1.5 max-w-[75%]">
                          {getProviderCategories(sp).map((cat) => (
                            <span
                              key={cat}
                              className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1 shadow-2xs"
                            >
                              <span>{CATEGORY_ICONS[cat] || '🛠️'}</span>
                              <span>{cat}</span>
                            </span>
                          ))}
                        </div>

                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 flex items-center gap-1 shrink-0">
                          <Sparkles className="w-3 h-3 text-emerald-600" />
                          <span>AI Auto-Match</span>
                        </span>
                      </div>

                      {/* Provider Name */}
                      <div>
                        <h4 className="text-base font-black text-gray-900 group-hover:text-emerald-700 transition-colors">
                          {sp.name}
                        </h4>
                        <p className="text-xs text-gray-500 flex items-center gap-1.5 mt-1 font-medium">
                          <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                          <span>{sp.serviceArea || 'Colombo & Greater Region'}</span>
                        </p>
                      </div>

                      {/* Contact Box */}
                      <div className="p-3 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs font-bold text-gray-700">
                          <Phone className="w-3.5 h-3.5 text-emerald-600" />
                          <span>{sp.contactNumber || 'No phone recorded'}</span>
                        </div>
                        {sp.contactNumber && (
                          <a
                            href={`tel:${sp.contactNumber}`}
                            className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 hover:underline flex items-center gap-1"
                          >
                            <span>Call</span>
                            <ArrowRight className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Footer / Database Status */}
                    <div className="pt-3 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-400 font-semibold">
                      <span className="flex items-center gap-1 text-emerald-700 font-bold">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Database Active</span>
                      </span>
                      <span>ID: #{String(sp.id).slice(-6)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <>
        {/* ========================================================== */}
        {/* 3. TENANT SECTION: MY BOOKED PROPERTIES CARDS (IF TENANT)  */}
        {/* ========================================================== */}
        {isTenant && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-extrabold text-gray-900 flex items-center gap-2">
                <Home className="w-5 h-5 text-emerald-600" />
                <span>My Booked Properties</span>
                <span className="text-xs font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                  {bookedProperties.length}
                </span>
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Choose a booked property to quickly request maintenance or report an issue.
              </p>
            </div>

            <button
              onClick={() => navigate('/properties')}
              className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 hover:underline cursor-pointer"
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
                className="mt-4 px-5 py-2.5 rounded-xl bg-[#008037] hover:bg-[#006e2e] text-white text-xs font-bold shadow-md shadow-emerald-700/20 cursor-pointer"
              >
                Browse & Book Properties
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {bookedProperties.map((prop) => {
                const displayPhoto = prop.photoUrl || PROPERTY_PLACEHOLDER_IMAGE;

                return (
                  <div
                    key={prop.id}
                    className="rounded-3xl bg-white border border-gray-200/80 shadow-xs hover:shadow-md transition-all flex flex-col justify-between group overflow-hidden"
                  >
                    <div className="relative h-44 w-full bg-slate-100 overflow-hidden">
                      <img
                        src={displayPhoto}
                        alt={prop.title}
                        onError={handleImageError}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 cursor-pointer"
                        onClick={() => navigate(`/properties/${prop.propertyId || prop.id}`)}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20 pointer-events-none" />

                      <div className="absolute top-3 left-3 bg-black/55 backdrop-blur-xs text-white text-[11px] font-bold px-2.5 py-1 rounded-xl flex items-center gap-1.5 shadow-sm">
                        <Home className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Booked Home</span>
                      </div>

                      <div className="absolute top-3 right-3">
                        <Badge 
                          variant={prop.statusVariant || 'success'} 
                          className="text-[11px] font-bold shadow-md backdrop-blur-xs"
                        >
                          {prop.statusBadge || 'Active Lease'}
                        </Badge>
                      </div>

                      {prop.address && (
                        <div className="absolute bottom-2.5 left-3 right-3 text-xs font-bold text-white flex items-center gap-1 drop-shadow truncate">
                          <MapPin className="w-3.5 h-3.5 text-white shrink-0" />
                          <span className="truncate">{prop.address}</span>
                        </div>
                      )}
                    </div>

                    <div className="p-5 space-y-3 flex-1 flex flex-col justify-between">
                      <div className="space-y-2">
                        <h3 
                          onClick={() => navigate(`/properties/${prop.propertyId || prop.id}`)}
                          className="text-base font-bold text-gray-900 group-hover:text-emerald-700 transition-colors cursor-pointer line-clamp-1"
                        >
                          {prop.title}
                        </h3>

                        <div className="p-3 bg-gray-50 rounded-2xl flex items-center justify-between">
                          <span className="text-[11px] font-semibold text-gray-500">Monthly Rent</span>
                          <span className="text-base font-black text-emerald-700">
                            {money(prop.monthlyRent)} <span className="text-[11px] font-normal text-gray-400">/ mo</span>
                          </span>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-gray-100">
                        <button
                          onClick={() => handleOpenForProperty(prop)}
                          className="w-full py-2.5 px-4 rounded-xl bg-[#008037] hover:bg-[#006e2e] text-white text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                        >
                          <Wrench className="w-4 h-4" />
                          <span>Request Maintenance</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* ========================================================== */}
      {/* 4. CONTROLS: SUB-FILTERS WITH COUNTS, SEARCH & VIEW TOGGLE */}
      {/* ========================================================== */}
      <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        
        {/* Status Sub-Filters with Dynamic Counts */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
              statusFilter === 'ALL'
                ? 'bg-gray-900 text-white shadow-xs'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <span>All Tickets</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10.5px] ${statusFilter === 'ALL' ? 'bg-white/25 text-white' : 'bg-gray-200 text-gray-800'}`}>
              {metrics.totalCount}
            </span>
          </button>

          <button
            onClick={() => setStatusFilter('Reported')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
              statusFilter === 'Reported'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <span>Needs Action</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10.5px] ${statusFilter === 'Reported' ? 'bg-white/25 text-white' : 'bg-amber-100 text-amber-800 font-black'}`}>
              {metrics.reportedCount}
            </span>
          </button>

          <button
            onClick={() => setStatusFilter('Assigned')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
              statusFilter === 'Assigned'
                ? 'bg-amber-700 text-white shadow-xs'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <span>Assigned</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10.5px] ${statusFilter === 'Assigned' ? 'bg-white/25 text-white' : 'bg-gray-200 text-gray-800'}`}>
              {metrics.assignedCount}
            </span>
          </button>

          <button
            onClick={() => setStatusFilter('InProgress')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
              statusFilter === 'InProgress'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <span>In Progress</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10.5px] ${statusFilter === 'InProgress' ? 'bg-white/25 text-white' : 'bg-gray-200 text-gray-800'}`}>
              {metrics.inProgressCount}
            </span>
          </button>

          <button
            onClick={() => setStatusFilter('Completed')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
              statusFilter === 'Completed'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <span>Completed</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10.5px] ${statusFilter === 'Completed' ? 'bg-white/25 text-white' : 'bg-emerald-100 text-emerald-800 font-black'}`}>
              {metrics.completedCount}
            </span>
          </button>
        </div>

        {/* Category Filter, Search Box & View Mode Toggle */}
        <div className="flex items-center gap-2.5 flex-wrap md:flex-nowrap">
          {/* Category Dropdown */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="text-xs font-semibold bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-2 outline-none focus:ring-2 focus:ring-emerald-500/20 text-gray-700 cursor-pointer"
          >
            <option value="ALL">All Categories</option>
            <option value="Plumbing">🚰 Plumbing</option>
            <option value="Electrical">⚡ Electrical</option>
            <option value="HVAC">❄️ HVAC</option>
            <option value="Appliance">🔌 Appliance</option>
            <option value="Structural">🔨 Structural</option>
            <option value="Pest">🐜 Pest Control</option>
            <option value="General">🛠️ General</option>
          </select>

          {/* Search Box */}
          <div className="relative min-w-[200px] flex-1 md:flex-initial">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search issue, tenant, property..."
              className="w-full pl-8 pr-4 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                &times;
              </button>
            )}
          </div>

          {/* View Toggle */}
          <div className="flex items-center bg-gray-100 p-0.5 rounded-xl border border-gray-200 shrink-0">
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={`p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'cards' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500 hover:text-gray-900'
              }`}
              title="Cards View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'table' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500 hover:text-gray-900'
              }`}
              title="Table View"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>

      </div>

      {/* ========================================================== */}
      {/* 5. CONTENT SECTION: CARDS VIEW VS TABLE VIEW              */}
      {/* ========================================================== */}
      {isLoading ? (
        <div className="py-24 text-center bg-white rounded-3xl border border-gray-200">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-emerald-500 border-t-transparent mb-3" />
          <p className="text-sm font-semibold text-gray-600">Loading maintenance requests and repair records...</p>
        </div>
      ) : filteredRequests.length === 0 ? (
        <div className="py-20 text-center bg-white rounded-3xl border border-dashed border-gray-300 p-8">
          <Wrench className="w-14 h-14 text-gray-300 mx-auto mb-3" />
          <h3 className="text-lg font-extrabold text-gray-800">
            {searchQuery ? 'No maintenance tickets match your search' : 'No maintenance requests found'}
          </h3>
          <p className="text-xs text-gray-500 mt-1 max-w-md mx-auto">
            {searchQuery 
              ? 'Try adjusting your search terms or clearing your status / category filters.' 
              : 'All properties are in good shape! When a tenant submits a repair ticket, it will appear here for review and triage.'}
          </p>
          {searchQuery && (
            <button
              onClick={() => { setSearchQuery(''); setStatusFilter('ALL'); setCategoryFilter('ALL'); }}
              className="mt-4 px-4 py-2 bg-gray-900 text-white text-xs font-bold rounded-xl hover:bg-gray-800 transition-colors cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>
      ) : viewMode === 'cards' ? (
        /* --- CARDS VIEW --- */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredRequests.map((r) => {
            const priorityInfo = getPriorityStyle(r.aiPriority || r.priority);
            const statusInfo = getStatusStyle(r.status);
            const catIcon = CATEGORY_ICONS[r.aiCategory] || '🛠️';
            const reportedDateFormatted = new Date(r.createdAt || r.reportedAt || Date.now()).toLocaleDateString(undefined, {
              year: 'numeric',
              month: 'short',
              day: 'numeric'
            });

            return (
              <div
                key={r.id}
                className={`bg-white rounded-3xl border ${priorityInfo.cardBorder} overflow-hidden shadow-xs hover:shadow-xl transition-all duration-300 flex flex-col justify-between group`}
              >
                <div>
                  {/* Property Image Banner Header */}
                  <div 
                    onClick={() => navigate(`/maintenance/${r.id}`)}
                    className="relative h-44 w-full overflow-hidden bg-gray-100 cursor-pointer"
                  >
                    <img
                      src={r.photoUrl || PROPERTY_PLACEHOLDER_IMAGE}
                      alt={r.propertyTitle}
                      onError={handleImageError}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/30 to-transparent" />

                    {/* Category Chip (Top-Left) */}
                    <div className="absolute top-3 left-3">
                      <span className="px-3 py-1 rounded-full text-[11px] font-extrabold shadow-sm bg-black/60 backdrop-blur-xs text-white border border-white/20 flex items-center gap-1.5">
                        <span>{catIcon}</span>
                        <span>{r.aiCategory || 'General Issue'}</span>
                      </span>
                    </div>

                    {/* Priority Badge (Top-Right) */}
                    <div className="absolute top-3 right-3">
                      <span className={`px-2.5 py-1 rounded-full text-[11px] font-black border border-white/25 flex items-center gap-1 ${priorityInfo.badgeClass}`}>
                        {priorityInfo.label}
                      </span>
                    </div>

                    {/* Property Title & Address Overlay (Bottom) */}
                    <div className="absolute bottom-3 left-3 right-3 text-white">
                      <h3 className="text-base font-black tracking-tight drop-shadow-sm truncate group-hover:text-emerald-300 transition-colors">
                        {r.propertyTitle}
                      </h3>
                      <p className="text-xs text-white/90 drop-shadow-xs truncate flex items-center gap-1 mt-0.5 font-medium">
                        <MapPin className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
                        <span>{r.propertyAddress}</span>
                      </p>
                    </div>
                  </div>

                  {/* Card Content Body */}
                  <div className="p-5 space-y-4">
                    
                    {/* Issue Description Box */}
                    <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3.5 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400">
                          Issue Reported
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[10.5px] font-bold border flex items-center gap-1.5 ${statusInfo.badgeClass}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dotClass}`} />
                          <span>{statusInfo.label}</span>
                        </span>
                      </div>
                      
                      <p className="text-sm font-bold text-gray-900 line-clamp-2 leading-snug">
                        {r.description || r.issueDescription || 'Repair inspection needed for premises.'}
                      </p>

                      {r.photoUrl && r.photoUrl !== PROPERTY_PLACEHOLDER_IMAGE && (
                        <div className="flex items-center gap-1 text-[11px] font-bold text-blue-600 pt-1">
                          <ImageIcon className="w-3.5 h-3.5" />
                          <span>Tenant photo attached</span>
                        </div>
                      )}
                    </div>

                    {/* AI Auto-Assigned Contractor Badge */}
                    {(r.assignedProviderName || r.assigned_provider || r.assignedServiceProvider?.name) && (
                      <div className="p-3 rounded-2xl bg-emerald-50/90 border border-emerald-200/90 flex items-center justify-between gap-2.5">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-xl bg-[#008037] text-white flex items-center justify-center font-black text-xs shrink-0 shadow-xs">
                            <Sparkles className="w-4 h-4 text-emerald-200" />
                          </div>
                          <div className="min-w-0">
                            <span className="text-[10px] font-black uppercase tracking-wider text-[#008037] block">
                              AI Assigned Provider
                            </span>
                            <p className="text-xs font-black text-gray-900 truncate">
                              {r.assignedProviderName || r.assigned_provider || r.assignedServiceProvider?.name}
                            </p>
                          </div>
                        </div>
                        <span className="text-[10px] font-extrabold text-emerald-800 bg-white px-2 py-0.5 rounded-full border border-emerald-200 shrink-0">
                          Auto-Matched
                        </span>
                      </div>
                    )}

                    {/* Tenant Reporter Snippet */}
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-slate-700 text-white flex items-center justify-center font-black text-xs shadow-xs shrink-0">
                        {r.tenantName ? r.tenantName.slice(0, 2).toUpperCase() : 'TN'}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-extrabold text-gray-900 truncate">
                            {r.tenantName || 'Tenant Resident'}
                          </p>
                          <span className="text-[10px] font-bold text-gray-400 bg-gray-200/60 px-1.5 py-0.2 rounded">
                            Reporter
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-500 truncate flex items-center gap-1 mt-0.5">
                          <Mail className="w-3 h-3 text-gray-400 shrink-0" />
                          <span>{r.tenantEmail || 'tenant@rentwise.lk'}</span>
                        </p>
                      </div>
                    </div>

                    {/* Reported Date Metadata */}
                    <div className="flex justify-between items-center text-xs text-gray-500 pt-1">
                      <span className="flex items-center gap-1.5 text-gray-400">
                        <CalendarDays className="w-3.5 h-3.5" />
                        <span>Date Reported:</span>
                      </span>
                      <span className="font-semibold text-gray-800">{reportedDateFormatted}</span>
                    </div>

                  </div>
                </div>

                {/* Card Action Footer with Triage Controls */}
                <div className="p-5 pt-0">
                  <div className="pt-3 border-t border-gray-100 flex items-center gap-2">
                    
                    {/* Quick Status Action Button */}
                    {(r.status || 'Reported').toLowerCase() === 'reported' && (
                      <button
                        type="button"
                        onClick={() => {
                          setStatusModalItem(r);
                          setStatusTarget('Assigned');
                          setStatusNotes('Technician assigned to inspect and carry out repairs.');
                        }}
                        className="flex-1 py-2 px-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Wrench className="w-3.5 h-3.5" />
                        <span>Assign Tech</span>
                      </button>
                    )}

                    {(r.status || '').toLowerCase() === 'assigned' && (
                      <button
                        type="button"
                        onClick={() => handleQuickStatusUpdate(r, 'InProgress')}
                        className="flex-1 py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Clock className="w-3.5 h-3.5" />
                        <span>Start Work</span>
                      </button>
                    )}

                    {(r.status || '').toLowerCase() === 'inprogress' && (
                      <button
                        type="button"
                        onClick={() => {
                          setStatusModalItem(r);
                          setStatusTarget('Completed');
                          setStatusNotes('Repair completed and verified.');
                        }}
                        className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Mark Complete</span>
                      </button>
                    )}

                    {(r.status || '').toLowerCase() === 'completed' && (
                      <div className="flex-1 py-2 px-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center justify-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Resolved ✓</span>
                      </div>
                    )}

                    {/* View Details Link */}
                    <button
                      type="button"
                      onClick={() => navigate(`/maintenance/${r.id}`)}
                      className="py-2 px-3 rounded-xl border border-gray-300 hover:bg-gray-50 text-gray-700 text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer"
                      title="View Details & Timeline"
                    >
                      <span>Details</span>
                      <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                    </button>

                    {/* Delete button */}
                    <button
                      type="button"
                      onClick={(e) => handleDeleteRequest(r.id, r.propertyTitle || r.description, e)}
                      className="p-2 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                      title="Delete Ticket"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>

                  </div>
                </div>

              </div>
            );
          })}
        </div>
      ) : (
        /* --- TABLE VIEW --- */
        <DataTable
          data={filteredRequests}
          columns={columns}
          isLoading={isLoading}
          emptyMessage="No maintenance requests found matching your filter."
          onRowClick={(r) => navigate(`/maintenance/${r.id}`)}
        />
      )}
        </>
      )}

      {/* ========================================================== */}
      {/* 6. MODAL: CREATE MAINTENANCE REQUEST                       */}
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

      {/* ========================================================== */}
      {/* 7. MODAL: QUICK STATUS UPDATE (OWNER TRIAGE)              */}
      {/* ========================================================== */}
      {statusModalItem && (
        <Modal
          isOpen={Boolean(statusModalItem)}
          onClose={() => setStatusModalItem(null)}
          title={`Update Status: #${String(statusModalItem.id).slice(0, 8)}`}
        >
          <div className="space-y-4 pt-2 font-sans">
            <div>
              <p className="text-xs text-gray-500">Property:</p>
              <h4 className="text-sm font-black text-gray-900">{statusModalItem.propertyTitle}</h4>
              <p className="text-xs text-gray-600 mt-1 line-clamp-2">{statusModalItem.description}</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                New Status
              </label>
              <select
                value={statusTarget}
                onChange={(e) => setStatusTarget(e.target.value)}
                className="w-full px-3 py-2 text-xs font-semibold bg-gray-50 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900"
              >
                <option value="Reported">Reported (Awaiting Review)</option>
                <option value="Assigned">Assigned (Technician Dispatched)</option>
                <option value="InProgress">InProgress (Repairs Underway)</option>
                <option value="Completed">Completed (Repairs Verified)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                Work Notes / Vendor Details (Optional)
              </label>
              <textarea
                value={statusNotes}
                onChange={(e) => setStatusNotes(e.target.value)}
                placeholder="e.g. Technician Kamal contacted. Scheduled inspection for Friday 10 AM."
                rows={3}
                className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900 resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStatusModalItem(null)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="bg-[#008037] hover:bg-[#006e2e] text-white font-bold"
                onClick={() => handleQuickStatusUpdate(statusModalItem, statusTarget, statusNotes)}
              >
                Save Status Update
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ========================================================== */}
      {/* 8. MODAL: ADD SERVICE PROVIDER TO DATABASE (OWNER FEATURE) */}
      {/* ========================================================== */}
      <Modal
        isOpen={isProviderModalOpen}
        onClose={() => setIsProviderModalOpen(false)}
        title="Add Verified Service Provider"
        className="max-w-lg"
      >
        <form onSubmit={handleCreateProvider} className="space-y-4 pt-1 font-sans">
          <div className="p-3.5 rounded-2xl bg-emerald-50/80 border border-emerald-200 flex items-start gap-2.5 text-xs text-emerald-900 leading-relaxed">
            <Sparkles className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <p>
              Providers added here are persisted directly to the database. When a tenant submits a repair ticket, RentWise <strong>Agent AI</strong> automatically matches the issue category and property location to assign this contractor.
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
              Provider / Company Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={providerForm.name}
              onChange={(e) => setProviderForm(prev => ({ ...prev, name: e.target.value }))}
              placeholder="e.g. Lanka QuickFix Plumbing & Sanitation"
              className="w-full px-3.5 py-2.5 text-xs bg-gray-50 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900 font-medium"
            />
          </div>

          {/* Multi-Category Selection */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                Categories & Trades <span className="text-rose-500">*</span>
              </label>
              <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                {providerForm.categories?.length || 0} trade{(providerForm.categories?.length || 0) === 1 ? '' : 's'} selected
              </span>
            </div>
            <p className="text-[11px] text-gray-500 mb-2.5">
              Select all trades this contractor covers (multi-selection supported). RentWise Agent AI will auto-match them whenever any of these categories are reported.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {AVAILABLE_CATEGORIES.map((cat) => {
                const isSelected = providerForm.categories?.includes(cat.value);
                return (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => toggleProviderCategory(cat.value)}
                    className={`p-2.5 rounded-xl text-xs font-bold border transition-all flex items-center justify-between text-left cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-gray-50 hover:bg-gray-100 text-gray-700 border-gray-200'
                    }`}
                  >
                    <span className="flex items-center gap-1.5 truncate">
                      <span>{cat.icon}</span>
                      <span className="truncate">{cat.label}</span>
                    </span>
                    {isSelected ? (
                      <span className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                        <Check className="w-3 h-3 text-white" />
                      </span>
                    ) : (
                      <span className="w-4 h-4 rounded-full border border-gray-300 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
            {(!providerForm.categories || providerForm.categories.length === 0) && (
              <p className="text-[11px] text-rose-500 font-semibold mt-1.5">
                Please select at least one trade category.
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                Contact Phone <span className="text-rose-500">*</span>
              </label>
              <input
                type="tel"
                required
                value={providerForm.contactNumber}
                onChange={(e) => setProviderForm(prev => ({ ...prev, contactNumber: e.target.value }))}
                placeholder="e.g. +94 77 234 5678"
                className="w-full px-3.5 py-2.5 text-xs bg-gray-50 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900 font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                Service Area / Coverage
              </label>
              <input
                type="text"
                value={providerForm.serviceArea}
                onChange={(e) => setProviderForm(prev => ({ ...prev, serviceArea: e.target.value }))}
                placeholder="e.g. Colombo 07, Battaramulla & Greater Suburbs"
                className="w-full px-3.5 py-2.5 text-xs bg-gray-50 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900 font-medium"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-gray-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsProviderModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSavingProvider}
              className="bg-[#008037] hover:bg-[#006e2e] text-white font-bold px-5"
            >
              {isSavingProvider ? 'Saving to Database...' : 'Save Service Provider'}
            </Button>
          </div>
        </form>
      </Modal>

    </div>
  );
};
