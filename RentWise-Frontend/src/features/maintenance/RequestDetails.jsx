import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useFetch } from '../../hooks/useFetch';
import { useAuth } from '../../hooks/useAuth';
import api from '../../services/api';

import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { ArrowLeft, Clock, Home, MapPin, Wrench, CheckCircle2, AlertCircle, Image as ImageIcon, User, Sliders, Trash2, Phone, Mail, Check, Copy, ExternalLink, ShieldCheck, Sparkles, Building2, Calendar, ChevronRight, Printer, Eye, Zap, AlertTriangle, ShieldAlert, Plus, Send, Bed, Bath, Maximize2, CheckSquare, RefreshCw, FileText, Upload, Camera, X } from 'lucide-react';
import { PROPERTY_PLACEHOLDER_IMAGE, handleImageError } from '../../utils/imagePlaceholder';
import { LANKA_PROPERTIES, formatLankaPrice } from '../../data/lankaProperties';

const money = (val) => `Rs. ${Number(val || 0).toLocaleString()}`;

const CATEGORY_META = {
  Plumbing: { icon: '🚰', label: 'Plumbing', bg: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  Electrical: { icon: '⚡', label: 'Electrical', bg: 'bg-amber-50 text-amber-700 border-amber-200' },
  HVAC: { icon: '❄️', label: 'HVAC & AC', bg: 'bg-sky-50 text-sky-700 border-sky-200' },
  Appliance: { icon: '🔌', label: 'Appliance', bg: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  Structural: { icon: '🔨', label: 'Structural', bg: 'bg-stone-50 text-stone-700 border-stone-200' },
  Pest: { icon: '🐜', label: 'Pest Control', bg: 'bg-rose-50 text-rose-700 border-rose-200' },
  Painting: { icon: '🎨', label: 'Painting', bg: 'bg-purple-50 text-purple-700 border-purple-200' },
  General: { icon: '🛠️', label: 'General Maintenance', bg: 'bg-slate-50 text-slate-700 border-slate-200' }
};

const MAINTENANCE_STATUSES = [
  { value: 'Reported', label: 'Reported', desc: 'Issue reported, awaiting review & dispatch', variant: 'default', color: 'slate' },
  { value: 'Assigned', label: 'Assigned', desc: 'Vendor or technician assigned to inspect', variant: 'warning', color: 'amber' },
  { value: 'InProgress', label: 'In Progress', desc: 'Active repair work underway on-site', variant: 'info', color: 'blue' },
  { value: 'Completed', label: 'Completed', desc: 'Repairs completed, inspected & verified', variant: 'success', color: 'emerald' }
];

const DEFAULT_SERVICE_PROVIDERS = [
  { id: 'sp-1', name: 'Lanka QuickFix Plumbing & Sanitation', category: 'Plumbing', contactNumber: '+94 77 234 5678', serviceArea: 'Colombo & Battaramulla' },
  { id: 'sp-2', name: 'VoltMaster Electrical & Solar Works', category: 'Electrical', contactNumber: '+94 71 876 5432', serviceArea: 'Western Province' },
  { id: 'sp-3', name: 'CoolBreeze Air Conditioning Care', category: 'HVAC', contactNumber: '+94 76 345 6789', serviceArea: 'Colombo & Suburbs' },
  { id: 'sp-4', name: 'MasterPro Carpentry & Structural Services', category: 'Structural', contactNumber: '+94 70 987 6543', serviceArea: 'Colombo & Gampaha' },
  { id: 'sp-5', name: 'SwiftClean Eco Pest Management', category: 'Pest', contactNumber: '+94 72 456 7890', serviceArea: 'Island-wide' }
];

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

export const RequestDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  // State Management
  const [request, setRequest] = useState(null);
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Modals
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState('InProgress');
  const [statusNotes, setStatusNotes] = useState('');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Quick inline note state
  const [inlineNote, setInlineNote] = useState('');
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);

  // Assign Technician Modal
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [serviceProviders, setServiceProviders] = useState(DEFAULT_SERVICE_PROVIDERS);
  const [selectedProviderId, setSelectedProviderId] = useState('');

  // Photo Lightbox Modal
  const [activeImagePreview, setActiveImagePreview] = useState(null);
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);
  const [newPhotoUrl, setNewPhotoUrl] = useState('');

  // Copy notification states
  const [copiedField, setCopiedField] = useState('');

  const copyToClipboard = (text, fieldName) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(''), 2500);
  };

  // Load ticket details and enrich
  const loadTicket = async () => {
    setIsLoading(true);
    setError('');
    try {
      // 1. Fetch ticket and logs in parallel
      const [ticketRes, logsRes, propsRes, agrRes, providersRes] = await Promise.all([
        api.get(`/maintenance-requests/${id}`).catch(() => ({ data: null })),
        api.get(`/maintenance-requests/${id}/logs`).catch(() => ({ data: [] })),
        api.get('/properties').catch(() => ({ data: [] })),
        api.get('/agreements/mine').catch(() => api.get('/agreements').catch(() => ({ data: [] }))),
        api.get('/service-providers').catch(() => ({ data: [] }))
      ]);

      let ticketData = ticketRes.data;

      // Check client-side localStorage fallback if not found from API
      if (!ticketData) {
        try {
          const localMaint = JSON.parse(localStorage.getItem('rentwise_client_maintenance') || '[]');
          const foundLocal = localMaint.find((item) => String(item.id) === String(id));
          if (foundLocal) {
            ticketData = foundLocal;
          }
        } catch (e) {}
      }

      if (!ticketData) {
        setError('Maintenance request not found.');
        setIsLoading(false);
        return;
      }

      // Merge logs
      let logList = Array.isArray(logsRes.data) && logsRes.data.length > 0 ? logsRes.data : (ticketData.statusLogs || []);
      
      // Default initial log if no logs exist
      if (!logList || logList.length === 0) {
        logList = [
          {
            id: 'init-log',
            oldStatus: 'Reported',
            newStatus: ticketData.status || 'Reported',
            notes: 'Maintenance ticket created and registered into the system.',
            createdAt: ticketData.createdAt || new Date().toISOString()
          }
        ];
      }
      setLogs(logList);

      // Populate service providers from Database and local storage
      let provList = Array.isArray(providersRes.data) && providersRes.data.length > 0 ? providersRes.data : [];
      try {
        const stored = JSON.parse(localStorage.getItem('rentwise_client_service_providers') || '[]');
        if (stored.length > 0) {
          const map = new Map();
          provList.forEach(p => { if (p && p.id) map.set(String(p.id), p); });
          stored.forEach(p => { if (p && p.id && !map.has(String(p.id))) map.set(String(p.id), p); });
          provList = Array.from(map.values());
        }
      } catch (e) {}

      if (provList.length > 0) {
        setServiceProviders(provList);
      }

      // Enrich Property
      const allProps = Array.isArray(propsRes.data) ? propsRes.data : [];
      let matchedProp = allProps.find((p) => p && String(p.id) === String(ticketData.propertyId)) || ticketData.property;

      // Fallback matching against LANKA_PROPERTIES
      const titleToMatch = (ticketData.propertyTitle || matchedProp?.title || '').toLowerCase();
      const addrToMatch = (ticketData.propertyAddress || matchedProp?.address || '').toLowerCase();
      const matchedLanka = LANKA_PROPERTIES.find((lp) => 
        (ticketData.propertyId && String(lp.id) === String(ticketData.propertyId)) ||
        (titleToMatch && lp.title.toLowerCase().includes(titleToMatch)) ||
        (addrToMatch && lp.address.toLowerCase().includes(addrToMatch)) ||
        (titleToMatch && titleToMatch.includes(lp.title.toLowerCase()))
      );

      const resolvedPhoto = 
        ticketData.photoUrl || 
        extractPropertyPhoto(matchedProp) || 
        matchedLanka?.photoUrl || 
        PROPERTY_PLACEHOLDER_IMAGE;

      // Enrich Tenant
      const agreementsList = Array.isArray(agrRes.data) ? agrRes.data : [];
      let foundAgr = agreementsList.find((a) => 
        (a.propertyId && String(a.propertyId) === String(ticketData.propertyId)) ||
        (a.tenantId && String(a.tenantId) === String(ticketData.tenantId))
      );

      // Check localStorage agreements fallback
      if (!foundAgr) {
        try {
          const localAgrs = JSON.parse(localStorage.getItem('rentwise_client_agreements') || '[]');
          foundAgr = localAgrs.find((a) => 
            (a.propertyId && String(a.propertyId) === String(ticketData.propertyId)) ||
            (a.tenantId && String(a.tenantId) === String(ticketData.tenantId))
          );
        } catch (e) {}
      }

      const tenantName = 
        ticketData.tenantName || 
        ticketData.tenant?.name || 
        ticketData.tenant?.fullName || 
        foundAgr?.tenantName || 
        (user?.id === ticketData.tenantId ? (user.name || user.fullName) : null) || 
        'Resident Tenant';

      const tenantEmail = 
        ticketData.tenantEmail || 
        ticketData.tenant?.email || 
        foundAgr?.tenantEmail || 
        (user?.id === ticketData.tenantId ? user.email : null) || 
        'tenant@rentwise.lk';

      const tenantPhone = 
        ticketData.tenantPhone || 
        ticketData.tenant?.phoneNumber || 
        foundAgr?.tenantPhone || 
        '077 123 4567';

      // Enrich Owner
      const ownerName = 
        matchedProp?.owner?.name || 
        matchedProp?.owner?.fullName || 
        foundAgr?.ownerName || 
        'RentWise Property Owner';

      const ownerEmail = 
        matchedProp?.owner?.email || 
        foundAgr?.ownerEmail || 
        'owner@rentwise.lk';

      const ownerPhone = 
        matchedProp?.owner?.phoneNumber || 
        foundAgr?.ownerPhone || 
        '011 234 5678';

      // Match Assigned Service Provider
      let assignedProvider = ticketData.assignedServiceProvider;
      if (!assignedProvider && ticketData.assignedServiceProviderId) {
        assignedProvider = provList.find(sp => String(sp.id) === String(ticketData.assignedServiceProviderId)) ||
                           serviceProviders.find(sp => String(sp.id) === String(ticketData.assignedServiceProviderId));
      }
      if (!assignedProvider && (ticketData.assignedProviderName || ticketData.assigned_provider)) {
        const provName = ticketData.assignedProviderName || ticketData.assigned_provider;
        const found = provList.find(sp => sp.name && provName.toLowerCase().includes(sp.name.toLowerCase())) ||
                      serviceProviders.find(sp => sp.name && provName.toLowerCase().includes(sp.name.toLowerCase()));
        assignedProvider = found || {
          id: ticketData.assignedServiceProviderId || 'ai-matched',
          name: provName,
          category: ticketData.aiCategory || ticketData.category || 'General',
          contactNumber: '+94 77 234 5678',
          serviceArea: matchedProp?.address || 'Colombo & Greater Area',
          isAiAssigned: true
        };
      }

      const enrichedTicket = {
        ...ticketData,
        propertyTitle: matchedProp?.title || matchedLanka?.title || ticketData.propertyTitle || `Property #${String(ticketData.propertyId).slice(0, 8)}`,
        propertyAddress: matchedProp?.address || matchedLanka?.address || ticketData.propertyAddress || 'Colombo, Sri Lanka',
        propertyRent: matchedProp?.monthlyRent || matchedLanka?.monthlyRent || 0,
        propertyBeds: matchedProp?.bedrooms || matchedLanka?.bedrooms || null,
        propertyBaths: matchedProp?.bathrooms || matchedLanka?.bathrooms || null,
        propertySqft: matchedProp?.sqft || matchedLanka?.sqft || null,
        propertyType: matchedProp?.propertyType || matchedLanka?.propertyType || 'Residential',
        propertyPhoto: resolvedPhoto,
        tenantName,
        tenantEmail,
        tenantPhone,
        ownerName,
        ownerEmail,
        ownerPhone,
        assignedProvider
      };

      setRequest(enrichedTicket);
    } catch (err) {
      console.error('Failed to load maintenance ticket', err);
      setError('Could not load ticket details.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTicket();
  }, [id]);

  // Open status modal
  const handleOpenStatusModal = (initialStatus) => {
    setSelectedStatus(initialStatus || request?.status || 'InProgress');
    setStatusNotes('');
    setIsStatusModalOpen(true);
  };

  // Update Status
  const handleUpdateStatus = async (statusToSet, notesToSet) => {
    const nextStatus = statusToSet || selectedStatus;
    const nextNotes = notesToSet || statusNotes || `Status updated to ${nextStatus}`;

    try {
      setIsUpdatingStatus(true);
      const oldStatus = request?.status || 'Reported';

      let updatedRecord = null;
      try {
        const res = await api.put(`/maintenance-requests/${id}/status`, {
          status: nextStatus,
          notes: nextNotes.trim()
        });
        updatedRecord = res.data;
      } catch (postErr) {
        console.warn('Backend maintenance status update error, saving locally:', postErr);
      }

      // Update local storage for client resilience
      try {
        const localList = JSON.parse(localStorage.getItem('rentwise_client_maintenance') || '[]');
        const updated = localList.map((item) => {
          if (String(item.id) === String(id)) {
            const currentLogs = item.statusLogs || [];
            return {
              ...item,
              status: nextStatus,
              updatedAt: new Date().toISOString(),
              statusLogs: [
                {
                  id: `log_${Date.now()}`,
                  oldStatus,
                  newStatus: nextStatus,
                  notes: nextNotes,
                  createdAt: new Date().toISOString()
                },
                ...currentLogs
              ]
            };
          }
          return item;
        });
        localStorage.setItem('rentwise_client_maintenance', JSON.stringify(updated));
        window.dispatchEvent(new Event('storage'));
      } catch (e) {}

      // Update local state
      const newLog = {
        id: `log_${Date.now()}`,
        oldStatus,
        newStatus: nextStatus,
        notes: nextNotes,
        createdAt: new Date().toISOString()
      };

      setRequest((prev) => prev ? { ...prev, status: nextStatus, updatedAt: new Date().toISOString() } : null);
      setLogs((prev) => [newLog, ...prev]);

      setIsStatusModalOpen(false);
      setStatusNotes('');
    } catch (err) {
      console.error('Failed to update maintenance status', err);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Add Inline Note / Message to Timeline
  const handleAddInlineNote = async (e) => {
    e?.preventDefault();
    if (!inlineNote.trim()) return;

    try {
      setIsSubmittingNote(true);
      const noteText = inlineNote.trim();

      // If no technician assigned yet, analyze message with Agent AI to auto-assign technician
      if (!request?.assignedProvider) {
        let assignedInfo = null;
        try {
          const res = await api.post('/agentic/workflow/maintenance-triage', {
            objective: noteText,
            property_id: request.propertyId || 'property'
          });
          if (res.data?.ticket && res.data.ticket.assigned_provider && res.data.ticket.assigned_provider !== 'Unassigned') {
            assignedInfo = res.data.ticket;
          }
        } catch (apiErr) {
          console.warn('Agentic AI triage note:', apiErr);
        }

        // Fallback matching if needed
        if (!assignedInfo) {
          const lower = noteText.toLowerCase();
          let cat = 'General';
          if (['pipe', 'water', 'leak', 'plumbing', 'flood', 'faucet', 'sink', 'toilet', 'drain'].some(w => lower.includes(w))) cat = 'Plumbing';
          else if (['power', 'wire', 'electrical', 'spark', 'shock', 'breaker', 'socket'].some(w => lower.includes(w))) cat = 'Electrical';
          else if (['ac', 'heater', 'hvac', 'cooling', 'fan'].some(w => lower.includes(w))) cat = 'HVAC';
          else if (['fridge', 'refrigerator', 'washing', 'machine', 'oven'].some(w => lower.includes(w))) cat = 'Appliance';
          else if (['door', 'lock', 'window', 'roof', 'wall'].some(w => lower.includes(w))) cat = 'Structural';
          else if (['pest', 'rat', 'ant', 'termite'].some(w => lower.includes(w))) cat = 'Pest';

          const matched = serviceProviders.find(p => p.category?.toLowerCase() === cat.toLowerCase()) || serviceProviders[0];
          if (matched) {
            assignedInfo = {
              assigned_provider: `${matched.name} (${matched.contactNumber || ''})`,
              matchedProvider: matched
            };
          }
        }

        if (assignedInfo) {
          const matchedObj = assignedInfo.matchedProvider || serviceProviders.find(p => assignedInfo.assigned_provider.includes(p.name)) || {
            name: assignedInfo.assigned_provider,
            category: assignedInfo.category || 'General',
            contactNumber: '+94 77 234 5678',
            serviceArea: request.propertyAddress || 'Colombo & Suburbs',
            isAiAssigned: true
          };

          const triageNote = `${noteText} — 🤖 Agent AI analyzed message and auto-assigned technician: ${matchedObj.name} (${matchedObj.category})`;
          await handleUpdateStatus('Assigned', triageNote);
          setRequest(prev => prev ? { ...prev, assignedProvider: matchedObj, assignedServiceProviderId: matchedObj.id } : null);
          setInlineNote('');
          return;
        }
      }

      await handleUpdateStatus(request?.status || 'Reported', noteText);
      setInlineNote('');
    } catch (err) {
      console.error('Failed to add note', err);
    } finally {
      setIsSubmittingNote(false);
    }
  };

  // Assign Service Provider
  const handleAssignProvider = async (providerId) => {
    const chosenProvider = serviceProviders.find(p => String(p.id) === String(providerId));
    if (!chosenProvider) return;

    try {
      setIsUpdatingStatus(true);
      const note = `Assigned contractor: ${chosenProvider.name} (${chosenProvider.category}). Contact: ${chosenProvider.contactNumber}.`;
      
      try {
        await api.put(`/maintenance-requests/${id}`, {
          ...request,
          status: 'Assigned',
          assignedServiceProviderId: chosenProvider.id
        });
      } catch (apiErr) {
        console.warn('API PUT failed, advancing with status update:', apiErr);
      }

      await handleUpdateStatus('Assigned', note);
      setRequest(prev => prev ? { ...prev, assignedProvider: chosenProvider, assignedServiceProviderId: chosenProvider.id } : null);
      setIsAssignModalOpen(false);
    } catch (err) {
      console.error('Failed to assign provider', err);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Attach photo URL
  const handleAttachPhoto = () => {
    if (!newPhotoUrl.trim()) return;
    setRequest((prev) => prev ? { ...prev, photoUrl: newPhotoUrl.trim() } : null);

    // Save to local storage
    try {
      const localList = JSON.parse(localStorage.getItem('rentwise_client_maintenance') || '[]');
      const updated = localList.map((item) => {
        if (String(item.id) === String(id)) {
          return { ...item, photoUrl: newPhotoUrl.trim() };
        }
        return item;
      });
      localStorage.setItem('rentwise_client_maintenance', JSON.stringify(updated));
    } catch (e) {}

    setIsPhotoModalOpen(false);
    setNewPhotoUrl('');
  };

  // Delete maintenance request
  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this maintenance request? This action cannot be undone.')) return;
    try {
      setIsDeleting(true);
      await api.delete(`/maintenance-requests/${id}`);

      // Clean up localStorage
      try {
        const localList = JSON.parse(localStorage.getItem('rentwise_client_maintenance') || '[]');
        const updated = localList.filter((item) => String(item.id) !== String(id));
        localStorage.setItem('rentwise_client_maintenance', JSON.stringify(updated));
        window.dispatchEvent(new Event('storage'));
      } catch {}

      navigate('/maintenance');
    } catch (err) {
      console.error('Failed to delete maintenance request', err);
      // Even if API fails, delete from local storage and navigate back
      try {
        const localList = JSON.parse(localStorage.getItem('rentwise_client_maintenance') || '[]');
        const updated = localList.filter((item) => String(item.id) !== String(id));
        localStorage.setItem('rentwise_client_maintenance', JSON.stringify(updated));
      } catch {}
      navigate('/maintenance');
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-500 font-bold text-sm">Loading ticket details & property records...</p>
      </div>
    );
  }

  if (error || !request) {
    return (
      <div className="py-16 max-w-xl mx-auto text-center space-y-4">
        <div className="w-16 h-16 bg-rose-50 border border-rose-200 rounded-3xl flex items-center justify-center mx-auto text-rose-600">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-extrabold text-gray-900">Maintenance Request Not Found</h2>
        <p className="text-gray-500 text-sm">
          {error || 'This ticket may have been removed or you do not have permission to view it.'}
        </p>
        <Button onClick={() => navigate('/maintenance')} className="bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Maintenance
        </Button>
      </div>
    );
  }

  const priority = request.aiPriority || request.priority || 'Medium';
  const status = request.status || 'Reported';
  const category = request.aiCategory || 'General';
  const description = request.description || request.issueDescription || 'No description provided.';
  const catMeta = CATEGORY_META[category] || CATEGORY_META.General;

  // Stepper Stage Calculation
  const stages = [
    { key: 'Reported', label: 'Reported', desc: 'Ticket submitted', icon: FileText },
    { key: 'Assigned', label: 'Assigned', desc: 'Technician dispatched', icon: User },
    { key: 'InProgress', label: 'In Progress', desc: 'Repairs underway', icon: Wrench },
    { key: 'Completed', label: 'Completed', desc: 'Verified & resolved', icon: CheckCircle2 }
  ];

  const statusOrder = ['Reported', 'Assigned', 'InProgress', 'Completed'];
  const currentStageIndex = statusOrder.indexOf(status) !== -1 ? statusOrder.indexOf(status) : 0;

  const isEmergency = priority.toLowerCase() === 'emergency' || priority.toLowerCase() === 'urgent';
  const isHighPriority = priority.toLowerCase() === 'high';

  return (
    <div className="space-y-6 animate-in fade-in duration-400 max-w-6xl mx-auto pb-16 font-sans">
      
      {/* 1. TOP BREADCRUMB & ACTIONS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-gray-500">
          <button 
            onClick={() => navigate('/maintenance')}
            className="flex items-center gap-1.5 text-blue-600 hover:text-blue-700 hover:underline cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Maintenance Center</span>
          </button>
          <span>/</span>
          <span className="text-gray-400">Tickets</span>
          <span>/</span>
          <span className="font-mono text-gray-700 font-bold">#{String(request.id).slice(0, 8)}</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Print Button */}
          <button 
            onClick={() => window.print()}
            className="px-3 py-1.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 text-xs font-bold flex items-center gap-1.5 shadow-2xs cursor-pointer transition-colors"
          >
            <Printer className="w-3.5 h-3.5 text-gray-500" />
            <span>Print Ticket</span>
          </button>

          {/* Delete Ticket Button */}
          {(user?.role === 'Tenant' || request.tenantId === user?.id || user?.role === 'Administrator' || user?.role === 'PropertyOwner') && (
            <button 
              onClick={handleDelete}
              disabled={isDeleting}
              className="px-3 py-1.5 rounded-xl border border-rose-200 bg-rose-50/60 hover:bg-rose-100 text-rose-600 text-xs font-bold flex items-center gap-1.5 shadow-2xs cursor-pointer transition-colors disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{isDeleting ? 'Deleting...' : 'Delete'}</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. EXECUTIVE HERO HEADER */}
      <div className="bg-white rounded-3xl p-6 sm:p-7 border border-gray-200/80 shadow-sm space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="space-y-2">
            {/* Badges Bar */}
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className={`px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 ${catMeta.bg}`}>
                <span>{catMeta.icon}</span>
                <span>{catMeta.label}</span>
              </span>

              {/* Priority Badge */}
              <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-1.5 ${
                isEmergency 
                  ? 'bg-rose-600 text-white shadow-xs animate-pulse ring-2 ring-rose-300' 
                  : isHighPriority 
                    ? 'bg-amber-500 text-white shadow-xs' 
                    : priority.toLowerCase() === 'low'
                      ? 'bg-slate-500 text-white shadow-xs'
                      : 'bg-blue-600 text-white shadow-xs'
              }`}>
                {isEmergency && <ShieldAlert className="w-3.5 h-3.5" />}
                {isHighPriority && <AlertTriangle className="w-3.5 h-3.5" />}
                <span>{priority} Priority</span>
              </span>

              {/* Status Badge */}
              <span className={`px-3.5 py-1 rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-1.5 border ${
                status === 'Completed'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                  : status === 'InProgress'
                    ? 'bg-blue-50 text-blue-800 border-blue-300'
                    : status === 'Assigned'
                      ? 'bg-amber-50 text-amber-800 border-amber-300'
                      : 'bg-slate-100 text-slate-800 border-slate-300'
              }`}>
                <span className={`w-2 h-2 rounded-full ${
                  status === 'Completed' ? 'bg-emerald-500' : status === 'InProgress' ? 'bg-blue-500' : status === 'Assigned' ? 'bg-amber-500' : 'bg-slate-400'
                }`} />
                <span>{status === 'InProgress' ? 'In Progress' : status}</span>
              </span>
            </div>

            {/* Ticket Title */}
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-gray-900">
              Maintenance Ticket Details
            </h1>

            {/* Ticket ID with Click-to-Copy */}
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span>Ticket Reference:</span>
              <button
                onClick={() => copyToClipboard(request.id, 'ticketId')}
                className="font-mono font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 px-2 py-0.5 rounded-md flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Click to copy full Ticket ID"
              >
                <span>{request.id}</span>
                {copiedField === 'ticketId' ? (
                  <Check className="w-3 h-3 text-emerald-600" />
                ) : (
                  <Copy className="w-3 h-3 text-gray-400" />
                )}
              </button>
              {copiedField === 'ticketId' && (
                <span className="text-[11px] text-emerald-600 font-bold animate-in fade-in">Copied!</span>
              )}
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Advance Status Quick Trigger */}
            {status === 'Reported' && (
              <Button 
                onClick={() => setIsAssignModalOpen(true)}
                className="bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl shadow-sm text-xs px-4 py-2.5"
              >
                <User className="w-4 h-4 mr-1.5" />
                Assign Technician
              </Button>
            )}

            {status === 'Assigned' && (
              <Button 
                onClick={() => handleUpdateStatus('InProgress', 'Technician arrived and began repair work.')}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-sm text-xs px-4 py-2.5"
              >
                <Wrench className="w-4 h-4 mr-1.5" />
                Start Work
              </Button>
            )}

            {status === 'InProgress' && (
              <Button 
                onClick={() => handleUpdateStatus('Completed', 'Maintenance work successfully completed and verified.')}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-sm text-xs px-4 py-2.5"
              >
                <CheckCircle2 className="w-4 h-4 mr-1.5" />
                Mark Completed ✓
              </Button>
            )}

            {/* General Status Update Dialog */}
            <Button 
              onClick={() => handleOpenStatusModal(status)} 
              className="bg-gray-900 hover:bg-black text-white font-bold rounded-xl shadow-sm text-xs px-4 py-2.5 cursor-pointer"
            >
              <Sliders className="w-4 h-4 mr-1.5 text-blue-400" />
              Update Status
            </Button>
          </div>
        </div>

        {/* 3. 4-STEP VISUAL RESOLUTION PIPELINE */}
        <div className="pt-5 border-t border-gray-100">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {stages.map((stage, idx) => {
              const StageIcon = stage.icon;
              const isDone = currentStageIndex > idx;
              const isCurrent = currentStageIndex === idx;

              return (
                <div 
                  key={stage.key}
                  className={`p-3.5 rounded-2xl border transition-all ${
                    isCurrent
                      ? 'border-blue-500 bg-blue-50/70 ring-2 ring-blue-500/20 shadow-xs'
                      : isDone
                        ? 'border-emerald-200 bg-emerald-50/50'
                        : 'border-gray-100 bg-gray-50/50 opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      isCurrent
                        ? 'bg-blue-600 text-white'
                        : isDone
                          ? 'bg-emerald-600 text-white'
                          : 'bg-gray-200 text-gray-500'
                    }`}>
                      {isDone ? <Check className="w-3.5 h-3.5" /> : idx + 1}
                    </div>
                    <span className={`text-xs font-extrabold ${isCurrent ? 'text-blue-900' : isDone ? 'text-emerald-900' : 'text-gray-500'}`}>
                      {stage.label}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-500 ml-8 leading-tight">{stage.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 4. MAIN CONTENT GRID (2 COLUMNS) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* LEFT COLUMN: Problem Details, Photo Evidence & Timeline (2 cols) */}
        <div className="lg:col-span-2 space-y-6">

          {/* CARD 1: REPORTED PROBLEM & AI ANALYSIS */}
          <div className="bg-white rounded-3xl p-6 sm:p-7 border border-gray-200/80 shadow-sm space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-extrabold text-gray-900 flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                  <Wrench className="w-4 h-4" />
                </div>
                <span>Reported Problem</span>
              </h2>

              <span className="text-xs text-gray-400 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                <span>Submitted {new Date(request.createdAt).toLocaleString()}</span>
              </span>
            </div>

            {/* Description Box */}
            <div className="p-5 rounded-2xl bg-gradient-to-br from-gray-50 to-slate-50 border border-gray-200 text-gray-800 text-sm leading-relaxed whitespace-pre-wrap font-medium">
              {description}
            </div>

            {/* AI Diagnostics Ribbon */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-indigo-50/80 via-purple-50/70 to-blue-50/80 border border-indigo-100 flex items-start gap-3">
              <div className="w-7 h-7 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs mt-0.5">
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="text-xs text-indigo-950 space-y-0.5">
                <div className="font-extrabold flex items-center gap-2">
                  <span>RentWise AI Triage Analysis</span>
                  <span className="text-[10px] uppercase font-mono px-2 py-0.2 rounded-full bg-indigo-100 text-indigo-700 font-bold">
                    Automated
                  </span>
                </div>
                <p className="text-indigo-800 leading-normal">
                  Issue classified under <strong>{category}</strong> with <strong>{priority} Priority</strong> based on resident report and damage impact analysis.
                </p>
              </div>
            </div>
          </div>

          {/* CARD 2: PHOTO EVIDENCE GALLERY */}
          <div className="bg-white rounded-3xl p-6 sm:p-7 border border-gray-200/80 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-extrabold text-gray-900 flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
                  <ImageIcon className="w-4 h-4" />
                </div>
                <span>Photo Evidence</span>
              </h2>

              <button
                onClick={() => setIsPhotoModalOpen(true)}
                className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 hover:underline cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{request.photoUrl ? 'Change Photo' : 'Attach Photo'}</span>
              </button>
            </div>

            {request.photoUrl ? (
              <div className="space-y-3">
                <div 
                  onClick={() => setActiveImagePreview(request.photoUrl)}
                  className="relative group overflow-hidden rounded-2xl border border-gray-200 cursor-pointer shadow-xs bg-black/5 aspect-[16/9] max-h-80"
                >
                  <img 
                    src={request.photoUrl} 
                    alt="Damage evidence" 
                    onError={handleImageError}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-102"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white gap-2 font-bold text-sm">
                    <Maximize2 className="w-5 h-5" />
                    <span>Click to Zoom Image</span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-gray-500 px-1">
                  <span>Photo provided with initial submission</span>
                  <a 
                    href={request.photoUrl} 
                    target="_blank" 
                    rel="noreferrer" 
                    className="text-blue-600 font-bold hover:underline flex items-center gap-1"
                  >
                    <span>View original HD</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            ) : (
              <div className="p-8 rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50/50 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-gray-100 text-gray-400 flex items-center justify-center mx-auto">
                  <ImageIcon className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-700">No damage photo attached</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Attaching clear photos helps technicians prepare required parts before visiting.
                  </p>
                </div>
                <button
                  onClick={() => setIsPhotoModalOpen(true)}
                  className="px-4 py-2 bg-white border border-gray-200 hover:border-gray-300 text-gray-700 font-bold text-xs rounded-xl shadow-2xs cursor-pointer inline-flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5 text-blue-600" />
                  <span>Attach Photo Evidence</span>
                </button>
              </div>
            )}
          </div>

          {/* CARD 3: ASSIGNED TECHNICIAN / CONTRACTOR */}
          <div className="bg-white rounded-3xl p-6 sm:p-7 border border-gray-200/80 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-extrabold text-gray-900 flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                  <User className="w-4 h-4" />
                </div>
                <span>Assigned Technician & Vendor</span>
              </h2>

              <button
                onClick={() => setIsAssignModalOpen(true)}
                className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 hover:underline cursor-pointer"
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>{request.assignedProvider ? 'Reassign' : 'Assign Contractor'}</span>
              </button>
            </div>

            {request.assignedProvider ? (
              <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-amber-600 text-white font-black text-base flex items-center justify-center shadow-sm">
                    {request.assignedProvider.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-extrabold text-gray-900 text-sm">{request.assignedProvider.name}</h4>
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                        {request.assignedProvider.category}
                      </span>
                      {(request.assignedProvider.isAiAssigned || request.assignedProviderName || request.assigned_provider) && (
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 flex items-center gap-1 border border-emerald-200">
                          <Sparkles className="w-3 h-3 text-emerald-600" />
                          <span>AI Matched</span>
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Service Area: {request.assignedProvider.serviceArea}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <a
                    href={`tel:${request.assignedProvider.contactNumber}`}
                    className="px-3.5 py-1.5 rounded-xl bg-white border border-amber-300 hover:bg-amber-100/70 text-amber-900 text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-colors"
                  >
                    <Phone className="w-3.5 h-3.5 text-amber-600" />
                    <span>{request.assignedProvider.contactNumber}</span>
                  </a>
                </div>
              </div>
            ) : (
              <div className="p-5 rounded-2xl bg-gray-50 border border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-gray-500">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-gray-400 shrink-0" />
                  <span>No service provider or technician assigned to this ticket yet.</span>
                </div>
                <button
                  onClick={() => setIsAssignModalOpen(true)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer self-start sm:self-auto"
                >
                  + Assign Verified Technician
                </button>
              </div>
            )}
          </div>

          {/* CARD 4: ACTIVITY & STATUS HISTORY TIMELINE (REPLACES UGLY TABLE) */}
          <div className="bg-white rounded-3xl p-6 sm:p-7 border border-gray-200/80 shadow-sm space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-extrabold text-gray-900 flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                    <Clock className="w-4 h-4" />
                  </div>
                  <span>Activity & Status History</span>
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  Complete audit log of ticket transitions, inspection comments, and notes.
                </p>
              </div>

              <span className="text-xs font-bold text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">
                {logs.length} Updates
              </span>
            </div>

            {/* Vertical Activity Feed */}
            <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-200">
              {logs.map((log, idx) => {
                const isLatest = idx === 0;
                return (
                  <div key={log.id || idx} className="relative space-y-2">
                    {/* Circle Node */}
                    <div className={`absolute -left-6 top-1 w-5 h-5 rounded-full border-2 flex items-center justify-center bg-white ${
                      isLatest ? 'border-blue-600 ring-4 ring-blue-100' : 'border-gray-300'
                    }`}>
                      <div className={`w-2 h-2 rounded-full ${isLatest ? 'bg-blue-600' : 'bg-gray-400'}`} />
                    </div>

                    {/* Header */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {log.oldStatus ? (
                          <div className="flex items-center gap-1.5 text-xs font-bold">
                            <span className="px-2 py-0.5 rounded-md bg-gray-100 text-gray-600">
                              {log.oldStatus}
                            </span>
                            <span className="text-gray-400 font-black">➔</span>
                            <span className={`px-2 py-0.5 rounded-md ${
                              log.newStatus === 'Completed'
                                ? 'bg-emerald-100 text-emerald-800'
                                : log.newStatus === 'InProgress'
                                  ? 'bg-blue-100 text-blue-800'
                                  : log.newStatus === 'Assigned'
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-gray-100 text-gray-800'
                            }`}>
                              {log.newStatus}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs font-extrabold text-gray-800">
                            Status Update
                          </span>
                        )}

                        {isLatest && (
                          <span className="text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-600 px-2 py-0.2 rounded-full border border-blue-100">
                            Latest
                          </span>
                        )}
                      </div>

                      <span className="text-[11px] text-gray-400 font-medium">
                        {new Date(log.createdAt || log.updatedAt).toLocaleString()}
                      </span>
                    </div>

                    {/* Note Box */}
                    <div className="p-3.5 rounded-2xl bg-gray-50 border border-gray-100 text-xs text-gray-700 leading-relaxed font-medium">
                      {log.notes || 'Status updated.'}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Quick Inline Note Submission Form */}
            <form onSubmit={handleAddInlineNote} className="pt-4 border-t border-gray-100 space-y-2.5">
              <label className="text-xs font-bold uppercase tracking-wider text-gray-600 block">
                Add an Activity Note / Status Comment
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={inlineNote}
                  onChange={(e) => setInlineNote(e.target.value)}
                  placeholder="e.g. Parts arrived from supplier; technician scheduled for 3 PM tomorrow..."
                  className="flex-1 rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-xs text-gray-900 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 shadow-2xs"
                />
                <Button
                  type="submit"
                  disabled={!inlineNote.trim() || isSubmittingNote}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs px-4"
                >
                  <Send className="w-3.5 h-3.5 mr-1" />
                  Post Note
                </Button>
              </div>
            </form>
          </div>
        </div>

        {/* RIGHT COLUMN: Property Showcase, Resident & Landlord Cards (1 col) */}
        <div className="space-y-6">

          {/* CARD 1: PROPERTY SHOWCASE CARD */}
          <div className="bg-white rounded-3xl overflow-hidden border border-gray-200/80 shadow-sm">
            {/* Image Banner */}
            <div className="relative aspect-[16/10] w-full bg-slate-900 overflow-hidden">
              <img
                src={request.propertyPhoto}
                alt={request.propertyTitle}
                onError={handleImageError}
                className="w-full h-full object-cover opacity-90 hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
              
              <div className="absolute top-3 left-3">
                <span className="px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md text-white text-[11px] font-bold border border-white/20 flex items-center gap-1">
                  <Home className="w-3 h-3 text-emerald-400" />
                  <span>{request.propertyType || 'House'}</span>
                </span>
              </div>

              <div className="absolute bottom-3 left-3 right-3 text-white">
                <span className="text-[10px] uppercase font-bold text-emerald-300 block tracking-wider">
                  Monthly Rent
                </span>
                <span className="text-xl font-black">
                  {request.propertyRent ? money(request.propertyRent) : 'Rent on Agreement'}
                </span>
              </div>
            </div>

            {/* Property Body */}
            <div className="p-5 space-y-4">
              <div>
                <h3 className="font-extrabold text-gray-900 text-base leading-snug hover:text-blue-600 transition-colors">
                  {request.propertyTitle}
                </h3>
                <p className="text-xs text-gray-500 flex items-start gap-1.5 mt-1.5">
                  <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5" />
                  <span>{request.propertyAddress}</span>
                </p>
              </div>

              {/* Specs Row */}
              <div className="grid grid-cols-3 gap-2 py-2.5 border-y border-gray-100 text-center">
                <div className="space-y-0.5">
                  <span className="text-[10px] text-gray-400 uppercase font-bold block">Bedrooms</span>
                  <span className="font-bold text-xs text-gray-800 flex items-center justify-center gap-1">
                    <Bed className="w-3.5 h-3.5 text-blue-600" />
                    {request.propertyBeds || '4'}
                  </span>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[10px] text-gray-400 uppercase font-bold block">Bathrooms</span>
                  <span className="font-bold text-xs text-gray-800 flex items-center justify-center gap-1">
                    <Bath className="w-3.5 h-3.5 text-blue-600" />
                    {request.propertyBaths || '4'}
                  </span>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[10px] text-gray-400 uppercase font-bold block">Area</span>
                  <span className="font-bold text-xs text-gray-800 flex items-center justify-center gap-1">
                    <Building2 className="w-3.5 h-3.5 text-blue-600" />
                    {request.propertySqft ? `${request.propertySqft} sqft` : 'Spacious'}
                  </span>
                </div>
              </div>

              {/* Property ID with Copy */}
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-bold tracking-wider text-gray-400 block">
                  Property ID
                </span>
                <div className="flex items-center justify-between p-2 rounded-xl bg-gray-50 border border-gray-100 text-xs">
                  <span className="font-mono text-gray-700 font-bold truncate pr-2">
                    {request.propertyId}
                  </span>
                  <button
                    onClick={() => copyToClipboard(request.propertyId, 'propId')}
                    className="text-gray-400 hover:text-blue-600 cursor-pointer shrink-0"
                    title="Copy Property ID"
                  >
                    {copiedField === 'propId' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* View Property Link */}
              <Link 
                to={`/properties`}
                className="w-full py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors"
              >
                <span>Browse Rental Listings</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          {/* CARD 2: TENANT & RESIDENT DETAILS */}
          <div className="bg-white rounded-3xl p-5 border border-gray-200/80 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-gray-900 flex items-center gap-2">
                <User className="w-4 h-4 text-blue-600" />
                <span>Tenant & Resident</span>
              </h3>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                Verified Resident
              </span>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white font-black text-base flex items-center justify-center shadow-sm">
                {request.tenantName.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <h4 className="font-extrabold text-gray-900 text-sm">{request.tenantName}</h4>
                <p className="text-xs text-gray-400 font-mono mt-0.5 truncate max-w-[190px]">
                  ID: {String(request.tenantId).slice(0, 14)}...
                </p>
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-gray-100 text-xs">
              <div className="flex items-center justify-between p-2 rounded-xl bg-gray-50">
                <span className="text-gray-500 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-gray-400" />
                  <span>Phone:</span>
                </span>
                <a href={`tel:${request.tenantPhone}`} className="font-bold text-gray-800 hover:text-blue-600">
                  {request.tenantPhone}
                </a>
              </div>

              <div className="flex items-center justify-between p-2 rounded-xl bg-gray-50">
                <span className="text-gray-500 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-gray-400" />
                  <span>Email:</span>
                </span>
                <a href={`mailto:${request.tenantEmail}`} className="font-bold text-gray-800 hover:text-blue-600 truncate max-w-[150px]">
                  {request.tenantEmail}
                </a>
              </div>
            </div>

            {/* Quick Contact Action */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <a
                href={`tel:${request.tenantPhone}`}
                className="py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
              >
                <Phone className="w-3.5 h-3.5" />
                <span>Call Tenant</span>
              </a>
              <a
                href={`mailto:${request.tenantEmail}`}
                className="py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
              >
                <Mail className="w-3.5 h-3.5" />
                <span>Send Email</span>
              </a>
            </div>
          </div>

          {/* CARD 3: LANDLORD & PROPERTY OWNER */}
          <div className="bg-white rounded-3xl p-5 border border-gray-200/80 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-gray-900 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Property Owner / Host</span>
              </h3>
              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
                Landlord
              </span>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-slate-800 text-white font-bold text-xs flex items-center justify-center">
                {request.ownerName.slice(0, 2).toUpperCase()}
              </div>
              <div className="text-xs">
                <h5 className="font-extrabold text-gray-900">{request.ownerName}</h5>
                <p className="text-gray-400">{request.ownerEmail}</p>
              </div>
            </div>
          </div>

          {/* CARD 4: 24/7 EMERGENCY HELPLINE */}
          <div className="p-5 rounded-3xl bg-gradient-to-br from-slate-900 via-zinc-900 to-black text-white space-y-3 shadow-md">
            <div className="flex items-center gap-2 text-rose-400 font-extrabold text-xs tracking-wider uppercase">
              <ShieldAlert className="w-4 h-4" />
              <span>Urgent Support Helpline</span>
            </div>
            <p className="text-xs text-gray-300 leading-relaxed">
              For major water leaks, gas hazards, or structural emergencies, contact RentWise dispatch immediately.
            </p>
            <div className="p-3 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 flex items-center justify-between">
              <span className="text-xs font-bold text-gray-200">24/7 Dispatch Hotline</span>
              <a href="tel:+94112345678" className="font-mono font-black text-emerald-400 text-xs hover:underline">
                +94 11 234 5678
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================== */}
      {/* MODAL 1: UPDATE MAINTENANCE STATUS                         */}
      {/* ========================================================== */}
      <Modal 
        isOpen={isStatusModalOpen} 
        onClose={() => setIsStatusModalOpen(false)} 
        title="Update Maintenance Status"
        className="max-w-md"
      >
        <form onSubmit={(e) => { e.preventDefault(); handleUpdateStatus(selectedStatus, statusNotes); }} className="space-y-5">
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-gray-600 block">
              Select New Status
            </label>
            <div className="grid grid-cols-1 gap-2.5">
              {MAINTENANCE_STATUSES.map((item) => {
                const isSelected = selectedStatus === item.value;
                return (
                  <div
                    key={item.value}
                    onClick={() => setSelectedStatus(item.value)}
                    className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-center justify-between ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50/70 ring-2 ring-blue-500/30 shadow-xs'
                        : 'border-gray-200 bg-white hover:bg-gray-50'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge variant={item.variant} className="text-xs font-bold">
                          {item.label}
                        </Badge>
                        {isSelected && (
                          <span className="text-[11px] font-bold text-blue-600">Selected</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">{item.desc}</p>
                    </div>

                    <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                      isSelected ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-300'
                    }`}>
                      {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-gray-600 block">
              Transition Notes / Inspection Comments
            </label>
            <textarea
              rows={3}
              value={statusNotes}
              onChange={(e) => setStatusNotes(e.target.value)}
              placeholder="e.g. Technician dispatched to site; plumbing parts ordered from supplier..."
              className="w-full rounded-2xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 shadow-2xs"
            />
          </div>

          <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-2.5">
            <Button type="button" variant="outline" onClick={() => setIsStatusModalOpen(false)}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              isLoading={isUpdatingStatus}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 rounded-xl shadow-xs"
            >
              <CheckCircle2 className="w-4 h-4 mr-1.5" />
              Save Status Transition
            </Button>
          </div>
        </form>
      </Modal>

      {/* ========================================================== */}
      {/* MODAL 2: ASSIGN TECHNICIAN / SERVICE PROVIDER              */}
      {/* ========================================================== */}
      <Modal
        isOpen={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
        title="Assign Verified Service Provider"
        className="max-w-lg"
      >
        <div className="space-y-4">
          <p className="text-xs text-gray-500">
            Select a certified technician or maintenance contractor for <strong>{category}</strong> repairs.
          </p>

          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {serviceProviders.map((sp) => {
              const isSelected = selectedProviderId === sp.id || request?.assignedServiceProviderId === sp.id;
              return (
                <div
                  key={sp.id}
                  onClick={() => setSelectedProviderId(sp.id)}
                  className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-center justify-between ${
                    isSelected
                      ? 'border-amber-500 bg-amber-50/70 ring-2 ring-amber-500/20 shadow-xs'
                      : 'border-gray-200 bg-white hover:bg-gray-50'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-sm text-gray-900">{sp.name}</span>
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                        {sp.category}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">Area: {sp.serviceArea}</p>
                    <p className="text-xs font-mono text-gray-700 font-bold">{sp.contactNumber}</p>
                  </div>

                  <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                    isSelected ? 'border-amber-600 bg-amber-600 text-white' : 'border-gray-300'
                  }`}>
                    {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-2.5">
            <Button type="button" variant="outline" onClick={() => setIsAssignModalOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!selectedProviderId}
              onClick={() => handleAssignProvider(selectedProviderId)}
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-5 rounded-xl shadow-xs"
            >
              <User className="w-4 h-4 mr-1.5" />
              Confirm Assignment
            </Button>
          </div>
        </div>
      </Modal>

      {/* ========================================================== */}
      {/* MODAL 3: ATTACH PHOTO EVIDENCE                             */}
      {/* ========================================================== */}
      <Modal
        isOpen={isPhotoModalOpen}
        onClose={() => setIsPhotoModalOpen(false)}
        title="Attach Photo Evidence"
        className="max-w-md"
      >
        <div className="space-y-4">
          <p className="text-xs text-gray-500">
            Upload a photo from your device or paste an image link to attach proof to this maintenance ticket.
          </p>

          <div className="space-y-2">
            {newPhotoUrl ? (
              <div className="relative rounded-2xl overflow-hidden border border-gray-200 aspect-[16/9] max-h-48 bg-black/5">
                <img src={newPhotoUrl} alt="Preview" onError={handleImageError} className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => setNewPhotoUrl('')}
                  className="absolute top-2 right-2 p-1.5 rounded-xl bg-rose-600 text-white hover:bg-rose-700 shadow-sm cursor-pointer"
                  title="Remove Photo"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <label className="border-2 border-dashed border-gray-300 hover:border-blue-500 hover:bg-blue-50/30 rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer transition-all group">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white flex items-center justify-center transition-all mb-2">
                  <Upload className="w-5 h-5" />
                </div>
                <p className="text-xs font-bold text-gray-800">
                  Click to upload photo or take picture
                </p>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  Supports PNG, JPG, JPEG, WEBP from device
                </p>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onloadend = () => setNewPhotoUrl(reader.result);
                      reader.readAsDataURL(file);
                    }
                  }}
                />
              </label>
            )}
          </div>

          <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-2.5">
            <Button type="button" variant="outline" onClick={() => setIsPhotoModalOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!newPhotoUrl.trim()}
              onClick={handleAttachPhoto}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 rounded-xl shadow-xs"
            >
              <ImageIcon className="w-4 h-4 mr-1.5" />
              Save Photo
            </Button>
          </div>
        </div>
      </Modal>

      {/* ========================================================== */}
      {/* MODAL 4: LIGHTBOX IMAGE PREVIEW                            */}
      {/* ========================================================== */}
      {activeImagePreview && (
        <div 
          onClick={() => setActiveImagePreview(null)}
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in"
        >
          <div className="relative max-w-4xl w-full max-h-[90vh] flex flex-col items-center">
            <button
              onClick={() => setActiveImagePreview(null)}
              className="absolute -top-10 right-0 text-white hover:text-gray-300 font-bold text-sm bg-white/20 px-3 py-1 rounded-full cursor-pointer"
            >
              ✕ Close
            </button>
            <img
              src={activeImagePreview}
              alt="Full Preview"
              onError={handleImageError}
              className="max-h-[85vh] max-w-full rounded-2xl object-contain shadow-2xl border border-white/20"
            />
          </div>
        </div>
      )}

    </div>
  );
};
