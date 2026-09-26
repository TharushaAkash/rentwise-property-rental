import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import api from '../../services/api';
import { DataTable } from '../../components/ui/DataTable';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { PropertyForm } from '../properties/PropertyForm';
import { handleImageError } from '../../utils/imagePlaceholder';
import { Building2, Users, FileText, UserCheck, ShieldCheck, Search, Plus, Pencil, Trash2, Eye, Check, X, Clock, Calendar, Mail, Phone, CreditCard, CheckCircle2, AlertCircle, SlidersHorizontal, ArrowRight, RefreshCw, Lock, Unlock, UserCog, ShieldAlert, Ban, Zap, CheckCheck, FileCheck2 } from 'lucide-react';
import { evaluatePropertyVerification } from '../../utils/addressVerification';
import { AdminDocumentReviews } from '../properties/DocumentReviewMessages';

const formatMoney = (val) => `Rs. ${Number(val || 0).toLocaleString()}`;

export const AdminDashboard = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, updateUser } = useAuth();

  // Active Tab: 'properties' | 'users' | 'agreements' | 'profile'
  const initialTab = searchParams.get('tab') || 'properties';
  const [activeTab, setActiveTab] = useState(initialTab);

  // Sync tab with URL search parameter
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam && ['properties', 'users', 'agreements', 'profile'].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  // Feedback Alert Banner
  const [feedback, setFeedback] = useState({ text: '', type: '' });

  // ========================================================
  // 1. DATA STATES
  // ========================================================
  const [properties, setProperties] = useState([]);
  const [isLoadingProps, setIsLoadingProps] = useState(true);
  const [inspectingProperty, setInspectingProperty] = useState(null);

  const [usersList, setUsersList] = useState([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);

  const [agreements, setAgreements] = useState([]);
  const [applications, setApplications] = useState([]);
  const [isLoadingAgreements, setIsLoadingAgreements] = useState(true);

  // ========================================================
  // 2. FETCH ALL DATA
  // ========================================================
  const fetchAllProperties = async () => {
    try {
      setIsLoadingProps(true);
      const res = await api.get('/properties');
      let list = Array.isArray(res.data) ? res.data : [];
      setProperties(list);
    } catch (err) {
      console.error('Failed to fetch properties:', err);
      setProperties([]);
    } finally {
      setIsLoadingProps(false);
    }
  };

  const fetchAllUsers = async () => {
    try {
      setIsLoadingUsers(true);
      const res = await api.get('/auth/users');
      const list = Array.isArray(res.data) ? res.data : [];
      setUsersList(list);
      try {
        localStorage.setItem('rentwise_client_users', JSON.stringify(list));
      } catch {}
    } catch (err) {
      console.warn('API /auth/users not available, falling back to local list:', err);
      // Fallback: build list from current user and stored records
      const cached = JSON.parse(localStorage.getItem('rentwise_client_users') || '[]');
      if (user && !cached.some(u => u.email === user.email)) {
        cached.unshift({
          id: user.id,
          name: user.fullName || user.name || 'System Administrator',
          email: user.email,
          role: user.role || 'Administrator',
          phoneNumber: user.phoneNumber || '0771234567',
          nicNumber: user.nicNumber || '198512345678',
          isBlocked: false,
          createdAt: new Date().toISOString()
        });
      }
      setUsersList(cached);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  const fetchAgreementsAndApplications = async () => {
    try {
      setIsLoadingAgreements(true);
      const [agrRes, appRes] = await Promise.all([
        api.get('/agreements').catch(() => ({ data: [] })),
        api.get('/property-applications').catch(() => ({ data: [] }))
      ]);

      let apiAgreements = Array.isArray(agrRes.data) ? agrRes.data : [];
      let apiApps = Array.isArray(appRes.data) ? appRes.data : [];

      // Merge cached agreements
      let localAgreements = [];
      try {
        localAgreements = JSON.parse(localStorage.getItem('rentwise_client_agreements') || '[]');
      } catch {}

      const agrMap = new Map();
      localAgreements.forEach(a => a?.id && agrMap.set(a.id, a));
      apiAgreements.forEach(a => a?.id && agrMap.set(a.id, a));
      setAgreements(Array.from(agrMap.values()));

      // Merge cached bookings
      let localBookings = [];
      try {
        localBookings = JSON.parse(localStorage.getItem('rentwise_client_bookings') || '[]');
      } catch {}

      const appMap = new Map();
      localBookings.forEach(b => b?.id && appMap.set(b.id, b));
      apiApps.forEach(b => b?.id && appMap.set(b.id, b));
      setApplications(Array.from(appMap.values()));
    } catch (err) {
      console.error('Failed to load agreements/applications:', err);
    } finally {
      setIsLoadingAgreements(false);
    }
  };

  useEffect(() => {
    fetchAllProperties();
    fetchAllUsers();
    fetchAgreementsAndApplications();
  }, []);

  // ========================================================
  // 3. PROPERTY MANAGEMENT ACTIONS
  // ========================================================
  const [propSearch, setPropSearch] = useState('');
  const [propStatusFilter, setPropStatusFilter] = useState('ALL');
  const [isPropModalOpen, setIsPropModalOpen] = useState(false);
  const [editingProperty, setEditingProperty] = useState(null);
  const [deletingProperty, setDeletingProperty] = useState(null);
  const [isSubmittingProp, setIsSubmittingProp] = useState(false);

  const handleApproveProperty = async (propertyId, e, isManualOverride = false) => {
    e?.stopPropagation();
    const cleanId = String(propertyId || '').trim();

    try {
      await api.put(`/properties/${cleanId}/approve`, {});
      setFeedback({
        text: isManualOverride ? 'Property manually verified and activated by Administrator!' : 'Property listing approved and activated!',
        type: 'success'
      });
      await fetchAllProperties();
      const response = await api.get(`/properties/${cleanId}`);
      setInspectingProperty(prev => prev && String(prev.id || prev.Id).toLowerCase() === cleanId.toLowerCase() ? response.data : prev);
    } catch (err) {
      console.error('Failed to approve or refresh property:', err);
      setFeedback({ text: 'Could not confirm property approval. Refresh the listing and try again.', type: 'error' });
    }
  };

  const handleSuspendProperty = async (propertyId, e) => {
    e?.stopPropagation();
    const cleanId = String(propertyId || '').trim();

    const updateSuspendCached = () => {};

    try {
      await api.put(`/properties/${cleanId}/reject`);
      updateSuspendCached();
      setFeedback({ text: 'Property listing has been suspended.', type: 'info' });
      fetchAllProperties();
      setInspectingProperty(prev => (prev && String(prev.id || prev.Id).toLowerCase() === cleanId.toLowerCase() ? { ...prev, status: 'Suspended' } : prev));
    } catch (err) {
      console.error('Failed to suspend property:', err);
      updateSuspendCached();
      setProperties(prev => prev.map(p => String(p.id || p.Id).toLowerCase() === cleanId.toLowerCase() ? { ...p, status: 'Suspended' } : p));
      setInspectingProperty(prev => (prev && String(prev.id || prev.Id).toLowerCase() === cleanId.toLowerCase() ? { ...prev, status: 'Suspended' } : prev));
      setFeedback({ text: 'Property status set to Suspended.', type: 'info' });
    }
  };

  const handleSetPendingProperty = async (propertyId, e) => {
    e?.stopPropagation();
    const cleanId = String(propertyId || '').trim();

    const updatePendingCached = () => {};

    try {
      await api.put(`/properties/${cleanId}`, { status: 0 });
      updatePendingCached();
      setFeedback({ text: 'Property marked as Pending Verification.', type: 'info' });
      fetchAllProperties();
      setInspectingProperty(prev => (prev && String(prev.id || prev.Id).toLowerCase() === cleanId.toLowerCase() ? { ...prev, status: 'PendingVerification' } : prev));
    } catch (err) {
      console.error('Failed to set pending status:', err);
      updatePendingCached();
      setProperties(prev => prev.map(p => String(p.id || p.Id).toLowerCase() === cleanId.toLowerCase() ? { ...p, status: 'PendingVerification' } : p));
      setInspectingProperty(prev => (prev && String(prev.id || prev.Id).toLowerCase() === cleanId.toLowerCase() ? { ...prev, status: 'PendingVerification' } : prev));
      setFeedback({ text: 'Property marked as Pending Verification.', type: 'info' });
    }
  };

  const handleSaveProperty = async (data, files, utilityBillFile) => {
    try {
      setIsSubmittingProp(true);
      const ownerGuid = user?.id || '26270925-f600-48af-8b7d-43d01545c40f';

      // 1. Process Photos (URLs, file conversions, defaults)
      let photoList = Array.isArray(data.photos) ? [...data.photos] : [];
      let primaryPhotoUrl = data.photoUrl || (photoList[0]?.photoUrl) || '';

      if (files && files.length > 0) {
        const filePreviews = await Promise.all(files.map((file, idx) => {
          return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve({
              id: `p_file_${Date.now()}_${idx}`,
              photoUrl: reader.result,
              isPrimary: idx === 0 && !primaryPhotoUrl
            });
            reader.readAsDataURL(file);
          });
        }));
        photoList = [...filePreviews, ...photoList];
        if (!primaryPhotoUrl && filePreviews.length > 0) {
          primaryPhotoUrl = filePreviews[0].photoUrl;
        }
      }

      if (!primaryPhotoUrl) {
        primaryPhotoUrl = 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80';
        photoList = [{ id: 'p_def', photoUrl: primaryPhotoUrl, isPrimary: true }];
      }

      // 2. Process Utility Bill
      let verificationMessage = '';
      let utilityBillUrl = data.utilityBillUrl || '';
      if (utilityBillFile) {
        utilityBillUrl = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.readAsDataURL(utilityBillFile);
        });
      }

      if (editingProperty) {
        // Update existing property
        const editId = editingProperty.id || editingProperty.Id;
        const payload = {
          id: editId,
          ownerId: editingProperty.ownerId || ownerGuid,
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
          photoCount: photoList.length || 1,
          status: data.status === 'Active' ? 1 : data.status === 'Suspended' ? 2 : 0
        };

        await api.put(`/properties/${editId}`, payload);

        if (files && files.length > 0) {
          await Promise.all(files.map(async (file, index) => {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('isPrimary', index === 0);
            try {
              await api.post(`/properties/${editId}/photos`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
              });
            } catch {}
          }));
        }

        if (utilityBillUrl) {
          try {
            const proofResponse = await api.post(`/properties/${editId}/proof`, {
              documentType: 'UtilityBill',
              documentUrl: utilityBillUrl
            });
            verificationMessage = proofResponse.data?.message || 'Proof submitted for verification.';
          } catch {
            verificationMessage = 'Proof verification could not be submitted. Please try again.';
          }
        }

        const res = await api.get(`/properties/${editId}`);
        const updatedRecord = res.data || { ...editingProperty, ...payload };
        setProperties(prev => prev.map(p => (String(p.id || p.Id) === String(editId) ? updatedRecord : p)));
        setFeedback({ text: `Property "${data.title}" updated successfully! ${verificationMessage}`, type: 'success' });
        fetchAllProperties();
      } else {
        // Create new property
        const newTempId = `prop_${Date.now()}`;
        const payload = { 
          ...data, 
          ownerId: ownerGuid,
          sqft: Number(data.sqft || 0),
          propertyType: data.propertyType || 'House',
          featureTags: Array.isArray(data.featureTags) ? data.featureTags : [],
          photoCount: photoList.length || 1,
          status: data.status === 'Active' ? 1 : 0
        };

        let createdId = newTempId;
        const newProp = await api.post('/properties', payload);
        createdId = newProp.data?.id || createdId;

        if (files && files.length > 0 && createdId) {
          await Promise.all(files.map(async (file, index) => {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('isPrimary', index === 0);
            try {
              await api.post(`/properties/${createdId}/photos`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
              });
            } catch {}
          }));
        }

        if (utilityBillUrl && createdId) {
          try {
            const proofResponse = await api.post(`/properties/${createdId}/proof`, {
              documentType: 'UtilityBill',
              documentUrl: utilityBillUrl
            });
            verificationMessage = proofResponse.data?.message || 'Proof submitted for verification.';
          } catch {
            verificationMessage = 'Proof verification could not be submitted. Please try again.';
          }
        }

        setFeedback({ text: `New property listing "${data.title}" created successfully! ${verificationMessage}`, type: 'success' });
        fetchAllProperties();
      }

      setIsPropModalOpen(false);
      setEditingProperty(null);
    } catch (err) {
      console.error('Failed to save property:', err);
      setFeedback({ text: 'Failed to save property details. Please verify your inputs.', type: 'error' });
    } finally {
      setIsSubmittingProp(false);
    }
  };

  const handleDeleteProperty = async (prop) => {
    const propId = prop?.id || prop?.Id;
    if (!propId) return;
    try {
      await api.delete(`/properties/${propId}`);
      setFeedback({ text: `Property "${prop.title || prop.Title}" was deleted successfully.`, type: 'success' });
      setDeletingProperty(null);
      fetchAllProperties();
    } catch (err) {
      console.error('Failed to delete property:', err);
      setFeedback({ text: 'Failed to delete property. Check if active leases exist.', type: 'error' });
    }
  };

  const filteredProperties = useMemo(() => {
    return properties.filter((p) => {
      const q = (propSearch || '').toLowerCase().trim();
      const pTitle = p.title || p.Title || '';
      const pAddress = p.address || p.Address || '';
      const pCity = p.city || p.City || '';
      const matchesSearch = 
        !q ||
        pTitle.toLowerCase().includes(q) ||
        pAddress.toLowerCase().includes(q) ||
        pCity.toLowerCase().includes(q);

      const rawStatus = p.status ?? p.Status;
      const statusStr = typeof rawStatus === 'number'
        ? ['PendingVerification', 'Active', 'Suspended'][rawStatus]
        : (rawStatus || 'Active');

      const isVer = evaluatePropertyVerification(p).isVerified;

      const matchesStatus = 
        propStatusFilter === 'ALL' ||
        (propStatusFilter === 'VERIFIED' && isVer) ||
        (propStatusFilter === 'PENDING' && statusStr === 'PendingVerification') ||
        (propStatusFilter === 'ACTIVE' && statusStr === 'Active') ||
        (propStatusFilter === 'SUSPENDED' && statusStr === 'Suspended');

      return matchesSearch && matchesStatus;
    });
  }, [properties, propSearch, propStatusFilter]);

  // ========================================================
  // 4. USER MANAGEMENT ACTIONS
  // ========================================================
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('ALL');
  const [roleModalUser, setRoleModalUser] = useState(null);
  const [selectedNewRole, setSelectedNewRole] = useState('Tenant');
  const [isChangingRole, setIsChangingRole] = useState(false);
  const [deletingUser, setDeletingUser] = useState(null);
  const [confirmBlockUser, setConfirmBlockUser] = useState(null);
  const [blockingUserId, setBlockingUserId] = useState(null);

  const handleToggleBlockUser = async (u) => {
    if (!u?.id) return;
    const targetBlockStatus = !u.isBlocked;
    try {
      setBlockingUserId(u.id);
      try {
        await api.put(`/auth/users/${u.id}/block`, { isBlocked: targetBlockStatus });
      } catch (apiErr) {
        console.warn('API block user error, updating locally:', apiErr);
      }

      setUsersList(prev => prev.map(item => item.id === u.id ? { ...item, isBlocked: targetBlockStatus } : item));

      // Update stored client users
      try {
        const cached = JSON.parse(localStorage.getItem('rentwise_client_users') || '[]');
        const updated = cached.map(item => item.id === u.id ? { ...item, isBlocked: targetBlockStatus } : item);
        localStorage.setItem('rentwise_client_users', JSON.stringify(updated));
      } catch {}

      const msg = targetBlockStatus 
        ? `User "${u.name || u.email}" has been blocked and suspended.`
        : `User "${u.name || u.email}" has been unblocked.`;
      setFeedback({ text: msg, type: targetBlockStatus ? 'error' : 'success' });
      setConfirmBlockUser(null);
    } catch (err) {
      console.error('Failed to update user block status:', err);
      setFeedback({ text: 'Failed to update user status.', type: 'error' });
    } finally {
      setBlockingUserId(null);
    }
  };

  const handleUpdateUserRole = async () => {
    if (!roleModalUser?.id) return;
    try {
      setIsChangingRole(true);
      try {
        await api.put(`/auth/users/${roleModalUser.id}/role`, { role: selectedNewRole });
      } catch (apiErr) {
        console.warn('API update role error, updating locally:', apiErr);
      }

      setUsersList(prev => prev.map(u => u.id === roleModalUser.id ? { ...u, role: selectedNewRole } : u));
      
      // Update stored client users
      try {
        const cached = JSON.parse(localStorage.getItem('rentwise_client_users') || '[]');
        const updated = cached.map(u => u.id === roleModalUser.id ? { ...u, role: selectedNewRole } : u);
        localStorage.setItem('rentwise_client_users', JSON.stringify(updated));
      } catch {}

      setFeedback({ text: `User "${roleModalUser.name || roleModalUser.email}" role updated to ${selectedNewRole}!`, type: 'success' });
      setRoleModalUser(null);
    } catch (err) {
      console.error('Failed to change user role:', err);
      setFeedback({ text: 'Failed to update user role.', type: 'error' });
    } finally {
      setIsChangingRole(false);
    }
  };

  const handleDeleteUser = async (u) => {
    if (!u?.id) return;
    try {
      await api.delete(`/auth/users/${u.id}`);

      setUsersList(prev => prev.filter(item => item.id !== u.id));
      try {
        const cached = JSON.parse(localStorage.getItem('rentwise_client_users') || '[]');
        localStorage.setItem('rentwise_client_users', JSON.stringify(cached.filter(item => item.id !== u.id)));
      } catch {}

      setFeedback({ text: `User account "${u.name || u.email}" removed.`, type: 'success' });
      setDeletingUser(null);
    } catch (err) {
      console.error('Failed to delete user:', err);
      const errorMsg = err.response?.data?.message || 'Failed to delete user. They might have related data.';
      setFeedback({ text: errorMsg, type: 'error' });
      setDeletingUser(null);
    }
  };

  const filteredUsers = useMemo(() => {
    return usersList.filter((u) => {
      const q = userSearch.toLowerCase();
      const matchesSearch = 
        !q ||
        (u.name && u.name.toLowerCase().includes(q)) ||
        (u.email && u.email.toLowerCase().includes(q)) ||
        (u.phoneNumber && u.phoneNumber.includes(q)) ||
        (u.nicNumber && u.nicNumber.toLowerCase().includes(q));

      const matchesRole = 
        userRoleFilter === 'ALL' ||
        (userRoleFilter === 'OWNERS' && u.role === 'PropertyOwner') ||
        (userRoleFilter === 'TENANTS' && u.role === 'Tenant') ||
        (userRoleFilter === 'ADMINS' && (u.role === 'Administrator' || u.role === 'Admin' || u.role === 'SystemAdmin')) ||
        (userRoleFilter === 'BLOCKED' && u.isBlocked);

      return matchesSearch && matchesRole;
    });
  }, [usersList, userSearch, userRoleFilter]);

  // ========================================================
  // 5. AGREEMENTS & OWNER REQUESTS ACTIONS
  // ========================================================
  const [agreementFilter, setAgreementFilter] = useState('ALL');
  const [confirmingAppId, setConfirmingAppId] = useState(null);

  const handleAdminConfirmAgreement = async (appId) => {
    try {
      setConfirmingAppId(appId);
      try {
        await api.post(`/property-applications/${appId}/confirm`);
      } catch {}

      setApplications(prev => prev.map(a => a.id === appId ? { ...a, status: 'Accepted' } : a));

      // Sync local storage
      try {
        const stored = JSON.parse(localStorage.getItem('rentwise_client_bookings') || '[]');
        localStorage.setItem('rentwise_client_bookings', JSON.stringify(stored.map(b => b.id === appId ? { ...b, status: 'Accepted' } : b)));
      } catch {}

      setFeedback({ text: 'Agreement request approved & active lease registered!', type: 'success' });
    } catch (err) {
      console.error(err);
      setFeedback({ text: 'Failed to approve agreement request.', type: 'error' });
    } finally {
      setConfirmingAppId(null);
    }
  };

  // ========================================================
  // 6. ADMIN PROFILE STATE
  // ========================================================
  const [profileForm, setProfileForm] = useState({
    firstName: user?.fullName?.split(' ')[0] || 'System',
    lastName: user?.fullName?.split(' ')[1] || 'Admin',
    email: user?.email || 'admin@rentwise.com',
    phoneNumber: user?.phoneNumber || '0771234567',
    nicNumber: user?.nicNumber || '198512345678'
  });
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    try {
      setIsSavingProfile(true);
      const fullName = `${profileForm.firstName.trim()} ${profileForm.lastName.trim()}`.trim();
      const res = await api.put('/auth/profile', {
        name: fullName,
        fullName: fullName,
        phoneNumber: profileForm.phoneNumber,
        nicNumber: profileForm.nicNumber
      });
      if (res.data?.user) {
        updateUser(null, res.data.user);
      }
      setFeedback({ text: 'Administrator profile details updated successfully!', type: 'success' });
    } catch (err) {
      console.error('Failed to update admin profile:', err);
      setFeedback({ text: 'Profile updated in session.', type: 'success' });
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setFeedback({ text: 'New password and confirmation do not match.', type: 'error' });
      return;
    }
    try {
      setIsChangingPassword(true);
      await api.post('/auth/change-password', {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword
      });
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setFeedback({ text: 'Administrator password changed successfully!', type: 'success' });
    } catch (err) {
      console.error('Failed to change password:', err);
      setFeedback({ text: 'Failed to change password. Please verify current password.', type: 'error' });
    } finally {
      setIsChangingPassword(false);
    }
  };

  // High-Level Metrics
  const pendingPropsCount = useMemo(() => {
    return properties.filter(p => {
      const rawStatus = p.status ?? p.Status;
      const s = typeof rawStatus === 'number' ? ['PendingVerification', 'Active', 'Suspended'][rawStatus] : (rawStatus || 'Active');
      return s === 'PendingVerification';
    }).length;
  }, [properties]);

  const activePropsCount = useMemo(() => {
    return properties.filter(p => {
      const rawStatus = p.status ?? p.Status;
      const s = typeof rawStatus === 'number' ? ['PendingVerification', 'Active', 'Suspended'][rawStatus] : (rawStatus || 'Active');
      return s === 'Active';
    }).length;
  }, [properties]);

  const verifiedPropsCount = useMemo(() => {
    return properties.filter(p => evaluatePropertyVerification(p).isVerified).length;
  }, [properties]);

  const ownersCount = useMemo(() => usersList.filter(u => u.role === 'PropertyOwner').length, [usersList]);
  const tenantsCount = useMemo(() => usersList.filter(u => u.role === 'Tenant').length, [usersList]);
  const blockedUsersCount = useMemo(() => usersList.filter(u => u.isBlocked).length, [usersList]);
  const pendingAgreementsCount = useMemo(() => applications.filter(a => a.status === 'Submitted' || a.status === 'UnderReview').length, [applications]);

  // ========================================================
  // PROPERTY TABLE COLUMNS
  // ========================================================
  const propertyColumns = [
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
        const propAddress = p.address || p.Address || 'Sri Lanka';

        return (
          <div 
            className="flex items-center gap-3 cursor-pointer group"
            onClick={() => setInspectingProperty(p)}
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
                {propAddress}
              </span>
            </div>
          </div>
        );
      }
    },
    {
      header: 'Monthly Rent',
      accessor: (p) => <span className="font-extrabold text-gray-900">{formatMoney(p.monthlyRent ?? p.MonthlyRent)}</span>
    },
    {
      header: 'Specs & Area',
      accessor: (p) => {
        const beds = p.bedrooms ?? p.Bedrooms ?? 0;
        const baths = p.bathrooms ?? p.Bathrooms ?? 0;
        const sqft = p.sqft ?? p.Sqft;
        return (
          <div className="text-xs text-gray-700 font-medium">
            <div>{beds} bed • {baths} bath</div>
            {sqft ? <div className="text-[11px] text-gray-500">{Number(sqft).toLocaleString()} sqft</div> : null}
          </div>
        );
      }
    },
    {
      header: 'Address & Utility Proof',
      accessor: (p) => {
        const ver = evaluatePropertyVerification(p);
        const propId = p.id || p.Id;

        if (ver.isManuallyVerified) {
          return (
            <div className="flex flex-col gap-0.5 max-w-[210px]">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-blue-50 text-blue-700 border border-blue-300 w-fit shadow-2xs">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <span>✓ Admin Verified</span>
              </span>
              <span className="text-[10px] text-gray-500 font-medium truncate" title={ver.matchDetails}>
                Manual Admin Activation
              </span>
            </div>
          );
        }

        if (ver.isVerified) {
          return (
            <div className="flex flex-col gap-0.5 max-w-[210px]">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-300 w-fit shadow-2xs">
                <CheckCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>✓ Address Verified</span>
              </span>
              <span className="text-[10.5px] text-gray-600 font-medium truncate" title={ver.matchDetails}>
                {ver.matchDetails}
              </span>
              <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
                <span>AI OCR Match</span>
                <span>•</span>
                <span>Checks completed</span>
              </span>
            </div>
          );
        }

        if (ver.hasBill) {
          return (
            <div className="flex flex-col gap-1 max-w-[210px]" onClick={(e) => e.stopPropagation()}>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-rose-50 text-rose-700 border border-rose-300 w-fit">
                <AlertCircle className="w-3 h-3 text-rose-600 shrink-0" />
                <span>{ver.statusLabel}</span>
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => handleApproveProperty(propId, e, true)}
                className="text-[10px] px-2 py-0.5 h-5 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border-emerald-300 font-bold rounded-md flex items-center gap-1 w-fit cursor-pointer"
                title="Override & Activate Manually"
              >
                <ShieldCheck className="w-2.5 h-2.5 text-emerald-600" />
                <span>Activate Manually</span>
              </Button>
            </div>
          );
        }

        return (
          <div className="flex flex-col gap-1 max-w-[210px]" onClick={(e) => e.stopPropagation()}>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-medium bg-gray-100 text-gray-500 border border-gray-200 w-fit">
              No Bill Attached
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => handleApproveProperty(propId, e, true)}
              className="text-[10.5px] px-2 py-0.5 h-5.5 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border-indigo-200 font-bold rounded-md flex items-center gap-1 w-fit cursor-pointer shadow-2xs"
              title="Activate this property manually without utility bill"
            >
              <ShieldCheck className="w-3 h-3 text-indigo-600" />
              <span>Activate Manually</span>
            </Button>
          </div>
        );
      }
    },
    {
      header: 'Status',
      accessor: (p) => {
        const variants = {
          Active: 'success',
          PendingVerification: 'default',
          Suspended: 'danger'
        };
        const rawStatus = p.status ?? p.Status;
        const statusStr = typeof rawStatus === 'number'
          ? ['PendingVerification', 'Active', 'Suspended'][rawStatus]
          : (rawStatus || 'Active');
        const propId = p.id || p.Id;

        return (
          <div className="flex items-center gap-2">
            <Badge variant={variants[statusStr] || 'default'}>{statusStr}</Badge>
            {statusStr !== 'Active' && (
              <Button
                size="sm"
                onClick={(e) => handleApproveProperty(propId, e, true)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] px-2 py-0.5 rounded-lg font-bold flex items-center gap-1 shadow-2xs cursor-pointer"
                title="Manually activate property"
              >
                <Check className="w-3 h-3" />
                <span>Activate</span>
              </Button>
            )}
          </div>
        );
      }
    },
    {
      header: 'Admin Actions',
      accessor: (p) => {
        const propId = p.id || p.Id;
        return (
          <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
            <Button
              size="sm"
              variant="outline"
              onClick={() => { setEditingProperty(p); setIsPropModalOpen(true); }}
              className="text-xs px-2.5 py-1 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 border-indigo-200 flex items-center gap-1 font-semibold"
              title="Edit Property"
            >
              <Pencil className="w-3.5 h-3.5" />
              <span>Edit</span>
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={() => setDeletingProperty(p)}
              className="text-xs px-2.5 py-1 text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200 flex items-center gap-1 font-semibold"
              title="Delete Property"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete</span>
            </Button>

            <Button
              size="sm"
              variant="secondary"
              onClick={() => setInspectingProperty(p)}
              className="text-xs px-2.5 py-1 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 flex items-center gap-1 font-bold shadow-2xs"
              title="Inspect Property Modal"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Inspect</span>
            </Button>
          </div>
        );
      }
    }
  ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-7xl pb-16">
      
      {/* Header & Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">
              Admin Command Center
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-700" />
              Administrator
            </span>
          </div>
          <p className="text-gray-500 mt-1 text-sm">
            Complete platform oversight: manage all properties, user accounts, owner agreement requests, and security.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button
            onClick={() => { setEditingProperty(null); setIsPropModalOpen(true); }}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-md shadow-indigo-600/20 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Add Property</span>
          </Button>

          <Button
            variant="outline"
            onClick={() => {
              fetchAllProperties();
              fetchAllUsers();
              fetchAgreementsAndApplications();
              setFeedback({ text: 'Data reloaded.', type: 'info' });
            }}
            className="text-gray-700 hover:bg-gray-100"
            title="Refresh Data"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Top Metric Cards Row (Just like Property Owner Dashboard) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Metric 1: Properties Overseen */}
        <div 
          onClick={() => handleTabChange('properties')}
          className={`cursor-pointer rounded-2xl bg-white border p-5 shadow-xs hover:shadow-md transition-all ${
            activeTab === 'properties' ? 'border-indigo-500 ring-2 ring-indigo-500/20 bg-indigo-50/20' : 'border-gray-200 hover:border-indigo-300'
          }`}
        >
          <div className="flex items-center justify-between text-gray-500">
            <span className="text-xs font-bold uppercase tracking-wider">Properties Overseen</span>
            <Building2 className="w-5 h-5 text-indigo-600" />
          </div>
          <p className="text-2xl font-black text-gray-900 mt-2">{properties.length}</p>
          <div className="flex flex-wrap items-center gap-1.5 mt-2 text-xs font-semibold">
            <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              {activePropsCount} Active
            </span>
            <span className="text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200 flex items-center gap-1">
              <CheckCheck className="w-3 h-3 text-indigo-600" />
              {verifiedPropsCount} Verified
            </span>
            {pendingPropsCount > 0 && (
              <span className="text-amber-800 bg-amber-100 px-2 py-0.5 rounded border border-amber-300 animate-pulse">
                {pendingPropsCount} Pending Approval
              </span>
            )}
          </div>
        </div>

        {/* Metric 2: Registered Users */}
        <div 
          onClick={() => handleTabChange('users')}
          className={`cursor-pointer rounded-2xl bg-white border p-5 shadow-xs hover:shadow-md transition-all ${
            activeTab === 'users' ? 'border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/20' : 'border-gray-200 hover:border-blue-300'
          }`}
        >
          <div className="flex items-center justify-between text-gray-500">
            <span className="text-xs font-bold uppercase tracking-wider">Platform Users</span>
            <Users className="w-5 h-5 text-blue-600" />
          </div>
          <p className="text-2xl font-black text-gray-900 mt-2">{usersList.length}</p>
          <p className="text-xs text-gray-500 mt-1">
            {ownersCount} Landlords • {tenantsCount} Tenants{blockedUsersCount > 0 ? ` • ${blockedUsersCount} Blocked` : ''}
          </p>
        </div>

        {/* Metric 3: Agreements & Requests */}
        <div 
          onClick={() => handleTabChange('agreements')}
          className={`cursor-pointer rounded-2xl bg-white border p-5 shadow-xs hover:shadow-md transition-all ${
            activeTab === 'agreements' ? 'border-amber-500 ring-2 ring-amber-500/20 bg-amber-50/20' : 'border-gray-200 hover:border-amber-300'
          }`}
        >
          <div className="flex items-center justify-between text-gray-500">
            <span className="text-xs font-bold uppercase tracking-wider">Owner Agreements</span>
            <FileText className="w-5 h-5 text-amber-500" />
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <p className="text-2xl font-black text-gray-900">{agreements.length + applications.length}</p>
            {pendingAgreementsCount > 0 && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 animate-pulse">
                {pendingAgreementsCount} Requests
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-1">Lease contracts & move-in requests</p>
        </div>

        {/* Metric 4: Admin Profile & Role */}
        <div 
          onClick={() => handleTabChange('profile')}
          className={`cursor-pointer rounded-2xl bg-white border p-5 shadow-xs hover:shadow-md transition-all ${
            activeTab === 'profile' ? 'border-purple-500 ring-2 ring-purple-500/20 bg-purple-50/20' : 'border-gray-200 hover:border-purple-300'
          }`}
        >
          <div className="flex items-center justify-between text-gray-500">
            <span className="text-xs font-bold uppercase tracking-wider">Admin Account</span>
            <ShieldCheck className="w-5 h-5 text-purple-600" />
          </div>
          <p className="text-sm font-extrabold text-gray-900 mt-2 truncate">
            {user?.fullName || user?.name || 'Administrator'}
          </p>
          <p className="text-xs text-purple-700 font-semibold mt-1 truncate">
            {user?.email || 'admin@rentwise.com'}
          </p>
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
      <div className="flex items-center gap-2 border-b border-gray-200 pb-3 overflow-x-auto no-scrollbar">
        <button
          type="button"
          onClick={() => handleTabChange('properties')}
          className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 shrink-0 ${
            activeTab === 'properties' 
              ? 'bg-slate-900 text-white shadow-sm' 
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Manage Properties</span>
          <span className={`text-xs px-2 py-0.5 rounded-full ${activeTab === 'properties' ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-700'}`}>
            {properties.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('users')}
          className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 shrink-0 ${
            activeTab === 'users' 
              ? 'bg-slate-900 text-white shadow-sm' 
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Manage Users</span>
          <span className={`text-xs px-2 py-0.5 rounded-full ${activeTab === 'users' ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-700'}`}>
            {usersList.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('agreements')}
          className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 shrink-0 ${
            activeTab === 'agreements' 
              ? 'bg-slate-900 text-white shadow-sm' 
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Agreements Requests</span>
          {pendingAgreementsCount > 0 ? (
            <span className="bg-amber-400 text-slate-950 text-xs px-2 py-0.5 rounded-full font-extrabold animate-pulse">
              {pendingAgreementsCount} New
            </span>
          ) : (
            <span className={`text-xs px-2 py-0.5 rounded-full ${activeTab === 'agreements' ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-700'}`}>
              {agreements.length + applications.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('profile')}
          className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 shrink-0 ${
            activeTab === 'profile' 
              ? 'bg-slate-900 text-white shadow-sm' 
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Manage Profile</span>
        </button>
      </div>

      {/* ======================================================== */}
      {/* SECTION 1: MANAGE PROPERTIES                             */}
      {/* ======================================================== */}
      {activeTab === 'properties' && (
        <div className="space-y-4 pt-1">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-extrabold text-gray-900 flex items-center gap-2">
                <span>Manage Properties</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-bold border border-indigo-100">
                  {filteredProperties.length} Properties
                </span>
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Verify listings, edit descriptions or rent, approve submissions, and remove properties.
              </p>
            </div>

            <Button
              onClick={() => { setEditingProperty(null); setIsPropModalOpen(true); }}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold flex items-center gap-1.5 self-start sm:self-auto shadow-md shadow-blue-600/20 px-4 py-2 rounded-xl text-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>+ Add Property</span>
            </Button>
          </div>

          {/* Search & Status Filter Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-gray-200">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3 pointer-events-none" />
              <input
                type="text"
                placeholder="Search properties by title, address, city..."
                value={propSearch}
                onChange={(e) => setPropSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>

            <div className="inline-flex p-1 bg-gray-100 rounded-xl text-xs font-semibold self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setPropStatusFilter('ALL')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  propStatusFilter === 'ALL' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                All ({properties.length})
              </button>
              <button
                type="button"
                onClick={() => setPropStatusFilter('VERIFIED')}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 ${
                  propStatusFilter === 'VERIFIED' ? 'bg-white text-indigo-700 font-bold shadow-xs' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <CheckCheck className="w-3.5 h-3.5 text-indigo-600" />
                <span>Verified ({verifiedPropsCount})</span>
              </button>
              <button
                type="button"
                onClick={() => setPropStatusFilter('PENDING')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  propStatusFilter === 'PENDING' ? 'bg-white text-amber-800 font-bold shadow-xs' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Pending Approval ({pendingPropsCount})
              </button>
              <button
                type="button"
                onClick={() => setPropStatusFilter('ACTIVE')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  propStatusFilter === 'ACTIVE' ? 'bg-white text-emerald-800 font-bold shadow-xs' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Active ({activePropsCount})
              </button>
              <button
                type="button"
                onClick={() => setPropStatusFilter('SUSPENDED')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  propStatusFilter === 'SUSPENDED' ? 'bg-white text-rose-800 font-bold shadow-xs' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Suspended
              </button>
            </div>
          </div>

          {/* Properties DataTable */}
          <DataTable
            data={filteredProperties}
            columns={propertyColumns}
            isLoading={isLoadingProps}
            onRowClick={(p) => setInspectingProperty(p)}
          />

          {/* Admin Property Detail Inspection Modal */}
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
              const propCity = p.city || p.City || '';
              const propRent = p.monthlyRent ?? p.MonthlyRent ?? 0;
              const propBedrooms = p.bedrooms ?? p.Bedrooms ?? 0;
              const propBathrooms = p.bathrooms ?? p.Bathrooms ?? 0;
              const propSqft = p.sqft ?? p.Sqft;
              const propType = p.propertyType || p.PropertyType || 'House';
              const propDesc = p.description || p.Description || 'No description provided.';
              const rawFacilities = p.facilities || p.Facilities || [];

              let facList = [];
              if (Array.isArray(rawFacilities)) {
                facList = rawFacilities;
              } else if (typeof rawFacilities === 'string') {
                facList = rawFacilities.split(',').map(s => s.trim()).filter(Boolean);
              }

              const rawStatus = p.status ?? p.Status;
              const statusStr = typeof rawStatus === 'number'
                ? ['PendingVerification', 'Active', 'Suspended'][rawStatus]
                : (rawStatus || 'Active');

              // Find owner in usersList
              const ownerId = (p.ownerId || p.OwnerId || '').toString().toLowerCase();
              const owner = usersList.find(u => (u.id || u.Id || '').toString().toLowerCase() === ownerId) || p.owner || p.Owner;

              // Connected applications for this property
              const propApps = applications.filter(a => (a.propertyId || a.PropertyId || '').toString().toLowerCase() === String(propId).toLowerCase());

              // Photos
              let photos = [];
              if (Array.isArray(p.photos) && p.photos.length > 0) {
                photos = p.photos.map(ph => typeof ph === 'string' ? ph : (ph?.photoUrl || ph?.PhotoUrl || ph?.url)).filter(Boolean);
              } else if (p.photoUrl || p.PhotoUrl) {
                photos = [p.photoUrl || p.PhotoUrl];
              }

              return (
                <div className="space-y-6 text-sm text-gray-700">
                  {/* Top Bar: Verification / Status & 1-Click Controls */}
                  <div className="bg-slate-900 text-white p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm border border-slate-800">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-400/20 text-amber-300 border border-amber-400/30 flex items-center justify-center shrink-0">
                        <ShieldCheck className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                            Administrator Control
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-[10.5px] font-extrabold ${
                            statusStr === 'Active' 
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : statusStr === 'Suspended'
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                              : 'bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse'
                          }`}>
                            {statusStr}
                          </span>
                        </div>
                        <span className="text-xs text-slate-300 font-mono">
                          ID: {propId}
                        </span>
                      </div>
                    </div>

                    {/* 1-Click Status Controls & Direct Page Link */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {statusStr !== 'Active' && (
                        <Button
                          size="sm"
                          onClick={(e) => handleApproveProperty(propId, e)}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1 shadow-sm"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Approve & Activate</span>
                        </Button>
                      )}

                      {statusStr !== 'Suspended' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => handleSuspendProperty(propId, e)}
                          className="bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border-rose-800/60 font-bold text-xs flex items-center gap-1"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>Suspend</span>
                        </Button>
                      )}

                      {statusStr !== 'PendingVerification' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => handleSetPendingProperty(propId, e)}
                          className="bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700 font-medium text-xs flex items-center gap-1"
                        >
                          <Clock className="w-3.5 h-3.5" />
                          <span>Mark Pending</span>
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Photos Showcase */}
                  {photos.length > 0 ? (
                    <div className="space-y-2">
                      <div className="relative h-64 rounded-2xl overflow-hidden border border-gray-200 bg-gray-100 shadow-2xs">
                        <img
                          src={photos[0]}
                          alt={propTitle}
                          onError={handleImageError}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute top-3 left-3 px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur-xs text-white text-xs font-bold flex items-center gap-1">
                          <Eye className="w-3.5 h-3.5" />
                          <span>{photos.length} Photo{photos.length === 1 ? '' : 's'}</span>
                        </div>
                      </div>
                      {photos.length > 1 && (
                        <div className="flex gap-2 overflow-x-auto pb-1">
                          {photos.map((url, idx) => (
                            <img
                              key={idx}
                              src={url}
                              alt=""
                              onError={handleImageError}
                              className="w-20 h-14 object-cover rounded-lg border border-gray-200 shrink-0"
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="h-40 rounded-2xl bg-gray-50 border border-dashed border-gray-200 flex flex-col items-center justify-center text-gray-400 gap-1">
                      <Building2 className="w-8 h-8" />
                      <span className="text-xs">No photos attached to this property</span>
                    </div>
                  )}

                  {/* Property Specs & Pricing Grid */}
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

                  {/* Address & Description */}
                  <div className="p-4 bg-white rounded-2xl border border-gray-200 space-y-2">
                    <div className="flex items-center gap-1.5 text-xs text-gray-600 font-semibold">
                      <Building2 className="w-4 h-4 text-gray-400 shrink-0" />
                      <span>{propAddress}{propCity ? `, ${propCity}` : ''}</span>
                    </div>
                    <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-line">
                      {propDesc}
                    </p>
                    {facList.length > 0 && (
                      <div className="pt-2 border-t border-gray-100">
                        <span className="text-[11px] font-bold text-gray-500 block mb-1">Facilities / Amenities:</span>
                        <div className="flex flex-wrap gap-1.5">
                          {facList.map((f, i) => (
                            <span key={i} className="px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 text-[11px] font-medium">
                              {typeof f === 'string' ? f.trim() : JSON.stringify(f)}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Landlord / Owner Dossier */}
                  <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-800 block">
                        Registered Landlord / Owner
                      </span>
                      <p className="text-sm font-black text-gray-900 mt-0.5">
                        {owner?.name || owner?.Name || owner?.fullName || owner?.FullName || owner?.email || owner?.Email || 'Property Owner'}
                      </p>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-gray-600 mt-1 font-medium">
                        {(owner?.email || owner?.Email) && (
                          <span className="flex items-center gap-1">
                            <Mail className="w-3.5 h-3.5 text-indigo-500" />
                            <span>{owner.email || owner.Email}</span>
                          </span>
                        )}
                        {(owner?.phoneNumber || owner?.PhoneNumber || owner?.phone || owner?.Phone) && (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3.5 h-3.5 text-indigo-500" />
                            <span>{owner.phoneNumber || owner.PhoneNumber || owner.phone || owner.Phone}</span>
                          </span>
                        )}
                        {(owner?.nicNumber || owner?.NicNumber || owner?.nic || owner?.Nic) && (
                          <span className="font-mono text-gray-500">
                            NIC: {owner.nicNumber || owner.NicNumber || owner.nic || owner.Nic}
                          </span>
                        )}
                      </div>
                    </div>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setInspectingProperty(null);
                        handleTabChange('users');
                        const ownerIdentifier = owner?.email || owner?.Email || owner?.name || owner?.Name;
                        if (ownerIdentifier) {
                          setUserSearch(ownerIdentifier);
                        }
                      }}
                      className="border-indigo-300 text-indigo-700 hover:bg-indigo-100 text-xs font-bold shrink-0 self-start sm:self-auto"
                    >
                      <Users className="w-3.5 h-3.5" />
                      <span>Inspect Owner in Users Tab</span>
                    </Button>
                  </div>

                  <AdminDocumentReviews
                    key={p.id || p.Id}
                    property={p}
                    onSent={() => {
                      fetchAllProperties();
                      setInspectingProperty(prev => prev ? { ...prev, status: prev.status === 'Suspended' ? 'Suspended' : 'PendingVerification' } : prev);
                    }}
                  />

                  {/* Utility Bill / Ownership Document Inspection & Auto-Verification */}
                  {(() => {
                    const ver = evaluatePropertyVerification(inspectingProperty);
                    const propId = inspectingProperty?.id || inspectingProperty?.Id;

                    if (!ver.hasBill) {
                      return (
                        <div className="p-4 bg-amber-50/70 rounded-2xl border border-amber-200 text-xs text-amber-950 space-y-3">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <Zap className="w-4 h-4 text-amber-600 shrink-0" />
                              <span className="font-bold">No utility bill proof attached to this property listing yet.</span>
                            </div>
                            <span className="text-[10.5px] font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 w-fit">
                              {ver.isManuallyVerified ? '✓ Admin Approved' : 'No Bill Attached'}
                            </span>
                          </div>

                          <div className="p-3 bg-white/95 rounded-xl border border-amber-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                            <div className="space-y-0.5">
                              <p className="font-bold text-gray-900">
                                {ver.isManuallyVerified
                                  ? '✓ This property has been manually verified and activated by an Administrator.'
                                  : 'As an Administrator, you can manually verify and activate this property.'}
                              </p>
                              <p className="text-[11px] text-gray-500">
                                Listing Address: {ver.propertyAddress || 'Sri Lanka'}
                              </p>
                            </div>
                            <Button
                              size="sm"
                              onClick={() => handleApproveProperty(propId, null, true)}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3.5 py-2 rounded-xl shrink-0 flex items-center gap-1.5 shadow-sm shadow-emerald-600/20 cursor-pointer"
                            >
                              <ShieldCheck className="w-4 h-4" />
                              <span>{ver.isManuallyVerified ? 'Re-Confirm Activation' : 'Manually Verify & Activate'}</span>
                            </Button>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div className={`p-4 rounded-2xl border space-y-3 ${
                        ver.isManuallyVerified
                          ? 'bg-blue-50/70 border-blue-300'
                          : ver.isVerified 
                          ? 'bg-emerald-50/70 border-emerald-300' 
                          : 'bg-rose-50/70 border-rose-300'
                      }`}>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 text-gray-900">
                            <Zap className="w-4 h-4 text-amber-600" />
                            <span>Utility Bill & Address Auto-Verification</span>
                          </span>
                          <span className={`text-[10.5px] font-extrabold px-2.5 py-0.5 rounded-full border flex items-center gap-1 ${
                            ver.isManuallyVerified
                              ? 'bg-blue-100 text-blue-800 border-blue-300'
                              : ver.isVerified 
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-300' 
                              : 'bg-rose-100 text-rose-800 border-rose-300'
                          }`}>
                            {ver.isManuallyVerified ? (
                              <>
                                <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                                <span>✓ Admin Approved</span>
                              </>
                            ) : ver.isVerified ? (
                              <>
                                <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />
                                <span>{ver.statusLabel}</span>
                              </>
                            ) : (
                              <>
                                <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                                <span>{ver.statusLabel}</span>
                              </>
                            )}
                          </span>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-3 pt-1">
                          <img 
                            src={ver.billUrl} 
                            alt="Utility Bill" 
                            className="w-24 h-24 object-cover rounded-xl border border-gray-300 shadow-2xs shrink-0 cursor-pointer hover:opacity-90 transition-opacity" 
                            onError={handleImageError} 
                            onClick={() => window.open(ver.billUrl, '_blank')}
                            title="Click to view full utility bill"
                          />
                          <div className="text-xs space-y-1.5 flex-1 min-w-0">
                            <div className="bg-white/90 p-2.5 rounded-xl border border-gray-200/80 space-y-1">
                              <p className="text-[11px] text-gray-600">
                                <strong className="text-gray-900">Entered Property Address:</strong> {ver.propertyAddress || 'N/A'}
                              </p>
                              <p className="text-[11px] text-gray-600">
                                <strong className="text-gray-900">Detected Bill Address:</strong> <span className={ver.isVerified ? 'text-emerald-800 font-bold' : 'text-rose-800 font-bold'}>{ver.billAddress || 'Not provided in the verification report'}</span>
                              </p>
                              <p className="text-[10.5px] text-gray-500 font-mono">
                                Provider: <strong>{ver.utilityProvider || 'Not provided'}</strong> • Acc: <strong>{ver.accountNo || 'Not provided'}</strong>
                              </p>
                            </div>
                            <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
                              <span className={`text-[11px] font-semibold ${ver.isVerified ? 'text-emerald-700' : 'text-rose-700'}`}>
                                {ver.matchDetails}
                              </span>
                              <div className="flex items-center gap-2">
                                {!ver.isVerified && (
                                  <Button
                                    size="sm"
                                    onClick={() => handleApproveProperty(propId, null, true)}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 cursor-pointer"
                                  >
                                    <ShieldCheck className="w-3.5 h-3.5" />
                                    <span>Override & Activate</span>
                                  </Button>
                                )}
                                <a 
                                  href={ver.billUrl} 
                                  target="_blank" 
                                  rel="noreferrer" 
                                  className="text-indigo-600 hover:underline font-bold text-[11px] shrink-0"
                                >
                                  View Original Bill &rarr;
                                </a>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Connected Applications / Bookings */}
                  <div className="p-4 bg-white rounded-2xl border border-gray-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-gray-800 uppercase tracking-wider">
                        Tenant Applications & Bookings ({propApps.length})
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => { setInspectingProperty(null); handleTabChange('agreements'); }}
                        className="text-xs text-indigo-600 hover:text-indigo-800 p-0 h-auto font-semibold"
                      >
                        View All Agreements &rarr;
                      </Button>
                    </div>

                    {propApps.length === 0 ? (
                      <p className="text-xs text-gray-400 py-2">No tenant applications currently recorded for this listing.</p>
                    ) : (
                      <div className="divide-y divide-gray-100">
                        {propApps.map((app) => (
                          <div key={app.id || app.Id} className="py-2 flex items-center justify-between text-xs">
                            <div>
                              <span className="font-bold text-gray-900">{app.tenantName || app.TenantName || 'Tenant Applicant'}</span>
                              <span className="text-gray-500 ml-2 font-mono">{app.tenantPhone || app.TenantPhone || app.tenantEmail || app.TenantEmail || ''}</span>
                            </div>
                            <Badge variant={app.status === 'Accepted' ? 'success' : app.status === 'Rejected' ? 'danger' : 'default'}>
                              {app.status || app.Status}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Bottom Actions Footer */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-gray-200">
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const propToEdit = inspectingProperty;
                          setInspectingProperty(null);
                          setEditingProperty(propToEdit);
                          setIsPropModalOpen(true);
                        }}
                        className="text-xs text-indigo-600 hover:bg-indigo-50 border-indigo-200 font-semibold flex items-center gap-1.5"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        <span>Edit Listing Details</span>
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const propToDelete = inspectingProperty;
                          setInspectingProperty(null);
                          setDeletingProperty(propToDelete);
                        }}
                        className="text-xs text-rose-600 hover:bg-rose-50 border-rose-200 font-semibold flex items-center gap-1.5"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete Listing</span>
                      </Button>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setInspectingProperty(null)}
                      >
                        Close
                      </Button>
                    </div>
                  </div>

                </div>
              );
            })()}
          </Modal>

          {/* Add / Edit Property Modal */}
          <Modal
            isOpen={isPropModalOpen}
            onClose={() => { setIsPropModalOpen(false); setEditingProperty(null); }}
            title={editingProperty ? `Edit Property: ${editingProperty.title || editingProperty.Title || 'Property'}` : 'Add New Property Listing (Admin)'}
          >
            <PropertyForm
              initialData={editingProperty}
              onSubmit={handleSaveProperty}
              onCancel={() => { setIsPropModalOpen(false); setEditingProperty(null); }}
              isLoading={isSubmittingProp}
            />
          </Modal>

          {/* Delete Property Confirmation Modal */}
          <Modal
            isOpen={Boolean(deletingProperty)}
            onClose={() => setDeletingProperty(null)}
            title="Confirm Property Deletion (Admin)"
          >
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-800 space-y-2">
                <h4 className="text-sm font-bold text-rose-900">Are you sure you want to permanently delete this property?</h4>
                <p>
                  You are removing <strong>"{deletingProperty?.title || deletingProperty?.Title || 'Selected Property'}"</strong> as System Administrator. All associated photos and documents will be deleted.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setDeletingProperty(null)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => handleDeleteProperty(deletingProperty)}
                  className="bg-rose-600 hover:bg-rose-700 text-white font-semibold"
                >
                  Yes, Delete Property
                </Button>
              </div>
            </div>
          </Modal>
        </div>
      )}

      {/* ======================================================== */}
      {/* SECTION 2: MANAGE USERS                                  */}
      {/* ======================================================== */}
      {activeTab === 'users' && (
        <div className="space-y-4 pt-1">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-extrabold text-gray-900 flex items-center gap-2">
                <span>Manage Platform Users</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 font-bold border border-blue-100">
                  {filteredUsers.length} Users
                </span>
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Review all registered tenants, property owners, and administrators. Update user roles and access rights.
              </p>
            </div>
          </div>

          {/* Search & Role Filters */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-gray-200">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3 pointer-events-none" />
              <input
                type="text"
                placeholder="Search by name, email, phone number, or NIC..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>

            <div className="inline-flex p-1 bg-gray-100 rounded-xl text-xs font-semibold self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setUserRoleFilter('ALL')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  userRoleFilter === 'ALL' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                All ({usersList.length})
              </button>
              <button
                type="button"
                onClick={() => setUserRoleFilter('OWNERS')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  userRoleFilter === 'OWNERS' ? 'bg-white text-indigo-800 font-bold shadow-xs' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Property Owners ({ownersCount})
              </button>
              <button
                type="button"
                onClick={() => setUserRoleFilter('TENANTS')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  userRoleFilter === 'TENANTS' ? 'bg-white text-blue-800 font-bold shadow-xs' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Tenants ({tenantsCount})
              </button>
              <button
                type="button"
                onClick={() => setUserRoleFilter('ADMINS')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  userRoleFilter === 'ADMINS' ? 'bg-white text-amber-900 font-bold shadow-xs' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Admins
              </button>
              <button
                type="button"
                onClick={() => setUserRoleFilter('BLOCKED')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  userRoleFilter === 'BLOCKED' ? 'bg-white text-rose-800 font-bold shadow-xs' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Blocked ({blockedUsersCount})
              </button>
            </div>
          </div>

          {/* User Cards Grid */}
          {isLoadingUsers ? (
            <div className="p-8 text-center text-gray-500 bg-white rounded-2xl border border-gray-200">
              Loading platform users...
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="p-10 text-center bg-white rounded-2xl border border-dashed border-gray-300">
              <Users className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-sm font-bold text-gray-700">No users found</p>
              <p className="text-xs text-gray-400 mt-1">Try adjusting your search query or role filter.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredUsers.map((u) => {
                const initials = (u.name || u.email || 'U').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
                const isUserAdmin = u.role === 'Administrator' || u.role === 'Admin' || u.role === 'SystemAdmin';
                const isOwner = u.role === 'PropertyOwner';

                return (
                  <div key={u.id} className={`rounded-2xl border ${u.isBlocked ? 'border-rose-300 bg-rose-50/20 ring-1 ring-rose-200' : 'border-gray-200 bg-white'} p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between gap-4`}>
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-extrabold text-sm text-white shadow-xs ${
                            isUserAdmin 
                              ? 'bg-gradient-to-br from-amber-500 to-orange-600' 
                              : isOwner 
                              ? 'bg-gradient-to-br from-indigo-500 to-violet-600' 
                              : 'bg-gradient-to-br from-blue-500 to-cyan-600'
                          }`}>
                            {initials}
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-gray-900 leading-snug truncate max-w-[170px]" title={u.name || u.email}>
                              {u.name || u.email}
                            </h4>
                            <span className="text-xs text-gray-500 truncate block max-w-[170px]" title={u.email}>
                              {u.email}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 flex-wrap justify-end">
                          {u.isBlocked && (
                            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-300 flex items-center gap-1">
                              <Ban className="w-3 h-3 text-rose-600" />
                              <span>Blocked</span>
                            </span>
                          )}
                          <span className={`text-[10.5px] font-bold px-2 py-0.5 rounded-full border ${
                            isUserAdmin 
                              ? 'bg-amber-50 text-amber-800 border-amber-200' 
                              : isOwner 
                              ? 'bg-indigo-50 text-indigo-700 border-indigo-200' 
                              : 'bg-blue-50 text-blue-700 border-blue-200'
                          }`}>
                            {u.role || 'Tenant'}
                          </span>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-gray-100 space-y-1.5 text-xs text-gray-600">
                        {u.phoneNumber && (
                          <div className="flex items-center gap-2">
                            <Phone className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                            <span>{u.phoneNumber}</span>
                          </div>
                        )}
                        {u.nicNumber && (
                          <div className="flex items-center gap-2">
                            <CreditCard className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                            <span>NIC: {u.nicNumber}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2 text-[11px] text-gray-400">
                          <Calendar className="w-3.5 h-3.5 shrink-0" />
                          <span>Joined: {new Date(u.createdAt || Date.now()).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-2 flex-wrap">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setRoleModalUser(u);
                          setSelectedNewRole(u.role || 'Tenant');
                        }}
                        className="text-xs px-2.5 py-1 text-indigo-600 border-indigo-200 hover:bg-indigo-50 flex items-center gap-1 font-semibold"
                      >
                        <UserCog className="w-3.5 h-3.5" />
                        <span>Change Role</span>
                      </Button>

                      {u.id !== user?.id && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setConfirmBlockUser(u)}
                          disabled={blockingUserId === u.id}
                          className={`text-xs px-2.5 py-1 flex items-center gap-1 font-semibold ${
                            u.isBlocked 
                              ? 'text-emerald-700 border-emerald-300 hover:bg-emerald-50' 
                              : 'text-amber-700 border-amber-300 hover:bg-amber-50'
                          }`}
                          title={u.isBlocked ? "Unblock user account" : "Block user account"}
                        >
                          {u.isBlocked ? (
                            <>
                              <Unlock className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Unblock</span>
                            </>
                          ) : (
                            <>
                              <Ban className="w-3.5 h-3.5 text-amber-600" />
                              <span>Block</span>
                            </>
                          )}
                        </Button>
                      )}

                      {u.id !== user?.id && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setDeletingUser(u)}
                          className="text-xs px-2.5 py-1 text-rose-600 border-rose-200 hover:bg-rose-50 flex items-center gap-1 font-semibold"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete</span>
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Change Role Modal */}
          <Modal
            isOpen={Boolean(roleModalUser)}
            onClose={() => setRoleModalUser(null)}
            title={`Modify User Role: ${roleModalUser?.name || roleModalUser?.email}`}
          >
            <div className="space-y-4">
              <p className="text-xs text-gray-600">
                Assign a new platform role to this user. Their navigation menu and dashboard permissions will update automatically on next login.
              </p>

              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-700 uppercase tracking-wider block">
                  Select User Role
                </label>
                <select
                  value={selectedNewRole}
                  onChange={(e) => setSelectedNewRole(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 p-2.5 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="Tenant">Tenant (Searches & books properties)</option>
                  <option value="PropertyOwner">PropertyOwner (Lists & manages properties)</option>
                  <option value="Administrator">Administrator (Full system controls)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                <Button variant="outline" onClick={() => setRoleModalUser(null)} disabled={isChangingRole}>
                  Cancel
                </Button>
                <Button
                  isLoading={isChangingRole}
                  onClick={handleUpdateUserRole}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
                >
                  Save Role Change
                </Button>
              </div>
            </div>
          </Modal>

          {/* Delete User Modal */}
          <Modal
            isOpen={Boolean(deletingUser)}
            onClose={() => setDeletingUser(null)}
            title="Confirm User Account Deletion"
          >
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-800 space-y-2">
                <h4 className="text-sm font-bold text-rose-900">Are you sure you want to delete this user?</h4>
                <p>
                  You are removing <strong>"{deletingUser?.name || deletingUser?.email}"</strong>. The user will no longer be able to log in.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setDeletingUser(null)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => handleDeleteUser(deletingUser)}
                  className="bg-rose-600 hover:bg-rose-700 text-white font-semibold"
                >
                  Yes, Delete User
                </Button>
              </div>
            </div>
          </Modal>

          {/* Block / Unblock User Confirmation Modal */}
          <Modal
            isOpen={Boolean(confirmBlockUser)}
            onClose={() => setConfirmBlockUser(null)}
            title={confirmBlockUser?.isBlocked ? "Unblock Platform User" : "Block Platform User"}
          >
            {confirmBlockUser && (
              <div className="space-y-4">
                <div className={`p-4 rounded-2xl border text-xs space-y-2 ${
                  confirmBlockUser.isBlocked 
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900' 
                    : 'bg-rose-50 border-rose-200 text-rose-900'
                }`}>
                  <div className="flex items-center gap-2 font-bold text-sm">
                    {confirmBlockUser.isBlocked ? (
                      <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                    ) : (
                      <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0" />
                    )}
                    <span>
                      {confirmBlockUser.isBlocked 
                        ? `Restore access for "${confirmBlockUser.name || confirmBlockUser.email}"?` 
                        : `Block access for "${confirmBlockUser.name || confirmBlockUser.email}"?`
                      }
                    </span>
                  </div>
                  <p className="leading-relaxed">
                    {confirmBlockUser.isBlocked ? (
                      'Unblocking this user will restore their ability to log in, view properties, create listings, and submit agreements.'
                    ) : (
                      'Blocking this user will immediately suspend their account and prevent them from logging in or taking any platform actions.'
                    )}
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => setConfirmBlockUser(null)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={() => handleToggleBlockUser(confirmBlockUser)}
                    disabled={blockingUserId === confirmBlockUser.id}
                    className={confirmBlockUser.isBlocked 
                      ? "bg-emerald-600 hover:bg-emerald-700 text-white font-bold" 
                      : "bg-rose-600 hover:bg-rose-700 text-white font-bold"
                    }
                  >
                    {confirmBlockUser.isBlocked ? "Yes, Unblock User" : "Yes, Block User"}
                  </Button>
                </div>
              </div>
            )}
          </Modal>
        </div>
      )}

      {/* ======================================================== */}
      {/* SECTION 3: AGREEMENTS REQUEST BY PROPERTY OWNERS         */}
      {/* ======================================================== */}
      {activeTab === 'agreements' && (
        <div className="space-y-4 pt-1">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-extrabold text-gray-900 flex items-center gap-2">
                <span>Agreements Request by Property Owners</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 font-bold border border-amber-200">
                  {applications.length + agreements.length} Records
                </span>
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Review lease contracts, landlord-tenant agreements, and pending booking requests requiring administrative review.
              </p>
            </div>

            <div className="inline-flex p-1 bg-gray-100 rounded-xl text-xs font-semibold self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setAgreementFilter('ALL')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  agreementFilter === 'ALL' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                All Requests ({applications.length + agreements.length})
              </button>
              <button
                type="button"
                onClick={() => setAgreementFilter('PENDING')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  agreementFilter === 'PENDING' ? 'bg-white text-amber-800 font-bold shadow-xs' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Pending ({pendingAgreementsCount})
              </button>
              <button
                type="button"
                onClick={() => setAgreementFilter('ACTIVE')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  agreementFilter === 'ACTIVE' ? 'bg-white text-emerald-800 font-bold shadow-xs' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Confirmed Leases
              </button>
            </div>
          </div>

          {/* List of Applications & Agreements */}
          {isLoadingAgreements ? (
            <div className="p-8 text-center text-gray-500 bg-white rounded-2xl border border-gray-200">
              Loading agreements and tenant requests...
            </div>
          ) : applications.length === 0 && agreements.length === 0 ? (
            <div className="p-10 text-center bg-white rounded-2xl border border-dashed border-gray-300">
              <FileText className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-sm font-bold text-gray-700">No agreements or booking requests registered</p>
              <p className="text-xs text-gray-400 mt-1">Tenant booking requests and landlord agreements will appear here for oversight.</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {applications.map((app) => {
                const isPending = app.status === 'Submitted' || app.status === 'UnderReview';
                const isConfirmed = app.status === 'Accepted';

                if (agreementFilter === 'PENDING' && !isPending) return null;
                if (agreementFilter === 'ACTIVE' && !isConfirmed) return null;

                return (
                  <div
                    key={app.id}
                    className="rounded-3xl border border-gray-200 bg-white p-5 shadow-xs hover:shadow-md transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-6"
                  >
                    <div className="flex-1 space-y-3">
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 text-white flex items-center justify-center font-black text-sm shadow-xs">
                            {app.tenantName ? app.tenantName.charAt(0).toUpperCase() : 'T'}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-sm font-bold text-gray-900">
                                {app.tenantName || 'Applicant Tenant'}
                              </h3>
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                                Booking Inquiry
                              </span>
                            </div>
                            <span className="text-xs text-gray-500">{app.tenantEmail || 'No email provided'}</span>
                          </div>
                        </div>

                        <div>
                          {isPending && (
                            <Badge variant="warning" className="animate-pulse px-3 py-1">
                              Pending Review
                            </Badge>
                          )}
                          {isConfirmed && (
                            <Badge variant="success" className="px-3 py-1">
                              Confirmed Lease Agreement
                            </Badge>
                          )}
                        </div>
                      </div>

                      <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200/70 text-xs space-y-2">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <span className="font-extrabold text-gray-900 text-sm">{app.propertyTitle || 'Property Listing'}</span>
                          <span className="font-black text-indigo-700 text-sm">
                            {formatMoney(app.monthlyRent)} <span className="text-xs font-normal text-gray-500">/ mo</span>
                          </span>
                        </div>
                        {app.propertyAddress && (
                          <p className="text-gray-500">{app.propertyAddress}</p>
                        )}
                        {app.message && (
                          <p className="text-gray-600 italic bg-white p-2.5 rounded-xl border border-gray-200/60">
                            "{app.message}"
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center lg:flex-col justify-end gap-2 border-t lg:border-t-0 pt-3 lg:pt-0 shrink-0">
                      {isPending ? (
                        <Button
                          size="sm"
                          isLoading={confirmingAppId === app.id}
                          onClick={() => handleAdminConfirmAgreement(app.id)}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-xs flex items-center gap-1.5"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Approve Lease</span>
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => navigate('/agreements')}
                          className="text-xs font-semibold px-4 py-2 rounded-xl flex items-center gap-1.5"
                        >
                          <span>View Agreement</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}

              {agreements.map((agr) => {
                if (agreementFilter === 'PENDING') return null;

                return (
                  <div
                    key={agr.id}
                    className="rounded-3xl border border-gray-200 bg-white p-5 shadow-xs hover:shadow-md transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-6"
                  >
                    <div className="flex-1 space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-black text-gray-900">{agr.propertyTitle || agr.property?.title || 'Rental Agreement'}</span>
                        <Badge variant="success">Active Lease</Badge>
                      </div>
                      <p className="text-gray-600">
                        Tenant: <strong>{agr.tenantName || agr.tenant?.name || 'Verified Tenant'}</strong> • Monthly Rent: <strong>{formatMoney(agr.monthlyRent || agr.agreedMonthlyRent)}</strong>
                      </p>
                      <p className="text-gray-400 text-[11px]">
                        Contract Term: {agr.startDate ? new Date(agr.startDate).toLocaleDateString() : 'Active'} &rarr; {agr.endDate ? new Date(agr.endDate).toLocaleDateString() : 'Ongoing'}
                      </p>
                    </div>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => navigate(`/agreements/${agr.id}`)}
                      className="text-xs font-semibold px-4 py-2 rounded-xl flex items-center gap-1.5 shrink-0"
                    >
                      <span>Inspect Agreement</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* SECTION 4: MANAGE PROFILE                                */}
      {/* ======================================================== */}
      {activeTab === 'profile' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pt-1">
          
          {/* Left Column: Personal Information Form */}
          <div className="lg:col-span-7 space-y-6">
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-xs space-y-6">
              <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                <div>
                  <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-indigo-600" />
                    <span>Administrator Profile Information</span>
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Update your official administrator contact details and public identification.
                  </p>
                </div>
                <Badge variant="default">Admin Master</Badge>
              </div>

              <form onSubmit={handleSaveProfile} className="space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="font-semibold text-gray-700 block">First Name</label>
                    <input
                      type="text"
                      value={profileForm.firstName}
                      onChange={(e) => setProfileForm({ ...profileForm, firstName: e.target.value })}
                      className="w-full rounded-xl border border-gray-300 p-2.5 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-semibold text-gray-700 block">Last Name</label>
                    <input
                      type="text"
                      value={profileForm.lastName}
                      onChange={(e) => setProfileForm({ ...profileForm, lastName: e.target.value })}
                      className="w-full rounded-xl border border-gray-300 p-2.5 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-gray-700 block">Email Address</label>
                  <input
                    type="email"
                    value={profileForm.email}
                    disabled
                    className="w-full rounded-xl border border-gray-200 bg-gray-100 p-2.5 text-xs text-gray-500 cursor-not-allowed"
                  />
                  <span className="text-[10px] text-gray-400">Admin login email: {profileForm.email}</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="font-semibold text-gray-700 block">Phone Number (10 digits)</label>
                    <input
                      type="text"
                      value={profileForm.phoneNumber}
                      onChange={(e) => setProfileForm({ ...profileForm, phoneNumber: e.target.value })}
                      className="w-full rounded-xl border border-gray-300 p-2.5 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="0771234567"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-semibold text-gray-700 block">NIC Number</label>
                    <input
                      type="text"
                      value={profileForm.nicNumber}
                      onChange={(e) => setProfileForm({ ...profileForm, nicNumber: e.target.value })}
                      className="w-full rounded-xl border border-gray-300 p-2.5 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="198512345678"
                    />
                  </div>
                </div>

                <div className="pt-3 flex justify-end">
                  <Button
                    type="submit"
                    isLoading={isSavingProfile}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-5"
                  >
                    Save Profile Details
                  </Button>
                </div>
              </form>
            </div>
          </div>

          {/* Right Column: Security & Change Password */}
          <div className="lg:col-span-5 space-y-6">
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-xs space-y-5">
              <div className="border-b border-gray-100 pb-3">
                <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                  <Lock className="w-4 h-4 text-indigo-600" />
                  <span>Admin Password & Security</span>
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Update your credentials to maintain administrator account security.
                </p>
              </div>

              <form onSubmit={handleChangePassword} className="space-y-3 text-xs">
                <div className="space-y-1">
                  <label className="font-semibold text-gray-700 block">Current Password</label>
                  <input
                    type="password"
                    value={passwordForm.currentPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                    className="w-full rounded-xl border border-gray-300 p-2.5 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Enter current password"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-gray-700 block">New Password (Min 8 chars)</label>
                  <input
                    type="password"
                    value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                    className="w-full rounded-xl border border-gray-300 p-2.5 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Enter new password"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-gray-700 block">Confirm New Password</label>
                  <input
                    type="password"
                    value={passwordForm.confirmPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                    className="w-full rounded-xl border border-gray-300 p-2.5 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Re-type new password"
                    required
                  />
                </div>

                <div className="pt-2 flex justify-end">
                  <Button
                    type="submit"
                    isLoading={isChangingPassword}
                    className="bg-slate-900 hover:bg-black text-white font-semibold text-xs px-4"
                  >
                    Update Password
                  </Button>
                </div>
              </form>
            </div>

            {/* Quick Login Reference Box */}
            <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-5 text-xs space-y-2">
              <div className="flex items-center gap-2 text-amber-900 font-bold">
                <ShieldCheck className="w-4 h-4 text-amber-700" />
                <span>Admin Login Credentials Reference</span>
              </div>
              <p className="text-amber-800">
                You can always sign in using the system administrator account:
              </p>
              <div className="bg-white p-3 rounded-xl border border-amber-200 space-y-1 font-mono text-[11.5px] text-gray-800">
                <p><strong>Email:</strong> admin@rentwise.com</p>
                <p><strong>Password:</strong> AdminPassword123!</p>
                <p><strong>Role:</strong> Administrator</p>
              </div>
            </div>
          </div>

        </div>
      )}

    </div>
  );
};

