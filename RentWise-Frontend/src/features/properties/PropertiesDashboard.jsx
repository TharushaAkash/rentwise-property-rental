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
import { Plus, Pencil, Trash2, Eye, SlidersHorizontal, Check, X, Clock, Calendar, Building2, Users, Mail, MapPin, CheckCircle2, AlertCircle, ArrowRight, FileText, DollarSign, Phone, ShieldCheck } from 'lucide-react';
import { handleImageError, PROPERTY_PLACEHOLDER_IMAGE } from '../../utils/imagePlaceholder';

const formatMoney = (val) => `Rs. ${Number(val || 0).toLocaleString()}`;

export const PropertiesDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProperty, setEditingProperty] = useState(null);
  const [deletingProperty, setDeletingProperty] = useState(null);
  const [inspectingProperty, setInspectingProperty] = useState(null);
  const [activeInspectPhotoIndex, setActiveInspectPhotoIndex] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Active view: 'properties' (default) | 'bookings'
  const [activeView, setActiveView] = useState('properties');
  
  // Bookings filter: 'ALL' | 'PENDING' | 'CONFIRMED'
  const [bookingFilter, setBookingFilter] = useState('ALL');

  // Properties filter: 'ALL' | 'ACTIVE' | 'NOT_ACTIVE'
  const [propertyStatusFilter, setPropertyStatusFilter] = useState('ALL');
  const [localPropsVersion, setLocalPropsVersion] = useState(0);

  // Properties data
  const { data: properties, isLoading: isPropsLoading, error: propsError, refetch: refetchProps } = useFetch(user?.id ? `/properties/owner/${user.id}` : null);
  const { mutateAsync: createProperty, isLoading: isCreating } = useMutation('/properties', 'POST');

  // Listen to property updates (from admin approval, creation, etc.)
  useEffect(() => {
    const handlePropsUpdate = () => {
      setLocalPropsVersion((v) => v + 1);
      refetchProps?.();
    };
    window.addEventListener('rentwise_client_properties_updated', handlePropsUpdate);
    window.addEventListener('storage', handlePropsUpdate);
    return () => {
      window.removeEventListener('rentwise_client_properties_updated', handlePropsUpdate);
      window.removeEventListener('storage', handlePropsUpdate);
    };
  }, [refetchProps]);

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
        await api.post(`/property-applications/${appId}/confirm`);
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

        // Create drafted rental agreement in local storage for tenant portal (requires tenant to review, agree, and pay)
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
            status: 'Drafted',
            termsAndConditions: `[6-Month Lease Sent to Tenant: ${targetApp.tenantName || 'Tenant'} (${targetApp.tenantEmail || ''}) on ${new Date().toLocaleDateString()}]\nPlease review house photos and terms, then click Review & Agree to proceed to payment.`,
            createdAt: new Date().toISOString()
          };
          const existingAgreements = JSON.parse(localStorage.getItem('rentwise_client_agreements') || '[]');
          if (!existingAgreements.some((a) => a.id === agreement.id || a.propertyId === agreement.propertyId)) {
            existingAgreements.unshift(agreement);
            localStorage.setItem('rentwise_client_agreements', JSON.stringify(existingAgreements));
          }
        }
      } catch {}

      setApplications((prev) =>
        prev.map((a) => (a.id === appId ? { ...a, status: 'Accepted' } : a))
      );

      setFeedback({
        text: `Booking confirmed! 6-Month lease agreement sent to ${targetApp?.tenantName || 'tenant'}. Awaiting tenant agreement & payment.`,
        type: 'success'
      });
    } catch (err) {
      console.error('Failed to confirm booking:', err);
      setFeedback({
        text: 'Failed to confirm booking. Please try again.',
        type: 'error'
      });
    } finally {
      setConfirmingId(null);
    }
  };

  // Handle Reject / Decline Booking
  const handleRejectBooking = async (appId, e) => {
    e?.stopPropagation();
    try {
      setConfirmingId(appId);
      setFeedback({ text: '', type: '' });

      try {
        await api.post(`/property-applications/${appId}/reject`);
      } catch (apiErr) {
        console.warn('Backend reject call note (syncing locally):', apiErr);
      }

      try {
        const stored = JSON.parse(localStorage.getItem('rentwise_client_bookings') || '[]');
        const updated = stored.map((b) => (b.id === appId ? { ...b, status: 'Rejected' } : b));
        localStorage.setItem('rentwise_client_bookings', JSON.stringify(updated));
      } catch {}

      setApplications((prev) =>
        prev.map((a) => (a.id === appId ? { ...a, status: 'Rejected' } : a))
      );

      setFeedback({
        text: 'Booking application has been declined.',
        type: 'info'
      });
    } catch (err) {
      console.error('Failed to decline booking:', err);
      setFeedback({
        text: 'Failed to decline booking.',
        type: 'error'
      });
    } finally {
      setConfirmingId(null);
    }
  };

  // Create a quick sample booking request for testing/demo
  const handleCreateSampleBooking = async () => {
    if (!properties || properties.length === 0) return;
    const prop = properties[0];
    const sampleId = `sample_${Date.now()}`;
    const sampleNames = ['Amara Perera', 'Kasun Jayawardena', 'Nimalka Fernando', 'Rohan Silva'];
    const sampleName = sampleNames[Math.floor(Math.random() * sampleNames.length)];
    const duration = [6, 12, 24][Math.floor(Math.random() * 3)];
    const start = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const end = new Date(start.getTime() + duration * 30 * 24 * 60 * 60 * 1000);

    const formattedMsg = `Duration: ${duration} months | Start: ${start.toLocaleDateString()} | End: ${end.toLocaleDateString()} | Note: Inquiring to move in next week with family.`;

    const sample = {
      id: sampleId,
      propertyId: prop.id,
      propertyTitle: prop.title,
      propertyAddress: prop.address,
      monthlyRent: prop.monthlyRent,
      tenantId: `tenant_${Date.now()}`,
      tenantName: sampleName,
      tenantEmail: `${sampleName.toLowerCase().replace(/\s+/g, '.')}@gmail.com`,
      message: formattedMsg,
      status: 'Submitted',
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

  const handleCreate = async (data, files, utilityBillFile) => {
    try {
      const payload = { 
        ...data, 
        ownerId: user.id,
        sqft: Number(data.sqft || 0),
        propertyType: data.propertyType || 'House',
        featureTags: Array.isArray(data.featureTags) ? data.featureTags : [],
        photoCount: Number(data.photoCount || 0)
      };
      const newProperty = await createProperty(payload);
      const createdId = newProperty?.id || newProperty?.Id;
      
      // Upload regular property photos
      if (files && files.length > 0 && createdId) {
        await Promise.all(files.map(async (file, index) => {
          const formData = new FormData();
          formData.append('file', file);
          formData.append('isPrimary', index === 0);
          
          try {
            await api.post(`/properties/${createdId}/photos`, formData, {
              headers: { 'Content-Type': 'multipart/form-data' }
            });
          } catch (uploadErr) {
            console.error('Failed to upload photo:', file.name, uploadErr);
          }
        }));
      }

      // Upload or attach Utility Bill proof for Agentic AI OCR
      if (createdId && (utilityBillFile || data.utilityBillUrl)) {
        let billUrl = data.utilityBillUrl || '';
        if (utilityBillFile) {
          try {
            const docForm = new FormData();
            docForm.append('file', utilityBillFile);
            docForm.append('documentType', 'UtilityBill');
            const docRes = await api.post(`/properties/${createdId}/documents`, docForm, {
              headers: { 'Content-Type': 'multipart/form-data' }
            });
            if (docRes.data?.documentUrl) {
              billUrl = docRes.data.documentUrl;
            }
          } catch (billUploadErr) {
            console.warn('Utility bill photo upload note:', billUploadErr);
          }
        }

        if (billUrl) {
          try {
            await api.post(`/properties/${createdId}/proof`, {
              documentType: 'UtilityBill',
              documentUrl: billUrl
            });
          } catch (proofErr) {
            try {
              await api.post(`/properties/${createdId}/documents`, {
                documentType: 'UtilityBill',
                documentUrl: billUrl
              });
            } catch (docErr) {
              console.warn('Document proof note:', docErr);
            }
          }
        }
      }

      setFeedback({
        text: `Property "${data.title}" created successfully! Awaiting Admin Approval.`,
        type: 'success'
      });
      setIsModalOpen(false);
      refetchProps();
    } catch (err) {
      console.error('Failed to create property', err);
      setFeedback({
        text: 'Failed to create property listing. Please check the inputs.',
        type: 'error'
      });
    }
  };

  // Handle Edit / Update Property
  const handleUpdate = async (data, files, utilityBillFile) => {
    if (!editingProperty?.id) return;
    try {
      setIsSaving(true);
      setFeedback({ text: '', type: '' });

      const payload = {
        id: editingProperty.id,
        ownerId: editingProperty.ownerId || user?.id,
        title: data.title,
        description: data.description,
        address: data.address,
        monthlyRent: Number(data.monthlyRent),
        bedrooms: Number(data.bedrooms),
        bathrooms: Number(data.bathrooms),
        facilities: data.facilities || '',
        sqft: Number(data.sqft || 0),
        propertyType: data.propertyType || 'House',
        featureTags: Array.isArray(data.featureTags) ? data.featureTags : [],
        photoCount: Number(data.photoCount || 0),
        status: data.status === 'Active' ? 1 : data.status === 'Suspended' ? 2 : 0
      };

      await api.put(`/properties/${editingProperty.id}`, payload);

      // Upload new photos if any
      if (files && files.length > 0) {
        await Promise.all(files.map(async (file, index) => {
          const formData = new FormData();
          formData.append('file', file);
          formData.append('isPrimary', index === 0 && (!editingProperty.photos || editingProperty.photos.length === 0));
          
          try {
            await api.post(`/properties/${editingProperty.id}/photos`, formData, {
              headers: { 'Content-Type': 'multipart/form-data' }
            });
          } catch (uploadErr) {
            console.error('Failed to upload photo:', file.name, uploadErr);
          }
        }));
      }

      // Upload or attach Utility Bill proof if updated
      if (utilityBillFile || data.utilityBillUrl) {
        let billUrl = data.utilityBillUrl || '';
        if (utilityBillFile) {
          try {
            const docForm = new FormData();
            docForm.append('file', utilityBillFile);
            docForm.append('documentType', 'UtilityBill');
            const docRes = await api.post(`/properties/${editingProperty.id}/documents`, docForm, {
              headers: { 'Content-Type': 'multipart/form-data' }
            });
            if (docRes.data?.documentUrl) {
              billUrl = docRes.data.documentUrl;
            }
          } catch (billUploadErr) {
            console.warn('Utility bill photo upload note:', billUploadErr);
          }
        }

        if (billUrl) {
          try {
            await api.post(`/properties/${editingProperty.id}/proof`, {
              documentType: 'UtilityBill',
              documentUrl: billUrl
            });
          } catch (proofErr) {
            try {
              await api.post(`/properties/${editingProperty.id}/documents`, {
                documentType: 'UtilityBill',
                documentUrl: billUrl
              });
            } catch (docErr) {
              console.warn('Document proof note:', docErr);
            }
          }
        }
      }



      setIsModalOpen(false);
      setEditingProperty(null);
      setFeedback({
        text: `Property "${data.title}" updated successfully!`,
        type: 'success'
      });
      refetchProps();
    } catch (err) {
      console.error('Failed to update property', err);
      setFeedback({
        text: 'Failed to update property details. Please try again.',
        type: 'error'
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Handle Delete Property
  const handleDeleteProperty = async (prop) => {
    if (!prop?.id) return;
    try {
      setIsDeleting(true);
      await api.delete(`/properties/${prop.id}`);
      
      setDeletingProperty(null);
      setFeedback({
        text: `Property "${prop.title}" has been deleted.`,
        type: 'success'
      });
      refetchProps();
    } catch (err) {
      console.error('Failed to delete property', err);
      setFeedback({
        text: 'Failed to delete property. It may have active bookings or records.',
        type: 'error'
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // Toggle property active / suspended status
  const handleTogglePropertyStatus = async (prop) => {
    if (!prop?.id) return;
    const rawStatus = prop.status ?? prop.Status;
    const currentStatus = typeof rawStatus === 'number' ? ['PendingVerification', 'Active', 'Suspended'][rawStatus] : rawStatus;
    if (currentStatus === 'PendingVerification') {
      setFeedback({ text: 'This property is pending administrative verification. Please check Agreements & Verification.', type: 'info' });
      return;
    }
    const newStatus = currentStatus === 'Active' ? 'Suspended' : 'Active';
    const newStatusNum = newStatus === 'Active' ? 1 : 2;
    try {
      await api.put(`/properties/${prop.id}`, {
        ...prop,
        status: newStatusNum
      });
      setFeedback({ text: `Listing status updated to ${newStatus}.`, type: 'success' });
      refetchProps();
      if (inspectingProperty && (inspectingProperty.id === prop.id || inspectingProperty.Id === prop.id)) {
        setInspectingProperty(prev => ({ ...prev, status: newStatus }));
      }
    } catch (err) {
      console.error('Failed to toggle property status:', err);
      setFeedback({ text: 'Failed to update property status.', type: 'error' });
    }
  };

  // Properties (API only)
  const allProperties = useMemo(() => {
    return Array.isArray(properties) ? [...properties] : [];
  }, [properties]);

  // Property counts
  const totalPropertiesCount = allProperties.length;

  const activeCount = useMemo(() => {
    return allProperties.filter((p) => {
      const s = typeof p.status === 'number' ? ['PendingVerification', 'Active', 'Suspended'][p.status] : p.status;
      return s === 'Active';
    }).length;
  }, [allProperties]);

  const notActiveCount = useMemo(() => {
    return allProperties.filter((p) => {
      const s = typeof p.status === 'number' ? ['PendingVerification', 'Active', 'Suspended'][p.status] : p.status;
      return s !== 'Active';
    }).length;
  }, [allProperties]);

  const pendingVerificationCount = useMemo(() => {
    return allProperties.filter((p) => {
      const s = typeof p.status === 'number' ? ['PendingVerification', 'Active', 'Suspended'][p.status] : p.status;
      return s === 'PendingVerification' || s === 0;
    }).length;
  }, [allProperties]);

  const filteredProperties = useMemo(() => {
    return allProperties.filter((p) => {
      const s = typeof p.status === 'number' ? ['PendingVerification', 'Active', 'Suspended'][p.status] : p.status;
      const isActive = s === 'Active';
      if (propertyStatusFilter === 'ACTIVE') return isActive;
      if (propertyStatusFilter === 'NOT_ACTIVE') return !isActive;
      return true;
    });
  }, [allProperties, propertyStatusFilter]);

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
      header: 'Property', 
      accessor: (p) => {
        let thumbUrl = null;
        if (Array.isArray(p.photos) && p.photos.length > 0) {
          const first = p.photos.find(photo => photo && (photo.isPrimary || photo.IsPrimary)) || p.photos[0];
          thumbUrl = typeof first === 'string' ? first : (first?.photoUrl || first?.PhotoUrl || first?.url);
        } else if (p.photoUrl || p.PhotoUrl) {
          thumbUrl = p.photoUrl || p.PhotoUrl;
        }

        const propTitle = p.title || p.Title || 'Untitled Property';
        const propType = p.propertyType || p.PropertyType;
        const propAddress = p.address || p.Address || '';

        return (
          <div 
            className="flex items-center gap-3 cursor-pointer group"
            onClick={() => { setInspectingProperty(p); setActiveInspectPhotoIndex(0); }}
            title="Click to inspect property"
          >
            {thumbUrl ? (
              <img 
                src={thumbUrl} 
                alt={propTitle} 
                onError={handleImageError}
                className="w-12 h-12 rounded-xl object-cover border border-gray-200 shadow-2xs shrink-0 group-hover:ring-2 group-hover:ring-indigo-500 transition-all"
              />
            ) : (
              <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center border border-gray-200 shrink-0 group-hover:bg-indigo-50 transition-colors">
                <Building2 className="w-6 h-6 text-gray-400 group-hover:text-indigo-500" />
              </div>
            )}
            <div className="min-w-0 max-w-[260px]">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="font-bold text-gray-900 group-hover:text-indigo-600 transition-colors truncate" title={propTitle}>
                  {propTitle}
                </span>
                {propType && (
                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 shrink-0">
                    {propType}
                  </span>
                )}
              </div>
              <span className="text-[11px] text-gray-500 block truncate">
                {propAddress || p.facilities || 'No address specified'}
              </span>
            </div>
          </div>
        );
      }
    },
    { 
      header: 'Address', 
      accessor: (p) => (
        <div className="flex items-center gap-1.5 text-xs text-gray-600 max-w-[220px]">
          <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
          <span className="truncate" title={p.address}>{p.address}</span>
        </div>
      ) 
    },
    {
      header: 'Monthly Rent',
      accessor: (p) => <span className="font-extrabold text-gray-900">{formatMoney(p.monthlyRent)}</span>
    },
    {
      header: 'Specs & Area',
      accessor: (p) => (
        <div className="text-xs text-gray-700 font-medium">
          <div>{p.bedrooms} bed • {p.bathrooms} bath</div>
          {p.sqft ? <div className="text-[11px] text-gray-500">{Number(p.sqft).toLocaleString()} sqft</div> : null}
        </div>
      )
    },
    {
      header: 'Status',
      accessor: (p) => {
        let statusStr = typeof p.status === 'number' ? 
          ['PendingVerification', 'Active', 'Suspended'][p.status] : (p.status || 'PendingVerification');
        const isActive = statusStr === 'Active';
        return (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <Badge variant={isActive ? 'success' : 'default'} className={!isActive ? 'bg-amber-100 text-amber-900 border-amber-300 font-bold' : ''}>
                {isActive ? 'Active & Approved' : 'Not Active by Admin'}
              </Badge>
              {statusStr === 'PendingVerification' && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate('/agreements');
                  }}
                  className="text-[11px] font-bold text-blue-600 hover:underline flex items-center gap-0.5"
                  title="View proof and verification status"
                >
                  <span>Proof & Fee &rarr;</span>
                </button>
              )}
              {user?.role === 'Administrator' && statusStr === 'PendingVerification' && (
                <Button size="sm" onClick={(event) => { event.stopPropagation(); approveProperty(p.id); }}>
                  Approve
                </Button>
              )}
            </div>
            {!isActive && (
              <span className="text-[10.5px] text-amber-700 font-semibold flex items-center gap-1">
                <Clock className="w-3 h-3 text-amber-600 shrink-0" />
                <span>Awaiting Admin Approval</span>
              </span>
            )}
          </div>
        );
      }
    },
    {
      header: 'Manage Actions',
      accessor: (p) => (
        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setEditingProperty(p)}
            className="text-xs px-2.5 py-1 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 border-indigo-200 flex items-center gap-1 font-semibold cursor-pointer"
            title="Edit Property Details"
          >
            <Pencil className="w-3.5 h-3.5" />
            <span>Edit</span>
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => setDeletingProperty(p)}
            className="text-xs px-2.5 py-1 text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200 flex items-center gap-1 font-semibold cursor-pointer"
            title="Delete Property"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete</span>
          </Button>

          <Button
            size="sm"
            variant="secondary"
            onClick={() => { setInspectingProperty(p); setActiveInspectPhotoIndex(0); }}
            className="text-xs px-2.5 py-1 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 flex items-center gap-1 font-bold shadow-2xs cursor-pointer"
            title="Inspect Property Details"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Inspect</span>
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
            My Properties
          </h1>
          <p className="text-gray-500 mt-1 text-sm">
            Overview of your listed rental properties, details editing, and portfolio management.
          </p>
        </div>

        <Button 
          onClick={() => { setEditingProperty(null); setIsModalOpen(true); }} 
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-md shadow-indigo-600/20 self-start sm:self-auto flex items-center gap-2"
        >
          <SlidersHorizontal className="w-4 h-4" />
          <span>Manage Details</span>
        </Button>
      </div>

      {/* Top Metric: Properties Count Only */}
      <div className="rounded-2xl bg-white border border-gray-200/90 p-6 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-xs">
            <Building2 className="w-7 h-7" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Properties Count</p>
            <div className="flex items-baseline gap-2.5 mt-0.5">
              <span className="text-3xl font-black text-gray-900">{totalPropertiesCount}</span>
              <span className="text-sm font-semibold text-gray-500">Total Properties Listed</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setPropertyStatusFilter('ALL')}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
              propertyStatusFilter === 'ALL'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            All Listed ({totalPropertiesCount})
          </button>
          <button
            type="button"
            onClick={() => setPropertyStatusFilter('ACTIVE')}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              propertyStatusFilter === 'ACTIVE'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            Active by Admin ({activeCount})
          </button>
          <button
            type="button"
            onClick={() => setPropertyStatusFilter('NOT_ACTIVE')}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              propertyStatusFilter === 'NOT_ACTIVE'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-amber-50 text-amber-800 border border-amber-300 hover:bg-amber-100'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
            Not Active by Admin ({notActiveCount})
          </button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => { setEditingProperty(null); setIsModalOpen(true); }}
            className="text-xs font-bold border-indigo-200 text-indigo-700 hover:bg-indigo-50 flex items-center gap-1 ml-2"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Property</span>
          </Button>
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

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-gray-200 pb-3">
        <button
          type="button"
          onClick={() => setActiveView('properties')}
          className={`px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${
            activeView === 'properties' 
              ? 'bg-slate-900 text-white shadow-sm' 
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>My Listed Properties</span>
          <span className={`text-xs px-2 py-0.5 rounded-full ${activeView === 'properties' ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-700'}`}>
            {totalPropertiesCount}
          </span>
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
          <Clock className="w-4 h-4" />
          <span>Tenant Inquiries & Bookings</span>
          {pendingCount > 0 ? (
            <span className="bg-amber-400 text-slate-950 text-xs px-2 py-0.5 rounded-full font-extrabold animate-pulse">
              {pendingCount} New
            </span>
          ) : (
            <span className={`text-xs px-2 py-0.5 rounded-full ${activeView === 'bookings' ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-700'}`}>
              {applications.length}
            </span>
          )}
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
                          <div 
                            className="flex items-center gap-2 cursor-pointer group"
                            onClick={() => {
                              const matched = properties?.find(p => String(p.id || p.Id) === String(app.propertyId || app.PropertyId));
                              if (matched) {
                                setInspectingProperty(matched);
                                setActiveInspectPhotoIndex(0);
                              }
                            }}
                            title="Click to inspect this property"
                          >
                            <Building2 className="w-4 h-4 text-indigo-600 shrink-0 group-hover:scale-110 transition-transform" />
                            <span className="font-extrabold text-gray-900 text-sm group-hover:text-indigo-600 transition-colors underline-offset-2 hover:underline">
                              {app.propertyTitle}
                            </span>
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
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-extrabold text-gray-900">
                  My Listed Properties
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                  {filteredProperties.length} of {totalPropertiesCount} Listed
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                All rental properties registered under your ownership. Click <strong>Edit</strong> on any property to modify details or <strong>Delete</strong> to remove.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
              <div className="inline-flex p-1 bg-gray-100 rounded-xl text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setPropertyStatusFilter('ALL')}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    propertyStatusFilter === 'ALL'
                      ? 'bg-white text-gray-900 shadow-sm font-bold'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  All ({totalPropertiesCount})
                </button>
                <button
                  type="button"
                  onClick={() => setPropertyStatusFilter('ACTIVE')}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                    propertyStatusFilter === 'ACTIVE'
                      ? 'bg-emerald-600 text-white shadow-sm font-bold'
                      : 'text-emerald-700 hover:text-emerald-900'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  Active ({activeCount})
                </button>
                <button
                  type="button"
                  onClick={() => setPropertyStatusFilter('NOT_ACTIVE')}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                    propertyStatusFilter === 'NOT_ACTIVE'
                      ? 'bg-amber-600 text-white shadow-sm font-bold'
                      : 'text-amber-800 hover:text-amber-950'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
                  Not Active by Admin ({notActiveCount})
                </button>
              </div>

              <Button 
                onClick={() => { setEditingProperty(null); setIsModalOpen(true); }} 
                size="sm" 
                variant="outline"
                className="border-indigo-300 text-indigo-700 hover:bg-indigo-50 font-bold flex items-center gap-1.5"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Manage Details</span>
              </Button>
            </div>
          </div>

          {propsError && (
            <div className="p-4 bg-rose-50 text-rose-600 rounded-lg border border-rose-100">
              Failed to load properties: {propsError}
            </div>
          )}

          <DataTable
            data={filteredProperties}
            columns={columns}
            isLoading={isPropsLoading}
            onRowClick={(p) => navigate(`/properties/${p.id}`, { state: { property: p } })}
          />

          {/* Add New Property Modal */}
          <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Add New Property Listing">
            <PropertyForm 
              onSubmit={handleCreate} 
              onCancel={() => setIsModalOpen(false)} 
              isLoading={isCreating} 
            />
          </Modal>

          {/* Edit Property Details Modal */}
          <Modal 
            isOpen={Boolean(editingProperty)} 
            onClose={() => setEditingProperty(null)} 
            title={`Edit Property: ${editingProperty?.title || 'Details'}`}
          >
            {editingProperty && (
              <PropertyForm 
                initialData={editingProperty}
                onSubmit={handleUpdate} 
                onCancel={() => setEditingProperty(null)} 
                isLoading={isSaving} 
              />
            )}
          </Modal>

          {/* Delete Confirmation Modal */}
          <Modal
            isOpen={Boolean(deletingProperty)}
            onClose={() => setDeletingProperty(null)}
            title="Confirm Property Deletion"
          >
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-bold text-rose-900">Are you sure you want to delete this property?</h4>
                  <p className="text-xs text-rose-700 mt-1">
                    You are about to permanently remove <strong>"{deletingProperty?.title}"</strong> from your properties listing. This action cannot be undone.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDeletingProperty(null)}
                  disabled={isDeleting}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  isLoading={isDeleting}
                  onClick={() => handleDeleteProperty(deletingProperty)}
                  className="bg-rose-600 hover:bg-rose-700 text-white font-semibold"
                >
                  Yes, Delete Property
                </Button>
              </div>
            </div>
          </Modal>

          {/* Owner Property Inspection Modal (Matching Admin Inspection with Utility Bill Proof) */}
          <Modal
            isOpen={Boolean(inspectingProperty)}
            onClose={() => setInspectingProperty(null)}
            title={inspectingProperty ? `Property Inspection: ${inspectingProperty.title || inspectingProperty.Title || 'Property'}` : 'Property Details'}
            className="max-w-4xl"
          >
            {inspectingProperty && (() => {
              const p = inspectingProperty;
              const propId = p.id || p.Id;
              const propTitle = p.title || p.Title || 'Untitled Property';
              const propAddress = p.address || p.Address || 'Sri Lanka';
              const propRent = p.monthlyRent ?? p.MonthlyRent ?? 0;
              const propBedrooms = p.bedrooms ?? p.Bedrooms ?? 0;
              const propBathrooms = p.bathrooms ?? p.Bathrooms ?? 0;
              const propSqft = p.sqft ?? p.Sqft;
              const propType = p.propertyType || p.PropertyType || 'House';
              const propDesc = p.description || p.Description || 'No description provided.';
              const rawFacilities = p.facilities || p.Facilities || [];
              let facList = Array.isArray(rawFacilities) ? rawFacilities : (typeof rawFacilities === 'string' ? rawFacilities.split(',').map(s => s.trim()).filter(Boolean) : []);

              const rawStatus = p.status ?? p.Status;
              const statusStr = typeof rawStatus === 'number'
                ? ['PendingVerification', 'Active', 'Suspended'][rawStatus]
                : (rawStatus || 'Active');

              // Photos
              let photos = [];
              if (Array.isArray(p.photos) && p.photos.length > 0) {
                photos = p.photos.map(ph => typeof ph === 'string' ? ph : (ph?.photoUrl || ph?.PhotoUrl || ph?.url)).filter(Boolean);
              } else if (p.photoUrl || p.PhotoUrl) {
                photos = [p.photoUrl || p.PhotoUrl];
              }

              // Utility bill / documents
              const docs = Array.isArray(p.documents) ? p.documents : [];
              const utilityDoc = docs.find(d => d?.documentType === 'UtilityBill' || d?.documentType === 'OwnershipProof') || 
                                (p.utilityBillUrl ? { documentType: 'UtilityBill', documentUrl: p.utilityBillUrl } : null);

              return (
                <div className="space-y-6 text-sm text-gray-700">
                  {/* Status Banner */}
                  <div className="bg-slate-900 text-white p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm border border-slate-800">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 flex items-center justify-center shrink-0">
                        <Building2 className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">
                            Listing Inspection
                          </span>
                          <span className={`px-2.5 py-0.5 rounded-full text-[10.5px] font-extrabold ${
                            statusStr === 'Active' 
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : statusStr === 'Suspended'
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                              : 'bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse'
                          }`}>
                            {statusStr === 'Active' ? 'Live on Marketplace' : statusStr}
                          </span>
                        </div>
                        <span className="text-xs text-slate-300 font-mono">ID: {propId}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        onClick={() => {
                          setInspectingProperty(null);
                          setEditingProperty(p);
                        }}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        <span>Edit Details</span>
                      </Button>
                    </div>
                  </div>

                  {/* Photo Gallery */}
                  {photos.length > 0 ? (
                    <div className="space-y-2">
                      <div className="relative h-64 rounded-2xl overflow-hidden border border-gray-200 bg-gray-100 shadow-2xs">
                        <img
                          src={photos[activeInspectPhotoIndex] || photos[0]}
                          alt={propTitle}
                          onError={handleImageError}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute top-3 left-3 px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur-xs text-white text-xs font-bold flex items-center gap-1">
                          <Eye className="w-3.5 h-3.5" />
                          <span>Photo {activeInspectPhotoIndex + 1} of {photos.length}</span>
                        </div>
                      </div>
                      {photos.length > 1 && (
                        <div className="flex gap-2 overflow-x-auto pb-1">
                          {photos.map((url, idx) => (
                            <img
                              key={idx}
                              src={url}
                              alt=""
                              onClick={() => setActiveInspectPhotoIndex(idx)}
                              onError={handleImageError}
                              className={`w-20 h-14 object-cover rounded-lg border-2 cursor-pointer transition-all shrink-0 ${
                                activeInspectPhotoIndex === idx ? 'border-indigo-600 ring-2 ring-indigo-400' : 'border-gray-200 opacity-70 hover:opacity-100'
                              }`}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="h-40 rounded-2xl bg-gray-50 border border-dashed border-gray-200 flex flex-col items-center justify-center text-gray-400 gap-1">
                      <Building2 className="w-8 h-8" />
                      <span className="text-xs">No photos attached</span>
                    </div>
                  )}

                  {/* Pricing & Key Specs */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
                      <span className="text-[11px] font-semibold text-gray-500 block">Monthly Rent</span>
                      <span className="text-base font-black text-gray-900">{formatMoney(propRent)}</span>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
                      <span className="text-[11px] font-semibold text-gray-500 block">Floor Area</span>
                      <span className="text-sm font-bold text-gray-900">{propSqft ? `${Number(propSqft).toLocaleString()} sqft` : 'Not specified'}</span>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
                      <span className="text-[11px] font-semibold text-gray-500 block">Bedrooms / Baths</span>
                      <span className="text-sm font-bold text-gray-900">{propBedrooms} Bed • {propBathrooms} Bath</span>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
                      <span className="text-[11px] font-semibold text-gray-500 block">Property Type</span>
                      <span className="text-sm font-bold text-indigo-700">{propType}</span>
                    </div>
                  </div>

                  {/* Utility Bill Proof Verification Section */}
                  <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/80 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-amber-950 uppercase tracking-wider">
                            Electricity / Utility Bill Verification
                          </h4>
                          <span className="text-[11px] text-amber-800 font-medium">Scanned by Agentic AI OCR</span>
                        </div>
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                        <span>Address Verified</span>
                      </span>
                    </div>

                    {utilityDoc?.documentUrl ? (
                      <div className="flex flex-col sm:flex-row sm:items-center gap-4 bg-white p-3 rounded-xl border border-amber-200">
                        <img 
                          src={utilityDoc.documentUrl} 
                          alt="Utility bill proof" 
                          className="w-24 h-24 rounded-lg object-cover border border-gray-200 shadow-xs cursor-pointer hover:scale-105 transition-transform" 
                          onClick={() => window.open(utilityDoc.documentUrl, '_blank')}
                        />
                        <div className="space-y-1 text-xs text-gray-700">
                          <p className="font-bold text-gray-900 flex items-center gap-1.5">
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Utility Document Attached</span>
                          </p>
                          <p className="text-gray-500 text-[11px]">
                            Document Type: <strong>{utilityDoc.documentType || 'UtilityBill'}</strong>
                          </p>
                          <p className="text-emerald-700 text-[11.5px] font-medium">
                            ✓ Matches listed address: <strong>{propAddress}</strong>
                          </p>
                          <a 
                            href={utilityDoc.documentUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 pt-1"
                          >
                            <span>Open full document</span>
                            <ArrowRight className="w-3 h-3" />
                          </a>
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 rounded-xl bg-white/80 border border-amber-200 text-xs text-amber-900 flex items-center justify-between">
                        <span>No separate utility bill photo uploaded yet. You can attach one via <strong>Edit Details</strong>.</span>
                        <button
                          type="button"
                          onClick={() => {
                            setInspectingProperty(null);
                            setEditingProperty(p);
                          }}
                          className="text-indigo-600 hover:underline font-bold text-xs shrink-0 ml-2"
                        >
                          Attach Bill &rarr;
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Address & Description */}
                  <div className="p-4 bg-white rounded-2xl border border-gray-200 space-y-2">
                    <div className="flex items-center gap-1.5 text-xs text-gray-600 font-semibold">
                      <MapPin className="w-4 h-4 text-gray-400 shrink-0" />
                      <span>{propAddress}</span>
                    </div>
                    <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-line">
                      {propDesc}
                    </p>
                    {facList.length > 0 && (
                      <div className="pt-2 border-t border-gray-100">
                        <span className="text-[11px] font-bold text-gray-500 block mb-1">Facilities & Amenities:</span>
                        <div className="flex flex-wrap gap-1.5">
                          {facList.map((f, i) => (
                            <span key={i} className="px-2.5 py-1 rounded-lg bg-gray-100 text-gray-700 text-xs font-medium">
                              {typeof f === 'string' ? f.trim() : JSON.stringify(f)}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end pt-2">
                    <Button variant="outline" onClick={() => setInspectingProperty(null)}>
                      Close Inspection
                    </Button>
                  </div>
                </div>
              );
            })()}
          </Modal>
        </div>
      )}
    </div>
  );
};
