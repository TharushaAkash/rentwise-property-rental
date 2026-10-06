import { PropertyLocationCard } from './PropertyLocationCard';
import { accountStorage } from '../../utils/accountStorage';
import React, { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import api from '../../services/api';
import { useFetch } from '../../hooks/useFetch';
import { useMutation } from '../../hooks/useMutation';
import { useAuth } from '../../hooks/useAuth';
import { formatLankaPrice } from '../../data/lankaProperties';
import { ArrowLeft, ArrowRight, MapPin, Star, Camera, X, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Calendar, Building2, Phone, Mail, CheckCircle2, Maximize2, Share2, ShieldCheck, Pencil, Trash2, Clock, Lock, AlertCircle, Users, ExternalLink, FileText, Check, Eye, Zap, CheckCheck } from 'lucide-react';
import { BookingModal } from '../tenants/BookingModal';
import { Modal } from '../../components/ui/Modal';
import { PropertyForm } from './PropertyForm';
import { PropertyInspectModal } from './PropertyInspectModal';
import { PROPERTY_PLACEHOLDER_IMAGE, handleImageError } from '../../utils/imagePlaceholder';
import { getActiveBookingForProperty, BOOKINGS_UPDATED_EVENT } from '../../utils/bookingStatus';
import { evaluatePropertyVerification } from '../../utils/addressVerification';

export const PropertyDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const { user } = useAuth();

  const isAdmin = user?.role === 'Administrator' || user?.role === 'Admin' || user?.role === 'SystemAdmin';
  const isOwner = user?.role === 'PropertyOwner' || user?.role === 'Owner';
  const isOwnerOrAdmin = isOwner || isAdmin;

  // Instant data from router state if navigated from property card
  const passedProperty = location.state?.property;

  // 1. Modals & UI States
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [bookingSuccessData, setBookingSuccessData] = useState(null);
  const [showAuthBanner, setShowAuthBanner] = useState(true);
  const [showMoreDescription, setShowMoreDescription] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [ownerData, setOwnerData] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isInspectModalOpen, setIsInspectModalOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState('');
  const [adminStatus, setAdminStatus] = useState(null);

  // Connected applications for this property
  const [propertyApplications, setPropertyApplications] = useState([]);

  // Favorite / Save State
  const [isSaved, setIsSaved] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('rentwise_saved_properties') || '[]');
      return saved.includes(id);
    } catch {
      return false;
    }
  });

  // 2. Data Fetching Hooks
  const { data: property, isLoading, error } = useFetch(`/properties/${id}`);
  const { data: photosData } = useFetch(`/properties/${id}/photos`);
  const { mutateAsync: deleteProperty } = useMutation(`/properties/${id}`, 'DELETE');

  // Active property object (prefer server data, then router state)
  const currentProperty = useMemo(() => {
    if (property) return property;
    if (passedProperty) return passedProperty;
    return null;
  }, [property, passedProperty]);

  // Load applications tied to this property
  useEffect(() => {
    const fetchApps = async () => {
      let apps = [];
      try {
        const res = await api.get('/property-applications');
        if (Array.isArray(res.data)) {
          apps = res.data.filter((a) => String(a.propertyId) === String(id));
        }
      } catch {}
      try {
        const local = JSON.parse(accountStorage.getItem('rentwise_client_bookings') || '[]');
        const localMatched = local.filter((a) => String(a.propertyId) === String(id));
        const merged = new Map();
        localMatched.forEach((a) => a?.id && merged.set(a.id, a));
        apps.forEach((a) => a?.id && merged.set(a.id, a));
        apps = Array.from(merged.values());
      } catch {}
      setPropertyApplications(apps);
    };
    fetchApps();
  }, [id]);

  // Real-time booking synchronization
  const [bookingVersion, setBookingVersion] = useState(0);

  useEffect(() => {
    const handleUpdate = () => setBookingVersion((v) => v + 1);
    window.addEventListener(BOOKINGS_UPDATED_EVENT, handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener(BOOKINGS_UPDATED_EVENT, handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  const bookingInfo = useMemo(() => {
    return getActiveBookingForProperty(currentProperty?.id || id);
  }, [currentProperty?.id, id, bookingVersion]);

  const isBooked = bookingInfo.isBooked;

  // 3. Effects
  useEffect(() => {
    if (searchParams.get('book') === 'true') {
      if (isBooked) {
        setFeedbackMsg('This property currently has a pending booking and is under landlord review. Another booking cannot be placed.');
      } else {
        setIsBookingModalOpen(true);
      }
    }
  }, [searchParams, isBooked]);

  useEffect(() => {
    const ownerId = currentProperty?.ownerId || currentProperty?.OwnerId;
    if (ownerId && !currentProperty?.owner && !currentProperty?.Owner) {
      api.get(`/auth/users/${ownerId}`)
        .then((res) => setOwnerData(res.data))
        .catch(() => {});
    }
  }, [currentProperty]);

  // 4. Memos (Unconditionally called before any early returns)
  const realPhotos = useMemo(() => {
    const list = [];
    const addUrl = (val) => {
      if (typeof val === 'string' && val.trim().length > 0 && !list.includes(val.trim())) {
        list.push(val.trim());
      }
    };

    // Photos from /properties/:id/photos endpoint
    if (Array.isArray(photosData)) {
      photosData.forEach((p) => {
        if (typeof p === 'string') addUrl(p);
        else if (p && typeof p === 'object') {
          addUrl(p.photoUrl || p.PhotoUrl || p.url || p.imageUrl);
        }
      });
    }

    // Photos from property.photos or property.Photos array
    const propPhotos = currentProperty?.photos || currentProperty?.Photos;
    if (Array.isArray(propPhotos)) {
      const sorted = [...propPhotos].sort((a, b) => {
        const aPrimary = (a && typeof a === 'object' && (a.isPrimary || a.IsPrimary)) ? 1 : 0;
        const bPrimary = (b && typeof b === 'object' && (b.isPrimary || b.IsPrimary)) ? 1 : 0;
        return bPrimary - aPrimary;
      });
      sorted.forEach((p) => {
        if (typeof p === 'string') addUrl(p);
        else if (p && typeof p === 'object') {
          addUrl(p.photoUrl || p.PhotoUrl || p.url || p.imageUrl);
        }
      });
    }

    // Direct property photo fields
    if (currentProperty?.photoUrl) addUrl(currentProperty.photoUrl);
    if (currentProperty?.PhotoUrl) addUrl(currentProperty.PhotoUrl);
    if (currentProperty?.imageUrl) addUrl(currentProperty.imageUrl);

    return list;
  }, [currentProperty, photosData]);

  const facilitiesList = useMemo(() => {
    const rawFac = currentProperty?.facilities || currentProperty?.Facilities;
    if (!rawFac) return [];
    if (Array.isArray(rawFac)) {
      return rawFac.map((f) => String(f).trim()).filter(Boolean);
    }
    if (typeof rawFac === 'string') {
      return rawFac
        .split(',')
        .map((f) => f.trim())
        .filter(Boolean);
    }
    return [];
  }, [currentProperty?.facilities, currentProperty?.Facilities]);

  const verificationInfo = useMemo(() => {
    return evaluatePropertyVerification(currentProperty);
  }, [currentProperty]);

  // 5. Handlers
  const toggleSave = () => {
    try {
      const saved = JSON.parse(localStorage.getItem('rentwise_saved_properties') || '[]');
      const next = saved.includes(id) ? saved.filter((i) => i !== id) : [...saved, id];
      localStorage.setItem('rentwise_saved_properties', JSON.stringify(next));
      setIsSaved(!isSaved);
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpdatePropertyDetails = async (formData, files, utilityBillFile) => {
    try {
      setIsUpdating(true);
      const propId = currentProperty?.id || currentProperty?.Id || id;
      const propOwnerId = currentProperty?.ownerId || currentProperty?.OwnerId || user?.id;

      const payload = {
        id: propId,
        ownerId: propOwnerId,
        title: formData.title,
        description: formData.description,
        address: formData.address,
        monthlyRent: Number(formData.monthlyRent),
        bedrooms: Number(formData.bedrooms),
        bathrooms: Number(formData.bathrooms),
        facilities: formData.facilities || '',
        sqft: Number(formData.sqft || 0),
        propertyType: formData.propertyType || 'House',
        featureTags: Array.isArray(formData.featureTags) ? formData.featureTags : [],
        photoCount: Number(formData.photoCount || 0),
        photoUrls: formData.photoUrls || [],
        status: formData.status === 'Active' ? 1 : formData.status === 'Suspended' ? 2 : 0
      };

      await api.put(`/properties/${propId}`, payload);

      if (files && files.length > 0) {
        await Promise.all(files.map(async (file, index) => {
          const fd = new FormData();
          fd.append('file', file);
          fd.append('isPrimary', index === 0 && realPhotos.length === 0);
          try {
            await api.post(`/properties/${propId}/photos`, fd, {
              headers: { 'Content-Type': 'multipart/form-data' }
            });
          } catch (uploadErr) {
            console.error('Failed to upload photo:', file.name, uploadErr);
          }
        }));
      }

      let verificationMessage = '';
      if (utilityBillFile || formData.utilityBillUrl) {
        try {
          let billUrl = formData.utilityBillUrl || '';
          if (utilityBillFile) {
            const docForm = new FormData();
            docForm.append('file', utilityBillFile);
            docForm.append('documentType', 'UtilityBill');
            const docRes = await api.post(`/properties/${propId}/documents`, docForm, {
              headers: { 'Content-Type': 'multipart/form-data' }
            });
            if (docRes.data?.documentUrl) {
              billUrl = docRes.data.documentUrl;
            }
          }
          if (billUrl) {
            const proofResponse = await api.post(`/properties/${propId}/proof`, {
              documentType: 'UtilityBill',
              documentUrl: billUrl
            });
            verificationMessage = proofResponse.data?.message || 'Proof submitted for verification.';
          }
        } catch (billErr) {
          console.warn('Utility bill photo upload failed:', billErr);
          verificationMessage = 'Proof verification could not be submitted. Please try again.';
        }
      }

      setIsEditModalOpen(false);
      setFeedbackMsg(`Property details updated successfully! ${verificationMessage}`);
      setTimeout(() => {
        window.location.reload();
      }, 700);
    } catch (err) {
      console.error('Failed to update property details', err);
      alert('Failed to update property details. Please verify your inputs.');
    } finally {
      setIsUpdating(false);
    }
  };
  const handleDeletePropertyDetails = async () => {
    try {
      setIsDeleting(true);
      const propId = currentProperty?.id || currentProperty?.Id || id;
      await api.delete(`/properties/${propId}`);
      setIsDeleteModalOpen(false);
      navigate(isAdmin ? '/admin?tab=properties' : '/properties', { replace: true });
    } catch (err) {
      console.error('Failed to delete property', err);
      alert('Failed to delete property. It may have active bookings or records.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleAdminApprove = async () => {
    try {
      setIsUpdating(true);
      const propId = currentProperty?.id || currentProperty?.Id || id;
      await api.put(`/properties/${propId}/approve`);
      setAdminStatus('Active');
      setFeedbackMsg('Property listing approved and activated successfully!');

    } catch (err) {
      console.error('Admin approve failed:', err);
      setAdminStatus('Active');
      setFeedbackMsg('Property listing approved.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleAdminSuspend = async () => {
    try {
      setIsUpdating(true);
      const propId = currentProperty?.id || currentProperty?.Id || id;
      await api.put(`/properties/${propId}/reject`);
      setAdminStatus('Suspended');
      setFeedbackMsg('Property listing suspended.');

    } catch (err) {
      console.error('Admin suspend failed:', err);
      setAdminStatus('Suspended');
      setFeedbackMsg('Property listing suspended.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleAdminSetPending = async () => {
    try {
      setIsUpdating(true);
      const propId = currentProperty?.id || currentProperty?.Id || id;
      await api.put(`/properties/${propId}`, { ...currentProperty, status: 0 });
      setAdminStatus('PendingVerification');
      setFeedbackMsg('Property status marked as Pending Verification.');

    } catch (err) {
      console.error('Admin pending failed:', err);
      setAdminStatus('PendingVerification');
      setFeedbackMsg('Property status marked as Pending Verification.');
    } finally {
      setIsUpdating(false);
    }
  };

  // 6. Early Returns: Only block if we have NO data whatsoever (neither server nor passed)
  const hasData = Boolean(currentProperty);

  if (isLoading && !hasData) {
    return (
      <div className="py-24 text-center text-gray-500 font-medium">
        <div className="w-8 h-8 border-3 border-[#008037] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        Loading property details...
      </div>
    );
  }

  if (!hasData && (error || !isLoading)) {
    return (
      <div className="max-w-4xl mx-auto py-20 px-4 text-center">
        <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-3" />
        <h2 className="text-xl font-bold text-gray-800">Property Not Found</h2>
        <p className="text-xs text-gray-500 mt-1">
          {error || 'The listing you requested is not available or has been removed.'}
        </p>
        <button
          onClick={() => navigate(isAdmin ? '/admin?tab=properties' : '/properties')}
          className="mt-5 px-5 py-2 rounded bg-[#008037] hover:bg-[#00662c] text-white text-xs font-bold uppercase tracking-wider cursor-pointer"
        >
          {isAdmin ? 'Return to Admin Console' : 'Return to Properties'}
        </button>
      </div>
    );
  }

  // Authentic Entity Model properties from RentWise.API.Modules.PropertyManagement.Entities.Property
  const propertyTitle = currentProperty?.title || currentProperty?.Title || 'Untitled Property';
  const propertyAddress = currentProperty?.address || currentProperty?.Address || 'Address not specified';
  const propertyDescription = currentProperty?.description || currentProperty?.Description || 'No description provided for this property.';
  const monthlyRent = Number(currentProperty?.monthlyRent || currentProperty?.MonthlyRent || 0);
  const rentFormatted = formatLankaPrice(monthlyRent);
  const bedrooms = Number(currentProperty?.bedrooms ?? currentProperty?.Bedrooms ?? 0);
  const bathrooms = Number(currentProperty?.bathrooms ?? currentProperty?.Bathrooms ?? 0);
  
  const rawStatus = currentProperty?.status ?? currentProperty?.Status;
  const status = adminStatus || (typeof rawStatus === 'number'
    ? (rawStatus === 1 ? 'Active' : rawStatus === 2 ? 'Suspended' : 'Pending Verification')
    : (rawStatus || 'Active'));
  
  const propertyId = currentProperty?.id || currentProperty?.Id || id || '';
  
  const city = typeof propertyAddress === 'string' && propertyAddress.includes(',')
    ? propertyAddress.split(',').pop().trim()
    : (currentProperty?.city || currentProperty?.City || 'Sri Lanka');

  const titleLower = String(propertyTitle || '').toLowerCase();
  const propertyType = currentProperty?.propertyType || currentProperty?.PropertyType || (
    titleLower.includes('apartment') ? 'Apartment' : (titleLower.includes('commercial') ? 'Commercial' : 'House')
  );

  const sqft = currentProperty?.sqft ?? currentProperty?.Sqft ?? (bedrooms ? bedrooms * 750 + 500 : 1200);
  const featureTags = Array.isArray(currentProperty?.featureTags || currentProperty?.FeatureTags)
    ? (currentProperty?.featureTags || currentProperty?.FeatureTags)
    : [];

  const rawCreated = currentProperty?.createdAt || currentProperty?.CreatedAt;
  const createdAtFormatted = rawCreated && !isNaN(new Date(rawCreated).getTime()) 
    ? new Date(rawCreated).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : 'Recently';
    
  const rawUpdated = currentProperty?.updatedAt || currentProperty?.UpdatedAt;
  const updatedAtFormatted = rawUpdated && !isNaN(new Date(rawUpdated).getTime()) 
    ? new Date(rawUpdated).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : null;

  // Real Owner information from backend / ownerData / logged-in user
  const ownerId = currentProperty?.ownerId || currentProperty?.OwnerId;
  const isOwnerUser = user && ownerId && String(user.id || user.Id || '').toLowerCase() === String(ownerId).toLowerCase();
  const realOwner = currentProperty?.owner || currentProperty?.Owner || ownerData || (isOwnerUser ? user : null);
  const ownerName = realOwner?.name || realOwner?.Name || realOwner?.fullName || realOwner?.FullName || 'Verified Property Owner';
  const ownerPhone = realOwner?.phoneNumber || realOwner?.PhoneNumber || null;
  const ownerEmail = realOwner?.email || realOwner?.Email || null;
  const ownerRole = realOwner?.role || realOwner?.Role || 'Property Owner';
  const ownerInitial = (String(ownerName || 'V').trim()[0] || 'V').toUpperCase();


  const getFacilityIcon = (name) => {
    const n = name.toLowerCase();
    if (n.includes('ac') || n.includes('air')) return '❄️';
    if (n.includes('pool')) return '🏊';
    if (n.includes('hot') || n.includes('bath') || n.includes('water')) return '♨️';
    if (n.includes('park') || n.includes('garage')) return '🚗';
    if (n.includes('gym') || n.includes('fit')) return '🏋️';
    if (n.includes('security') || n.includes('guard')) return '🛡️';
    if (n.includes('cctv') || n.includes('cam')) return '📹';
    if (n.includes('power') || n.includes('gen') || n.includes('electr')) return '⚡';
    if (n.includes('garden') || n.includes('lawn')) return '🌳';
    if (n.includes('balcony') || n.includes('rooftop') || n.includes('terrace')) return '🏙️';
    if (n.includes('wifi') || n.includes('internet')) return '📶';
    if (n.includes('furnish')) return '🛋️';
    return '✨';
  };

  return (
    <div className="font-sans text-gray-900 pb-20 space-y-4">
      
      {/* 1. Breadcrumb & Back Navigation */}
      <div className="flex items-center justify-between py-1 text-xs text-gray-600">
        <button
          onClick={() => navigate(isAdmin ? '/admin?tab=properties' : '/properties')}
          className="inline-flex items-center gap-1.5 text-[#008037] hover:underline font-bold cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{isAdmin ? 'Back to Admin Console' : 'Back to List'}</span>
        </button>

        <div className="flex items-center gap-1.5 text-gray-500 text-[11.5px]">
          <span onClick={() => navigate(isAdmin ? '/admin?tab=properties' : '/properties')} className="hover:text-[#008037] cursor-pointer">
            {isAdmin ? 'Admin Console' : 'Home'}
          </span>
          <span>/</span>
          <span onClick={() => navigate(isAdmin ? '/admin?tab=properties' : '/properties')} className="hover:text-[#008037] cursor-pointer">
            {isAdmin ? 'Properties' : city}
          </span>
          <span>/</span>
          <span className="text-gray-800 font-semibold">{propertyType}</span>
        </div>
      </div>

      {/* Feedback notice */}
      {feedbackMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{feedbackMsg}</span>
          </div>
          <button onClick={() => setFeedbackMsg('')} className="text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Admin Platform Oversight Bar */}
      {isAdmin ? (
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-4 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-3 border border-indigo-900/50 animate-in fade-in">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-400/20 text-amber-300 border border-amber-400/30 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-400 block">
                  Administrator Platform Oversight
                </span>
                <span className={`px-2 py-0.5 rounded-full text-[10.5px] font-extrabold ${
                  status === 'Active'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : status === 'Suspended'
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse'
                }`}>
                  {status}
                </span>
              </div>
              <p className="text-xs text-slate-300">
                You have administrative authority over this listing. Review specs, inspect owner dossier, approve/suspend, or edit.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto shrink-0 flex-wrap">
            {status !== 'Active' && (
              <button
                type="button"
                onClick={handleAdminApprove}
                disabled={isUpdating}
                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all flex items-center gap-1 shadow-sm cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Approve & Activate</span>
              </button>
            )}

            {status !== 'Suspended' && (
              <button
                type="button"
                onClick={handleAdminSuspend}
                disabled={isUpdating}
                className="px-3 py-1.5 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/60 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>Suspend</span>
              </button>
            )}

            {status !== 'Pending Verification' && status !== 'PendingVerification' && (
              <button
                type="button"
                onClick={handleAdminSetPending}
                disabled={isUpdating}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-medium transition-all flex items-center gap-1 cursor-pointer"
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Mark Pending</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsEditModalOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all flex items-center gap-1 shadow-sm cursor-pointer"
            >
              <Pencil className="w-3.5 h-3.5" />
              <span>Edit</span>
            </button>

            <button
              type="button"
              onClick={() => setIsDeleteModalOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 hover:text-white border border-rose-500/30 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete</span>
            </button>
          </div>
        </div>
      ) : isOwner ? (
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-4 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-3 border border-indigo-900/50 animate-in fade-in">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center justify-center shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-300 block">
                Owner Management Access
              </span>
              <p className="text-xs text-slate-300">
                You own this property listing. You can update details, specs, pricing, and photos or remove it.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto shrink-0 flex-wrap">
            <button
              type="button"
              onClick={() => setIsInspectModalOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-slate-700 text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
              title="Inspect Property Details & Utility Proof"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Inspect Listing</span>
            </button>

            <button
              type="button"
              onClick={() => setIsEditModalOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <Pencil className="w-3.5 h-3.5" />
              <span>Edit Details</span>
            </button>

            <button
              type="button"
              onClick={() => setIsDeleteModalOpen(true)}
              className="px-3 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 hover:text-white border border-rose-500/30 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Property</span>
            </button>
          </div>
        </div>
      ) : null}

      {/* 2. Top Photo Gallery - DYNAMICALLY ADAPTED TO REAL UPLOADED SUPABASE PHOTOS */}
      {realPhotos.length === 0 ? (
        /* Zero Photos: Clean placeholder card */
        <section className="relative rounded-2xl overflow-hidden border border-gray-200 bg-gray-50/80 p-8 text-center flex flex-col items-center justify-center min-h-[260px] sm:min-h-[300px]">
          <div className="w-16 h-16 rounded-full bg-gray-200 text-gray-400 flex items-center justify-center mb-3">
            <Camera className="w-8 h-8 stroke-[1.5]" />
          </div>
          <h3 className="text-base font-bold text-gray-800">No Photos Uploaded</h3>
          <p className="text-xs text-gray-500 mt-1 max-w-sm">
            The property owner has not attached photos to this listing yet.
          </p>
        </section>
      ) : realPhotos.length === 1 ? (
        /* Single Photo: Full-width Hero */
        <section className="relative rounded-2xl overflow-hidden border border-gray-200 bg-gray-100 shadow-xs h-[360px] sm:h-[440px] lg:h-[480px]">
          <div 
            className="relative w-full h-full overflow-hidden group cursor-pointer"
            onClick={() => { setLightboxIndex(0); setLightboxOpen(true); }}
          >
            <img
              src={realPhotos[0]}
              alt={propertyTitle}
              onError={handleImageError}
              className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-500"
            />
            <div className="absolute top-3 left-3 bg-black/65 backdrop-blur-xs text-white text-xs font-bold px-2.5 py-1 rounded flex items-center gap-1 shadow-sm">
              <Camera className="w-3.5 h-3.5" />
              <span>1 Photo</span>
            </div>
            <div className="absolute bottom-3 right-3 bg-black/60 text-white text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 backdrop-blur-xs font-semibold hover:bg-black/80 transition-colors">
              <Maximize2 className="w-3.5 h-3.5" />
              <span>View Fullscreen</span>
            </div>
          </div>
        </section>
      ) : realPhotos.length === 2 ? (
        /* 2 Photos: Side-by-Side Split */
        <section className="relative rounded-2xl overflow-hidden border border-gray-200 bg-gray-100 shadow-xs h-[360px] sm:h-[440px] lg:h-[480px]">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 w-full h-full">
            {realPhotos.map((url, idx) => (
              <div 
                key={idx}
                className="relative h-full overflow-hidden group cursor-pointer"
                onClick={() => { setLightboxIndex(idx); setLightboxOpen(true); }}
              >
                <img
                  src={url}
                  alt={`${propertyTitle} - ${idx + 1}`}
                  onError={handleImageError}
                  className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-500"
                />
                <div className="absolute top-3 left-3 bg-black/65 backdrop-blur-xs text-white text-xs font-bold px-2.5 py-1 rounded flex items-center gap-1 shadow-sm">
                  <Camera className="w-3.5 h-3.5" />
                  <span>{idx + 1} / 2</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : realPhotos.length === 3 ? (
        /* 3 Photos: 1 Main (60%) + 2 Stacked Right (40%) */
        <section className="relative rounded-2xl overflow-hidden border border-gray-200 bg-gray-100 shadow-xs h-[360px] sm:h-[440px] lg:h-[480px]">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-1 w-full h-full">
            <div 
              className="md:col-span-7 relative h-full overflow-hidden group cursor-pointer"
              onClick={() => { setLightboxIndex(0); setLightboxOpen(true); }}
            >
              <img
                src={realPhotos[0]}
                alt={`${propertyTitle} - main`}
                onError={handleImageError}
                className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-500"
              />
              <div className="absolute top-3 left-3 bg-black/65 backdrop-blur-xs text-white text-xs font-bold px-2.5 py-1 rounded flex items-center gap-1 shadow-sm">
                <Camera className="w-3.5 h-3.5" />
                <span>3 Photos</span>
              </div>
            </div>
            <div className="md:col-span-5 grid grid-rows-2 gap-1 h-full">
              {realPhotos.slice(1, 3).map((url, idx) => (
                <div 
                  key={idx + 1}
                  className="relative h-full overflow-hidden group cursor-pointer"
                  onClick={() => { setLightboxIndex(idx + 1); setLightboxOpen(true); }}
                >
                  <img
                    src={url}
                    alt={`${propertyTitle} - photo ${idx + 2}`}
                    onError={handleImageError}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : realPhotos.length === 4 ? (
        /* 4 Photos: 1 Main Left + 3 Grid Right */
        <section className="relative rounded-2xl overflow-hidden border border-gray-200 bg-gray-100 shadow-xs h-[360px] sm:h-[440px] lg:h-[480px]">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-1 w-full h-full">
            <div 
              className="relative h-full overflow-hidden group cursor-pointer"
              onClick={() => { setLightboxIndex(0); setLightboxOpen(true); }}
            >
              <img
                src={realPhotos[0]}
                alt={`${propertyTitle} - main`}
                onError={handleImageError}
                className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-500"
              />
              <div className="absolute top-3 left-3 bg-black/65 backdrop-blur-xs text-white text-xs font-bold px-2.5 py-1 rounded flex items-center gap-1 shadow-sm">
                <Camera className="w-3.5 h-3.5" />
                <span>4 Photos</span>
              </div>
            </div>
            <div className="grid grid-cols-2 grid-rows-2 gap-1 h-full">
              <div 
                className="col-span-2 relative h-full overflow-hidden group cursor-pointer"
                onClick={() => { setLightboxIndex(1); setLightboxOpen(true); }}
              >
                <img
                  src={realPhotos[1]}
                  alt={`${propertyTitle} - photo 2`}
                  onError={handleImageError}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
              </div>
              <div 
                className="relative h-full overflow-hidden group cursor-pointer"
                onClick={() => { setLightboxIndex(2); setLightboxOpen(true); }}
              >
                <img
                  src={realPhotos[2]}
                  alt={`${propertyTitle} - photo 3`}
                  onError={handleImageError}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
              </div>
              <div 
                className="relative h-full overflow-hidden group cursor-pointer"
                onClick={() => { setLightboxIndex(3); setLightboxOpen(true); }}
              >
                <img
                  src={realPhotos[3]}
                  alt={`${propertyTitle} - photo 4`}
                  onError={handleImageError}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
              </div>
            </div>
          </div>
        </section>
      ) : (
        /* 5 or More Photos: LankaPropertyWeb Style 1 Hero + 2x2 Grid */
        <section className="relative rounded-2xl overflow-hidden border border-gray-200 bg-gray-100 shadow-xs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-1 h-[360px] sm:h-[440px] lg:h-[490px]">
            
            {/* Featured Hero Image (Left 50%) */}
            <div 
              className="relative h-full overflow-hidden group cursor-pointer"
              onClick={() => { setLightboxIndex(0); setLightboxOpen(true); }}
            >
              <img
                src={realPhotos[0]}
                alt={propertyTitle}
                onError={handleImageError}
                className="w-full h-full object-cover group-hover:scale-103 transition-transform duration-500"
              />
              <div className="absolute top-3 left-3 bg-black/65 backdrop-blur-xs text-white text-xs font-bold px-2.5 py-1 rounded flex items-center gap-1 shadow-sm">
                <Camera className="w-3.5 h-3.5" />
                <span>{realPhotos.length} Photos</span>
              </div>
            </div>

            {/* 2x2 Grid of Photos (Right 50%) */}
            <div className="grid grid-cols-2 grid-rows-2 gap-1 h-full">
              {/* Slot 1 */}
              <div 
                className="relative overflow-hidden group cursor-pointer"
                onClick={() => { setLightboxIndex(1); setLightboxOpen(true); }}
              >
                <img
                  src={realPhotos[1]}
                  alt={`${propertyTitle} 2`}
                  onError={handleImageError}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
              </div>

              {/* Slot 2 */}
              <div 
                className="relative overflow-hidden group cursor-pointer"
                onClick={() => { setLightboxIndex(2); setLightboxOpen(true); }}
              >
                <img
                  src={realPhotos[2]}
                  alt={`${propertyTitle} 3`}
                  onError={handleImageError}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
              </div>

              {/* Slot 3 */}
              <div 
                className="relative overflow-hidden group cursor-pointer"
                onClick={() => { setLightboxIndex(3); setLightboxOpen(true); }}
              >
                <img
                  src={realPhotos[3]}
                  alt={`${propertyTitle} 4`}
                  onError={handleImageError}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
              </div>

              {/* Slot 4 with '+ more' overlay if realPhotos.length > 5 */}
              <div 
                className="relative overflow-hidden group cursor-pointer"
                onClick={() => { setLightboxIndex(4); setLightboxOpen(true); }}
              >
                <img
                  src={realPhotos[4]}
                  alt={`${propertyTitle} 5`}
                  onError={handleImageError}
                  className="w-full h-full object-cover"
                />
                {realPhotos.length > 5 && (
                  <div className="absolute inset-0 bg-black/60 hover:bg-black/70 transition-colors flex flex-col items-center justify-center text-white">
                    <span className="text-base sm:text-lg font-bold tracking-tight">
                      + {realPhotos.length - 4} more
                    </span>
                    <span className="text-xs text-gray-300 mt-1 flex items-center gap-1 font-medium">
                      <Camera className="w-3.5 h-3.5" />
                      <span>{realPhotos.length}</span>
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 3. Auth / Registration Callout Ribbon for Guests */}
      {showAuthBanner && !user && (
        <div className="rounded-lg border border-gray-200 bg-white p-3.5 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-lg shrink-0">
              👤
            </div>
            <span className="text-xs sm:text-sm font-semibold text-gray-800">
              Login or register here to access direct landlord contact and booking features.
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => navigate('/login')}
              className="px-5 py-1.5 rounded bg-[#008037] hover:bg-[#00662c] text-white text-xs font-bold uppercase tracking-wider shadow-xs cursor-pointer"
            >
              Login
            </button>
            <button
              onClick={() => navigate('/register')}
              className="px-5 py-1.5 rounded bg-[#008037] hover:bg-[#00662c] text-white text-xs font-bold uppercase tracking-wider shadow-xs cursor-pointer"
            >
              Register
            </button>
            <button
              onClick={() => setShowAuthBanner(false)}
              className="text-gray-400 hover:text-gray-600 p-1 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* 4. Quick Specs Row & Big Green Price Header */}
      <div className="pt-2 border-b border-gray-200 pb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          {/* Quick Specs strictly from Property model */}
          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 text-xs font-semibold text-gray-700">
            <span className="inline-flex items-center gap-1.5 bg-indigo-50 text-indigo-800 border border-indigo-200 px-3 py-1 rounded-md font-bold">
              <span>🏠</span>
              <span>{propertyType}</span>
            </span>
            <span className="inline-flex items-center gap-1.5 bg-gray-100 px-3 py-1 rounded-md border border-gray-200">
              <span>🛏️</span>
              <span>{bedrooms} {bedrooms === 1 ? 'Bedroom' : 'Bedrooms'}</span>
            </span>
            <span className="inline-flex items-center gap-1.5 bg-gray-100 px-3 py-1 rounded-md border border-gray-200">
              <span>🛁</span>
              <span>{bathrooms} {bathrooms === 1 ? 'Bathroom' : 'Bathrooms'}</span>
            </span>
            <span className="inline-flex items-center gap-1.5 bg-gray-100 px-3 py-1 rounded-md border border-gray-200">
              <span>📐</span>
              <span>{Number(sqft).toLocaleString()} sqft</span>
            </span>
            {isBooked ? (
              <span className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-900 border border-amber-300 px-3 py-1 rounded-md font-extrabold shadow-xs">
                <Clock className="w-3.5 h-3.5 text-amber-600" />
                <span>{bookingInfo.isLeased ? 'Leased · Unavailable' : 'Booking Pending · Under Review'}</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200 px-3 py-1 rounded-md font-bold">
                <span className="w-2 h-2 rounded-full bg-emerald-600 inline-block" />
                <span>{status}</span>
              </span>
            )}
            {verificationInfo.isVerified && (
              <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-800 border border-emerald-300 px-3 py-1 rounded-md font-extrabold shadow-2xs">
                <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>{verificationInfo.statusLabel}</span>
              </span>
            )}
            <span className="inline-flex items-center gap-1.5 bg-gray-100 px-3 py-1 rounded-md text-gray-600 border border-gray-200">
              <MapPin className="w-3.5 h-3.5 text-gray-500 shrink-0" />
              <span className="truncate max-w-[220px]">{propertyAddress}</span>
            </span>
            <span className="inline-flex items-center gap-1.5 bg-gray-100 px-3 py-1 rounded-md text-gray-500 border border-gray-200 font-mono text-[11px]">
              <span>ID:</span>
              <span>{String(propertyId || '').substring(0, 8).toUpperCase()}</span>
            </span>
          </div>

          {/* Feature Tags (Highlights) */}
          {featureTags.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
              {featureTags.map((tag) => (
                <span 
                  key={tag} 
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200"
                >
                  <span className="text-amber-500">✨</span>
                  <span>{tag}</span>
                </span>
              ))}
            </div>
          )}

          {/* Price Header in LankaPropertyWeb Emerald Green */}
          <div className="flex items-baseline gap-2 mt-3">
            <span className="text-2xl sm:text-3xl font-black text-[#008037] tracking-tight">
              {rentFormatted}
            </span>
            <span className="text-sm font-medium text-gray-600">Per Month</span>
            <span className="text-xs text-gray-500 font-medium">(Negotiable)</span>
            <span className="text-[11px] font-bold border border-gray-300 rounded px-1.5 py-0.5 text-gray-700 bg-white">
              LKR ▾
            </span>
          </div>
        </div>

        {/* Action Controls for Property Owner / Admin or Tenant/Visitor */}
        <div className="flex items-center gap-3">
          {isOwnerOrAdmin ? (
            <button
              onClick={() => setIsDeleteModalOpen(true)}
              className="px-4 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 border border-rose-300 rounded-lg cursor-pointer"
            >
              Delete Listing
            </button>
          ) : isBooked ? (
            <button
              disabled
              title="This property currently has a pending booking and cannot be booked by another applicant."
              className="px-6 py-2.5 bg-amber-100 border border-amber-300 text-amber-900 text-xs sm:text-sm font-bold rounded-lg cursor-not-allowed flex items-center gap-2 shadow-xs"
            >
              <Lock className="w-4 h-4 text-amber-700" />
              <span>{bookingInfo.isLeased ? 'Leased · Unavailable' : 'Booking Pending (Under Review)'}</span>
            </button>
          ) : (
            <button
              onClick={() => setIsBookingModalOpen(true)}
              className="px-6 py-2.5 bg-[#ff5a00] hover:bg-[#e04f00] text-white text-xs sm:text-sm font-extrabold uppercase tracking-wider rounded-lg shadow-md shadow-orange-500/20 hover:shadow-orange-500/40 hover:-translate-y-0.5 transition-all active:scale-95 flex items-center gap-2 cursor-pointer"
            >
              <Calendar className="w-4 h-4" />
              <span>Book Property</span>
            </button>
          )}
        </div>
      </div>

      {/* 5. Main Content: Two Columns (Left Details + Right Sticky Contact Sidebar) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start pt-2">
        
        {/* Left Column (8 Columns) */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Card 1: Property Model Overview Specs */}
          <div className="rounded-xl border border-gray-200 bg-white p-5 sm:p-6 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base sm:text-lg font-bold text-gray-900">
                Property Overview
              </h3>
              <span className="text-xs font-mono text-gray-500 bg-gray-50 px-2.5 py-1 rounded border border-gray-200">
                Ref: {propertyId}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Property Type', val: propertyType },
                { label: 'Floor Area', val: `${Number(sqft).toLocaleString()} sqft` },
                { label: 'Monthly Rent', val: rentFormatted },
                { label: 'Bedrooms', val: `${bedrooms} ${bedrooms === 1 ? 'Room' : 'Rooms'}` },
                { label: 'Bathrooms', val: `${bathrooms} ${bathrooms === 1 ? 'Bath' : 'Baths'}` },
                { label: 'Listing Status', val: status },
                { label: 'Property Address', val: propertyAddress },
                { label: 'Facilities Recorded', val: facilitiesList.length > 0 ? `${facilitiesList.length} Facilities` : 'None specified' },
                { label: 'Date Added', val: createdAtFormatted },
                { label: 'Last Updated', val: updatedAtFormatted || createdAtFormatted }
              ].map((item) => (
                <div 
                  key={item.label}
                  className="rounded-lg bg-gray-50/80 border border-gray-100 p-3 flex flex-col justify-center text-center"
                >
                  <span className="text-[11px] font-medium text-gray-500 truncate">{item.label}</span>
                  <span className="text-xs sm:text-sm font-bold text-gray-900 mt-1 truncate" title={String(item.val)}>
                    {item.val}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Card 2: Property Details & Description */}
          <div className="rounded-xl border border-gray-200 bg-white p-5 sm:p-6 shadow-xs space-y-3">
            <h3 className="text-base sm:text-lg font-bold text-gray-900">
              Property Description
            </h3>

            <div className="space-y-1 pb-2 border-b border-gray-100">
              <h4 className="text-base font-bold text-gray-900">
                {propertyTitle}
              </h4>
              <p className="text-xs font-medium text-gray-500 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                <span>{propertyAddress}</span>
              </p>
            </div>

            <div className="pt-2 text-xs sm:text-[13.5px] text-gray-700 leading-relaxed whitespace-pre-line">
              <p className={showMoreDescription ? '' : 'line-clamp-4'}>
                {propertyDescription}
              </p>

              {propertyDescription && propertyDescription.length > 200 && (
                <button
                  type="button"
                  onClick={() => setShowMoreDescription(!showMoreDescription)}
                  className="inline-flex items-center gap-1 text-[#008037] font-bold text-xs hover:underline mt-2 cursor-pointer"
                >
                  <span>{showMoreDescription ? 'Show Less' : 'Show More'}</span>
                  {showMoreDescription ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
              )}
            </div>
          </div>

          <PropertyLocationCard property={currentProperty} address={propertyAddress} />

          {/* Card 3: Facilities from Property Model */}
          <div className="rounded-xl border border-gray-200 bg-white p-5 sm:p-6 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base sm:text-lg font-bold text-gray-900">
                Facilities & Amenities
              </h3>
              <span className="text-xs text-gray-500 font-medium">
                {facilitiesList.length} {facilitiesList.length === 1 ? 'item' : 'items'}
              </span>
            </div>

            {facilitiesList.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {facilitiesList.map((facility) => (
                  <div 
                    key={facility} 
                    className="flex items-center gap-2.5 p-3 rounded-lg border border-gray-200 bg-gray-50/60 text-gray-800 font-semibold text-xs shadow-2xs"
                  >
                    <span className="text-base shrink-0">{getFacilityIcon(facility)}</span>
                    <span className="text-[12px] uppercase tracking-wide truncate">{facility}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 rounded-lg bg-gray-50 border border-dashed border-gray-200 text-center text-gray-500 text-xs">
                <span>No facilities were recorded for this property listing.</span>
              </div>
            )}
          </div>

          {/* Card 4: Connected Tenant Applications (for Admin & Owner) */}
          {isOwnerOrAdmin && (
            <div className="rounded-xl border border-gray-200 bg-white p-5 sm:p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-indigo-600" />
                  <h3 className="text-base sm:text-lg font-bold text-gray-900">
                    Tenant Applications & Bookings
                  </h3>
                </div>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-bold border border-indigo-100">
                  {propertyApplications.length} {propertyApplications.length === 1 ? 'Application' : 'Applications'}
                </span>
              </div>

              {propertyApplications.length > 0 ? (
                <div className="divide-y divide-gray-100">
                  {propertyApplications.map((app) => {
                    const applicantName = app.applicantName || app.applicant?.name || app.tenant?.name || 'Applicant';
                    const applicantEmail = app.applicantEmail || app.applicant?.email || app.tenant?.email;
                    const applicantPhone = app.applicantPhone || app.applicant?.phoneNumber || app.tenant?.phoneNumber;
                    const appStatus = app.status || 'Submitted';
                    const isApproved = appStatus === 'Approved' || appStatus === 'Active';

                    return (
                      <div key={app.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 first:pt-0 last:pb-0">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-800 font-extrabold flex items-center justify-center shrink-0">
                            {applicantName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-gray-900 text-sm">{applicantName}</span>
                              <span className={`text-[10.5px] font-extrabold px-2 py-0.5 rounded-full ${
                                isApproved
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : appStatus === 'Rejected'
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}>
                                {appStatus}
                              </span>
                            </div>
                            <div className="text-xs text-gray-500 mt-0.5 flex flex-wrap gap-2">
                              {applicantEmail && <span>{applicantEmail}</span>}
                              {applicantPhone && <span>• {applicantPhone}</span>}
                              {app.moveInDate && <span>• Move-in: {new Date(app.moveInDate).toLocaleDateString()}</span>}
                            </div>
                          </div>
                        </div>

                        {isAdmin ? (
                          <button
                            type="button"
                            onClick={() => navigate('/admin?tab=agreements')}
                            className="px-3 py-1.5 rounded-lg border border-indigo-200 text-indigo-700 hover:bg-indigo-50 text-xs font-bold flex items-center gap-1 self-start sm:self-auto cursor-pointer"
                          >
                            <span>Inspect Agreement</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-6 rounded-xl bg-gray-50 border border-dashed border-gray-200 text-center text-gray-500 text-xs">
                  <span>No tenant applications or booking requests submitted for this property yet.</span>
                </div>
              )}
            </div>
          )}

          {/* Card: Electricity / Utility Bill Verification Section */}
          {(isAdmin || (isOwner && user?.id === currentProperty?.ownerId)) && (() => {
            const docs = Array.isArray(currentProperty?.documents) ? currentProperty.documents : [];
            const utilityDoc = docs.find(d => d.documentUrl === verificationInfo.billUrl) ||
                              (verificationInfo.billUrl ? { documentType: 'OwnershipProof', documentUrl: verificationInfo.billUrl } : null);

            return (
              <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200/80 space-y-3 mt-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-amber-950 uppercase tracking-wider">
                    Electricity / Utility Bill Verification
                  </h4>
                  <span className="text-[11px] text-amber-800 font-medium">Property verification status</span>
                </div>
              </div>
              <span className={`px-2.5 py-0.5 rounded-full text-[10.5px] font-bold flex items-center gap-1 border ${
                verificationInfo.isVerified 
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300' 
                  : utilityDoc?.documentUrl 
                    ? 'bg-red-100 text-red-800 border-red-300' 
                    : 'bg-amber-100 text-amber-800 border-amber-300'
              }`}>
                {verificationInfo.isVerified ? (
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                ) : utilityDoc?.documentUrl ? (
                  <AlertCircle className="w-3.5 h-3.5 text-red-600" />
                ) : (
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                )}
                <span>
                  {verificationInfo.statusLabel}
                </span>
              </span>
            </div>

            {(() => {
              if (utilityDoc?.documentUrl) {
                return (
                  <div className={`flex flex-col sm:flex-row sm:items-center gap-4 bg-white p-3.5 rounded-xl border ${verificationInfo.isVerified ? 'border-emerald-200' : 'border-red-200'}`}>
                    <img
                      src={utilityDoc.documentUrl}
                      alt="Utility bill proof"
                      className="w-24 h-24 rounded-lg object-cover border border-gray-200 shadow-xs cursor-pointer hover:scale-105 transition-transform shrink-0"
                      onClick={() => window.open(utilityDoc.documentUrl, '_blank')}
                    />
                    <div className="space-y-1 text-xs text-gray-700">
                      <p className="font-bold text-gray-900 flex items-center gap-1.5">
                        {verificationInfo.isVerified ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <X className="w-3.5 h-3.5 text-red-600" />
                        )}
                        <span>Utility Document Attached</span>
                      </p>
                      <p className="text-gray-500 text-[11px]">
                        Document Type: <strong>{utilityDoc.documentType || 'UtilityBill'}</strong>
                      </p>
                      
                      <p className="text-gray-700 text-[11.5px] font-medium">
                        {verificationInfo.matchDetails}
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
                );
              }

              return (
                <div className="p-3 rounded-xl bg-white/80 border border-amber-200 text-xs text-amber-900 flex items-center justify-between">
                  <span>No utility bill proof attached yet for this property listing.</span>
                  {isOwner && (
                    <button
                      type="button"
                      onClick={() => setIsEditModalOpen(true)}
                      className="text-indigo-600 hover:underline font-bold text-xs shrink-0 ml-2 cursor-pointer"
                    >
                      Attach Bill &rarr;
                    </button>
                  )}
                </div>
              );
            })()}
          </div>
            );
          })()}

        </div>

        {/* Right Column: Contact Advertiser & Actions (4 Columns) */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Share & Save Top Pill Toolbar */}
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center justify-between border border-gray-300 rounded-lg px-3 py-2 bg-white shadow-xs text-xs font-semibold text-gray-700">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-[10px]">f</span>
                <span className="w-5 h-5 rounded-full bg-[#25D366] text-white flex items-center justify-center font-bold text-[10px]">W</span>
                <span className="w-5 h-5 rounded-full bg-sky-500 text-white flex items-center justify-center font-bold text-[10px]">T</span>
              </div>
              <button 
                onClick={() => {
                  if (navigator.clipboard) {
                    navigator.clipboard.writeText(window.location.href);
                    alert('Property link copied to clipboard!');
                  }
                }}
                className="hover:text-[#008037] cursor-pointer flex items-center gap-1"
              >
                <Share2 className="w-3 h-3" />
                <span>Share</span>
              </button>
            </div>

            <button
              onClick={toggleSave}
              className={`flex items-center gap-1.5 border rounded-lg px-4 py-2 text-xs font-bold transition-all shadow-xs cursor-pointer ${
                isSaved 
                  ? 'border-amber-400 bg-amber-50 text-amber-600' 
                  : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Star className={`w-4 h-4 ${isSaved ? 'fill-amber-400 text-amber-400' : 'text-gray-400'}`} />
              <span>{isSaved ? 'Saved' : 'Save'}</span>
            </button>
          </div>

          {/* Contact Advertiser Card - Authentic Owner Details */}
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-xs text-center space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-2.5">
              <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wider">
                Property Owner
              </h4>
              <span className="inline-flex items-center gap-1 text-[10.5px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                <span>Verified</span>
              </span>
            </div>

            {/* Owner Initial / Avatar Badge */}
            <div className="w-20 h-20 mx-auto rounded-full bg-emerald-100 border-2 border-emerald-500 flex items-center justify-center text-emerald-800 font-extrabold text-2xl shadow-sm">
              {ownerInitial}
            </div>

            <div className="space-y-1">
              <h5 className="text-base font-extrabold text-gray-900 leading-tight">
                {ownerName}
              </h5>
              <span className="text-xs text-gray-500 font-medium block">
                {ownerRole}
              </span>

              {ownerPhone && (
                <div className="pt-1.5 flex items-center justify-center gap-1.5 text-xs text-gray-800 font-semibold font-mono">
                  <Phone className="w-3.5 h-3.5 text-[#008037]" />
                  <span>{ownerPhone}</span>
                </div>
              )}

              {ownerEmail && (
                <div className="flex items-center justify-center gap-1.5 text-xs text-gray-600 font-medium">
                  <Mail className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                  <span className="truncate max-w-[210px]">{ownerEmail}</span>
                </div>
              )}
            </div>

            {/* Action Buttons: Admin Controls vs Owner Edit/Delete vs Tenant Booking */}
            {isAdmin ? (
              <div className="space-y-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => {
                    navigate(`/admin?tab=users&search=${encodeURIComponent(ownerEmail || ownerName)}`);
                  }}
                  className="w-full py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Inspect Landlord in Users Tab</span>
                </button>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsEditModalOpen(true)}
                    className="py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    <span>Edit Listing</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsDeleteModalOpen(true)}
                    className="py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </button>
                </div>

                {status !== 'Active' ? (
                  <button
                    type="button"
                    onClick={handleAdminApprove}
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold uppercase tracking-wider rounded-lg shadow-sm transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Approve & Activate</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleAdminSuspend}
                    className="w-full py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Suspend Listing</span>
                  </button>
                )}
              </div>
            ) : isOwner ? (
              <div className="space-y-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsInspectModalOpen(true)}
                  className="w-full py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <Eye className="w-4 h-4 text-indigo-600" />
                  <span>Inspect Property Details</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(true)}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold uppercase tracking-wider rounded-lg shadow-sm transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <Pencil className="w-4 h-4" />
                  <span>Edit Property Details</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsDeleteModalOpen(true)}
                  className="w-full py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Delete Listing</span>
                </button>
              </div>
            ) : isBooked ? (
              <div className="space-y-2.5 pt-2">
                <button
                  type="button"
                  disabled
                  title="This property currently has a pending booking and cannot be booked by another applicant."
                  className="w-full py-3.5 bg-amber-100 border border-amber-300 text-amber-900 text-xs sm:text-sm font-black uppercase tracking-wider rounded-lg cursor-not-allowed flex items-center justify-center gap-2 shadow-xs"
                >
                  <Lock className="w-4 h-4 text-amber-700" />
                  <span>{bookingInfo.isLeased ? 'Leased · Unavailable' : 'Booking Pending · Unavailable'}</span>
                </button>
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2 leading-relaxed">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>
                    This property currently has an active booking under landlord review. Another applicant cannot submit a booking at this time.
                  </span>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setIsBookingModalOpen(true)}
                className="w-full py-3.5 bg-[#ff5a00] hover:bg-[#e04f00] text-white text-xs sm:text-sm font-black uppercase tracking-wider rounded-lg shadow-md shadow-orange-500/20 hover:shadow-orange-500/40 hover:-translate-y-0.5 transition-all active:scale-98 cursor-pointer flex items-center justify-center gap-2"
              >
                <Calendar className="w-4 h-4" />
                <span>Book Property / Check Availability</span>
              </button>
            )}
          </div>

        </div>
      </div>

      {/* 6. Fullscreen Photo Lightbox Modal for Real Photos */}
      {lightboxOpen && realPhotos.length > 0 && (
        <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex flex-col justify-between p-4 sm:p-6 animate-in fade-in">
          {/* Top Bar */}
          <div className="flex items-center justify-between text-white text-xs">
            <span className="font-bold">
              {lightboxIndex + 1} / {realPhotos.length}
            </span>
            <button
              onClick={() => setLightboxOpen(false)}
              className="p-2 text-white/80 hover:text-white rounded-full bg-white/10 hover:bg-white/20 transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Main Image with Prev / Next Navigation */}
          <div className="relative flex-1 flex items-center justify-center my-4 overflow-hidden">
            {realPhotos.length > 1 && (
              <button
                onClick={() => setLightboxIndex((prev) => (prev > 0 ? prev - 1 : realPhotos.length - 1))}
                className="absolute left-2 sm:left-4 z-10 p-2.5 text-white rounded-full bg-black/60 hover:bg-black/80 transition-all cursor-pointer"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
            )}

            <img
              src={realPhotos[lightboxIndex]}
              alt={`Photo ${lightboxIndex + 1}`}
              onError={handleImageError}
              className="max-h-[75vh] max-w-full object-contain rounded-lg shadow-2xl"
            />

            {realPhotos.length > 1 && (
              <button
                onClick={() => setLightboxIndex((prev) => (prev < realPhotos.length - 1 ? prev + 1 : 0))}
                className="absolute right-2 sm:right-4 z-10 p-2.5 text-white rounded-full bg-black/60 hover:bg-black/80 transition-all cursor-pointer"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            )}
          </div>

          {/* Bottom Thumbnails */}
          {realPhotos.length > 1 && (
            <div className="flex items-center justify-center gap-2 overflow-x-auto py-2">
              {realPhotos.map((ph, idx) => (
                <img
                  key={idx}
                  src={ph}
                  alt={`Thumbnail ${idx + 1}`}
                  onError={handleImageError}
                  onClick={() => setLightboxIndex(idx)}
                  className={`w-14 h-10 object-cover rounded cursor-pointer transition-all ${
                    idx === lightboxIndex ? 'ring-2 ring-[#008037] scale-105 opacity-100' : 'opacity-60 hover:opacity-100'
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* 7. Interactive Booking Modal */}
      <BookingModal
        isOpen={isBookingModalOpen}
        onClose={() => setIsBookingModalOpen(false)}
        property={currentProperty}
        onSuccess={(bookedProp) => {
          setIsBookingModalOpen(false);
          setBookingSuccessData(bookedProp || currentProperty);
        }}
      />

      {/* Booking Success Confirmation Modal */}
      {bookingSuccessData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-gray-100 text-center space-y-4 animate-in zoom-in-95">
            <div className="w-14 h-14 rounded-full bg-emerald-100 text-[#008037] flex items-center justify-center mx-auto shadow-sm">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-extrabold text-gray-900">
              Booking Request Submitted!
            </h3>
            <p className="text-xs text-gray-600 leading-relaxed">
              Your rental application for <strong className="text-gray-800">{bookingSuccessData.title}</strong> has been sent to the property owner. You can track this under <strong>My Agreements</strong>.
            </p>
            <div className="pt-2 flex flex-col sm:flex-row gap-2.5 justify-center">
              <button
                onClick={() => setBookingSuccessData(null)}
                className="px-4 py-2 rounded-lg border border-gray-300 text-xs font-bold text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
              >
                Back to Details
              </button>
              <button
                onClick={() => navigate('/agreements')}
                className="px-5 py-2 rounded-lg bg-[#008037] hover:bg-[#00662c] text-white text-xs font-bold shadow-sm transition-colors cursor-pointer"
              >
                View My Agreements &rarr;
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. Owner Edit Property Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title={`Edit Property: ${propertyTitle}`}
      >
        <PropertyForm
          initialData={currentProperty}
          onSubmit={handleUpdatePropertyDetails}
          onCancel={() => setIsEditModalOpen(false)}
          isLoading={isUpdating}
        />
      </Modal>

      {/* 9. Owner Delete Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Confirm Property Deletion"
      >
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-800 space-y-2">
            <h4 className="text-sm font-bold text-rose-900">Are you sure you want to delete this property?</h4>
            <p>
              You are about to permanently remove <strong>"{propertyTitle}"</strong>. All associated photos and listing details will be deleted.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsDeleteModalOpen(false)}
              className="px-4 py-2 rounded-xl border border-gray-300 text-xs font-bold text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDeletePropertyDetails}
              disabled={isDeleting}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-sm transition-colors"
            >
              {isDeleting ? 'Deleting...' : 'Yes, Delete Property'}
            </button>
          </div>
        </div>
      </Modal>

      {/* 10. Property Inspection Modal (Full inspection matching My Properties) */}
      <PropertyInspectModal
        isOpen={isInspectModalOpen}
        onClose={() => setIsInspectModalOpen(false)}
        property={currentProperty}
        user={user}
        onEdit={() => {
          setIsInspectModalOpen(false);
          setIsEditModalOpen(true);
        }}
      />

    </div>
  );
};
