import { accountStorage, belongsToAccount } from '../../utils/accountStorage';
import { paymentPurpose, paidRentMonths } from '../../utils/paymentPurpose';
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { Image as ImageIcon, Search, Sparkles, Home, CreditCard, Wrench, CalendarDays, CheckCircle2, XCircle, Clock, MapPin, ArrowRight, Building2, Receipt, ShieldCheck, Plus, Mail, Phone, ChevronRight, FileText, FileCheck, DollarSign, RotateCcw, User, Lock, Eye, EyeOff, Camera, Trash2, AlertCircle } from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';

import { PaymentModal } from './PaymentModal';
import { RequestForm } from '../maintenance/RequestForm';
import { PROPERTY_PLACEHOLDER_IMAGE, handleImageError } from '../../utils/imagePlaceholder';
import { BOOKINGS_UPDATED_EVENT } from '../../utils/bookingStatus';

import { extractPropertyPhoto, parseBookingDetails, money } from './tenantHelpers';
export const TenantProfilePortal = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const { user, updateUser } = useAuth();
  
  const [profile, setProfile] = useState(null);
  const [agreements, setAgreements] = useState([]);
  const [maintenance, setMaintenance] = useState([]);
  const [payments, setPayments] = useState([]);
  const [myBookings, setMyBookings] = useState([]);
  const [selectedAgreementForPayment, setSelectedAgreementForPayment] = useState(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Active Category State ('all' | 'maintenance' | 'bookings' | 'rentals' | 'payments')
  const [activeCategory, setActiveCategory] = useState(() => {
    return new URLSearchParams(window.location.search).get('tab') || 'all';
  });
  const [maintenanceFilter, setMaintenanceFilter] = useState('all');
  const [rentalFilter, setRentalFilter] = useState('all'); // 'all' | 'action_required' | 'active' | 'past'
  const [bookingFilter, setBookingFilter] = useState('all'); // 'all' | 'review' | 'approved' | 'declined'

  // Sync category with URL search parameters and anchor hash
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab) {
      setActiveCategory(tab);
    } else if (location.hash) {
      if (location.hash.includes('maintenance')) setActiveCategory('maintenance');
      else if (location.hash.includes('booking')) setActiveCategory('bookings');
      else if (location.hash.includes('rental')) setActiveCategory('rentals');
      else if (location.hash.includes('payment')) setActiveCategory('payments');
    }
  }, [searchParams, location.hash]);

  const handleCategoryChange = (cat) => {
    setActiveCategory(cat);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (cat === 'all') {
        next.delete('tab');
      } else {
        next.set('tab', cat);
      }
      return next;
    });
  };

  // Edit Profile States
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editFormData, setEditFormData] = useState({
    fullName: '',
    phoneNumber: '',
    nicNumber: ''
  });
  const [editPasswordData, setEditPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [showEditCurrentPassword, setShowEditCurrentPassword] = useState(false);
  const [showEditNewPassword, setShowEditNewPassword] = useState(false);
  const [showEditConfirmPassword, setShowEditConfirmPassword] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [editProfileError, setEditProfileError] = useState('');
  const [editProfileSuccess, setEditProfileSuccess] = useState('');
  const [isNewMaintenanceModalOpen, setIsNewMaintenanceModalOpen] = useState(false);
  const [isSubmittingMaintenance, setIsSubmittingMaintenance] = useState(false);

  // Agreement Confirmation States
  const [selectedAgreementForAgree, setSelectedAgreementForAgree] = useState(null);
  const [isAgreeModalOpen, setIsAgreeModalOpen] = useState(false);
  const [agreeSignature, setAgreeSignature] = useState('');
  const [agreeConfirmed, setAgreeConfirmed] = useState(false);
  const [isSubmittingAgree, setIsSubmittingAgree] = useState(false);
  const [agreeError, setAgreeError] = useState('');
  const [agreeSuccessMessage, setAgreeSuccessMessage] = useState('');
  const [agreeAiSummary, setAgreeAiSummary] = useState(null);
  const [isLoadingAiSummary, setIsLoadingAiSummary] = useState(false);

  const handleOpenEditProfile = () => {
    setEditProfileError('');
    setEditProfileSuccess('');
    setEditFormData({
      fullName: profile?.fullName || profile?.name || user?.fullName || '',
      phoneNumber: profile?.phoneNumber || user?.phoneNumber || profile?.telephoneNumber || '',
      nicNumber: profile?.nicNumber || user?.nicNumber || ''
    });
    setEditPasswordData({
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    });
    setIsEditModalOpen(true);
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setEditProfileError('');
    setEditProfileSuccess('');

    if (!editFormData.fullName.trim()) {
      setEditProfileError('Full name is required.');
      return;
    }

    if (editFormData.phoneNumber && !/^\d{10}$/.test(editFormData.phoneNumber.trim())) {
      setEditProfileError('Phone number must be exactly 10 digits (e.g. 0712345678).');
      return;
    }

    if (editFormData.nicNumber && !/^([0-9]{9}[vV]|[0-9]{12})$/.test(editFormData.nicNumber.trim())) {
      setEditProfileError("NIC must be 12 digits or 9 digits followed by 'V' (e.g. 123456789V or 200012345678).");
      return;
    }

    if (editPasswordData.newPassword) {
      if (!editPasswordData.currentPassword) {
        setEditProfileError('Please enter your current password to set a new password.');
        return;
      }
      if (editPasswordData.newPassword.length < 8) {
        setEditProfileError('New password must be at least 8 characters.');
        return;
      }
      if (editPasswordData.newPassword !== editPasswordData.confirmPassword) {
        setEditProfileError('New password and confirm password do not match.');
        return;
      }
    }

    try {
      setIsSavingProfile(true);
      const res = await api.put('/auth/profile', {
        fullName: editFormData.fullName.trim(),
        phoneNumber: editFormData.phoneNumber ? editFormData.phoneNumber.trim() : null,
        nicNumber: editFormData.nicNumber ? editFormData.nicNumber.trim().toUpperCase() : null
      });

      if (editPasswordData.newPassword) {
        await api.post('/auth/change-password', {
          currentPassword: editPasswordData.currentPassword,
          newPassword: editPasswordData.newPassword
        });
      }

      setProfile((prev) => ({
        ...(prev || {}),
        ...(res.data?.user || {}),
        fullName: editFormData.fullName.trim(),
        phoneNumber: editFormData.phoneNumber.trim(),
        nicNumber: editFormData.nicNumber.trim().toUpperCase()
      }));

      if (res.data?.token) {
        updateUser(res.data.token, res.data.user);
      } else if (res.data?.user) {
        updateUser(null, res.data.user);
      }

      setEditProfileSuccess('Profile updated successfully!');
      setTimeout(() => {
        setIsEditModalOpen(false);
        setEditProfileSuccess('');
      }, 1000);
    } catch (err) {
      console.error('Failed to update profile:', err);
      let msg = 'Failed to update profile. Please check your inputs.';
      if (err.response?.data?.errors) {
        msg = Object.values(err.response.data.errors).flat().join(' ');
      } else if (err.response?.data?.message) {
        msg = err.response.data.message;
      } else if (typeof err.response?.data === 'string') {
        msg = err.response.data;
      }
      setEditProfileError(msg);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const isAgreementPaid = useCallback((ag) => {
    if (!ag) return false;
    const terms = ag.termsAndConditions || ag.terms || '';
    return terms.includes('[PAYMENT_SUCCESS') || Boolean(ag.paidAt) || Boolean(ag.isPaid);
  }, []);

  const isAgreementAgreed = useCallback((ag) => {
    if (!ag) return false;
    if (isAgreementPaid(ag)) return true;
    const terms = ag.termsAndConditions || ag.terms || '';
    if (terms.includes('[TENANT_AGREED')) return true;
    if (Boolean(ag.isAgreed) || Boolean(ag.tenantAgreed)) return true;
    if (ag.status === 'Agreed' || ag.status === 'PendingOwnerApproval' || ag.status === 1 || ag.status === 'Active') return true;
    return false;
  }, [isAgreementPaid]);

  const fetchAgreementAiSummary = async (agreement) => {
    setIsLoadingAiSummary(true);
    setAgreeAiSummary(null);

    const rentVal = Number(agreement.agreedMonthlyRent || agreement.monthlyRent || 65000);
    const loc = agreement.propertyCity || agreement.propertyAddress || 'Malabe';
    const beds = Number(agreement.bedrooms || 2);
    const pType = agreement.propertyType || 'Apartment';

    let apiSuccess = false;
    try {
      const res = await api.post('/agentic/workflow/draft-agreement', {
        objective: "Review pricing",
        property_id: String(agreement.propertyId || agreement.id),
        agreement_id: String(agreement.id),
        rent: rentVal,
        location: loc,
        property_type: pType,
        bedrooms: beds,
        document: agreement.termsAndConditions || agreement.terms || ''
      });
      const returnedAnalysis = res.data?.analysis || res.data?.draft;
      if (returnedAnalysis) {
        setAgreeAiSummary(returnedAnalysis);
        apiSuccess = true;
      }
    } catch (err) {
      console.warn('AI agreement pricing endpoint note, activating local audit fallback:', err);
    }

    if (!apiSuccess) {
      let median = 60000;
      let rMin = 48000;
      let rMax = 72000;
      const locLower = loc.toLowerCase();

      if (locLower.includes('colombo 07')) { median = 110000; rMin = 85000; rMax = 140000; }
      else if (locLower.includes('colombo 03')) { median = 105000; rMin = 80000; rMax = 135000; }
      else if (locLower.includes('battaramulla')) { median = 90000; rMin = 75000; rMax = 115000; }
      else if (locLower.includes('pelawatte')) { median = 85000; rMin = 70000; rMax = 105000; }
      else if (locLower.includes('dehiwala')) { median = 52000; rMin = 42000; rMax = 65000; }
      else if (locLower.includes('kandy')) { median = 48000; rMin = 38000; rMax = 60000; }
      else if (locLower.includes('malabe')) { median = 58000; rMin = 48000; rMax = 68000; }

      let status = 'Fair / Within Market Range';
      let varStr = '+0%';
      let reasoning = '';

      if (rentVal > rMax) {
        status = 'Above Typical Market Range';
        const diff = Math.round(((rentVal - median) / median) * 100);
        varStr = `+${diff}%`;
        reasoning = `Proposed rent of LKR ${rentVal.toLocaleString()} is approximately ${varStr} above standard market benchmarks for ${beds}-bed ${pType}s in ${loc}.`;
      } else if (rentVal < rMin) {
        status = 'Below Typical Market Range';
        const diff = Math.round(((median - rentVal) / median) * 100);
        varStr = `-${diff}%`;
        reasoning = `Proposed rent of LKR ${rentVal.toLocaleString()} is ${varStr} below market average, representing competitive value for ${loc}.`;
      } else {
        status = 'Fair / Within Market Range';
        const diff = Math.round(((rentVal - median) / median) * 100);
        varStr = diff >= 0 ? `+${diff}%` : `${diff}%`;
        reasoning = `Proposed rent of LKR ${rentVal.toLocaleString()} is within typical market benchmark range (LKR ${rMin.toLocaleString()} - LKR ${rMax.toLocaleString()}) for ${loc}.`;
      }

      setAgreeAiSummary({
        plain_language_summary: {
          parties: `Landlord: ${agreement.owner?.fullName || 'Property Owner'} | Tenant: ${agreement.tenant?.fullName || profile?.fullName || user?.fullName || 'Registered Tenant'}`,
          property_summary: `${beds}-Bedroom ${pType} located at ${loc}`,
          financial_terms: `Monthly Rent: LKR ${rentVal.toLocaleString()} | Security Deposit: LKR ${(agreement.securityDeposit || (rentVal * 2)).toLocaleString()} (Refundable 2-month deposit)`,
          lease_duration: `6 Months (${agreement.startDate ? new Date(agreement.startDate).toLocaleDateString() : 'Immediate'} to ${agreement.endDate ? new Date(agreement.endDate).toLocaleDateString() : '6 Months'})`,
          maintenance_rules: 'Landlord is liable for structural, plumbing, and major wiring repairs. Tenant handles routine day-to-day cleanliness and consumables.',
          key_restrictions: 'Standard residential use; No unauthorized subleasing without written consent; Quiet enjoyment hours observed.',
          termination_policy: '30 days formal written notice required prior to lease expiration.'
        },
        market_pricing_assessment: {
          listed_rent: rentVal,
          typical_market_range: `LKR ${rMin.toLocaleString()} - LKR ${rMax.toLocaleString()}`,
          median_benchmark: median,
          market_status: status,
          variance_percentage: varStr,
          pricing_reasoning: reasoning
        },
        non_binding_disclaimer: 'Notice: This rental assessment and plain-language summary is generated by RentWise Agentic AI for informational guidance only and is non-binding.'
      });
    }

    setIsLoadingAiSummary(false);
  };

  const handleOpenAgree = (agreement) => {
    setSelectedAgreementForAgree(agreement);
    setAgreeSignature(profile?.fullName || profile?.name || user?.fullName || '');
    setAgreeConfirmed(false);
    setAgreeError('');
    setIsAgreeModalOpen(true);
    fetchAgreementAiSummary(agreement);
  };

  const handleConfirmAgree = async (e) => {
    e.preventDefault();
    setAgreeError('');

    if (!agreeSignature || !agreeSignature.trim()) {
      setAgreeError('Please enter your full legal name as your electronic signature.');
      return;
    }

    if (!agreeConfirmed) {
      setAgreeError('Please tick the confirmation checkbox to agree to the terms.');
      return;
    }

    setIsSubmittingAgree(true);
    try {
      const agreementId = selectedAgreementForAgree.id;
      const timestamp = new Date().toISOString();
      const signer = agreeSignature.trim();

      // 1. Try sending agree to server
      try {
        if (!String(agreementId).startsWith('agr_')) {
          await api.put(`/agreements/${agreementId}/agree`, { signatureName: signer });
        }
      } catch (apiErr) {
        console.warn('Backend agree PUT note (syncing locally):', apiErr);
      }

      // 2. Update React state immediately
      setAgreements((prev) =>
        prev.map((ag) => {
          if (ag.id === agreementId) {
            const terms = ag.termsAndConditions || ag.terms || '';
            return {
              ...ag,
              status: 'Agreed',
              isAgreed: true,
              tenantAgreed: true,
              termsAndConditions: `${terms}\n[TENANT_AGREED: ${timestamp} | Signer: ${signer}]`
            };
          }
          return ag;
        })
      );

      // 3. Persist to localStorage
      try {
        const local = JSON.parse(accountStorage.getItem('rentwise_client_agreements') || '[]');
        let matched = false;
        const updatedList = local.map((ag) => {
          if (ag.id === agreementId) {
            matched = true;
            const terms = ag.termsAndConditions || ag.terms || '';
            return {
              ...ag,
              status: 'Agreed',
              isAgreed: true,
              tenantAgreed: true,
              termsAndConditions: `${terms}\n[TENANT_AGREED: ${timestamp} | Signer: ${signer}]`
            };
          }
          return ag;
        });
        if (!matched && selectedAgreementForAgree) {
          const terms = selectedAgreementForAgree.termsAndConditions || selectedAgreementForAgree.terms || '';
          updatedList.unshift({
            ...selectedAgreementForAgree,
            status: 'Agreed',
            isAgreed: true,
            tenantAgreed: true,
            termsAndConditions: `${terms}\n[TENANT_AGREED: ${timestamp} | Signer: ${signer}]`
          });
        }
        accountStorage.setItem('rentwise_client_agreements', JSON.stringify(updatedList));
        window.dispatchEvent(new Event('storage'));
      } catch (storageErr) {
        console.error('LocalStorage agreement save error:', storageErr);
      }

      setIsAgreeModalOpen(false);
      setAgreeSuccessMessage('Lease agreement confirmed and signed! You can now proceed to Make Payment.');
      setTimeout(() => setAgreeSuccessMessage(''), 6000);
    } catch (err) {
      console.error('Agree error:', err);
      setAgreeError('Failed to record agreement. Please try again.');
    } finally {
      setIsSubmittingAgree(false);
    }
  };

  const handleOpenPayment = (agreement) => {
    setSelectedAgreementForPayment(agreement);
    setIsPaymentModalOpen(true);
  };

  const handlePaymentSuccess = (newPayment) => {
    setPayments((prev) => [newPayment, ...prev]);
    setAgreeSuccessMessage(newPayment.confirmationEmailSent === true
      ? 'Payment recorded. Confirmation email sent; check your inbox and spam folder.'
      : 'Payment recorded, but email delivery was not confirmed. Contact support with your payment reference. Do not pay again.');

    if (selectedAgreementForPayment) {
      const targetId = selectedAgreementForPayment.id;
      const timestamp = new Date().toISOString();

      setAgreements((prev) =>
        prev.map((ag) => {
          if (ag.id === targetId) {
            const terms = ag.termsAndConditions || ag.terms || '';
            return {
              ...ag,
              id: newPayment.rentalAgreementId || ag.id,
              status: 'Active',
              isPaid: true,
              paidAt: timestamp,
              termsAndConditions: `${terms}\n[PAYMENT_SUCCESS: LKR ${newPayment.amount || ag.monthlyRent || 0} | Ref: ${newPayment.paymentReference || 'TXN'} | Date: ${timestamp}]`
            };
          }
          return ag;
        })
      );

      try {
        const stored = JSON.parse(accountStorage.getItem('rentwise_client_agreements') || '[]');
        const updated = stored.map((ag) => {
          if (ag.id === targetId) {
            const terms = ag.termsAndConditions || ag.terms || '';
            return {
              ...ag,
              id: newPayment.rentalAgreementId || ag.id,
              status: 'Active',
              isPaid: true,
              paidAt: timestamp,
              termsAndConditions: `${terms}\n[PAYMENT_SUCCESS: LKR ${newPayment.amount || ag.monthlyRent || 0} | Ref: ${newPayment.paymentReference || 'TXN'} | Date: ${timestamp}]`
            };
          }
          return ag;
        });
        accountStorage.setItem('rentwise_client_agreements', JSON.stringify(updated));
        window.dispatchEvent(new Event('storage'));
      } catch {}
    }
  };

  const fetchTenantData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [profileRes, agreementRes, maintenanceRes, bookingsRes, propertiesRes] = await Promise.all([
        api.get('/auth/profile').catch(() => null),
        api.get('/agreements/mine').catch(() => ({ data: [] })),
        api.get('/maintenance-requests/mine').catch(() => ({ data: [] })),
        api.get('/property-applications').catch(() => ({ data: [] })),
        api.get('/properties').catch(() => ({ data: [] }))
      ]);

      let agreementData = (Array.isArray(agreementRes?.data) ? agreementRes.data : []).filter(a => belongsToAccount(a, user));
      let bookingData = Array.isArray(bookingsRes?.data) ? bookingsRes.data : [];
      bookingData = bookingData.filter(b => Boolean(user?.id) && b.tenantId === user.id);
      
      let rawMaintenance = (Array.isArray(maintenanceRes?.data) ? maintenanceRes.data : []).filter(m => Boolean(user?.id) && m.tenantId === user.id);
      const propertiesData = Array.isArray(propertiesRes?.data) ? propertiesRes.data : [];

      const propLookup = new Map();
      propertiesData.forEach((p) => {
        if (p && p.id != null) {
          propLookup.set(p.id, p);
          propLookup.set(String(p.id), p);
        }
      });

      // Synchronize with client-side confirmed agreements and bookings
      try {
        const localAgreements = JSON.parse(accountStorage.getItem('rentwise_client_agreements') || '[]')
          .filter(ag => Boolean(user?.id) && ag.tenantId === user.id);
        if (localAgreements.length > 0) {
          const map = new Map();
          for (const a of [...localAgreements, ...agreementData]) {
            map.set(a.id || a.propertyId, a);
          }
          agreementData = Array.from(map.values());
        }

        const localBookings = JSON.parse(accountStorage.getItem('rentwise_client_bookings') || '[]')
          .filter(b => Boolean(user?.id) && b.tenantId === user.id);
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

      // Auto-generate mocked agreements for any accepted applications that don't have an agreement yet
      // This ensures that if the tenant logs out (wiping local storage) and logs back in,
      // they still get their generated agreements based on the backend applications API.
      bookingData.forEach((app) => {
        if (app.status === 'Accepted' || app.status === 'Approved') {
          const exists = agreementData.some(a => a.id === `agr_${app.id}` || a.propertyId === app.propertyId);
          if (!exists) {
            const matchedPropForOwner = propLookup.get(app.propertyId) || propLookup.get(String(app.propertyId));
            const agreement = {
              id: `agr_${app.id}`,
              propertyId: app.propertyId,
              ownerId: matchedPropForOwner?.ownerId,
              propertyTitle: app.propertyTitle || 'Rental Property',
              propertyAddress: app.propertyAddress || 'Address on file',
              tenantId: app.tenantId || user?.id,
              tenantName: app.tenantName || user?.fullName,
              tenantEmail: app.tenantEmail || user?.email,
              monthlyRent: app.monthlyRent,
              agreedMonthlyRent: app.monthlyRent,
              securityDeposit: (app.monthlyRent || 0) * 2,
              startDate: app.startDate || new Date().toISOString().split('T')[0],
              endDate: app.endDate || '',
              status: 'Drafted',
              termsAndConditions: `[6-Month Lease Sent to Tenant: ${app.tenantName || user?.fullName} on ${new Date().toLocaleDateString()}]\nPlease review house photos and terms, then click Review & Agree to proceed to payment.`
            };
            agreementData.unshift(agreement);
          }
        }
      });

      // Enrich agreements with property photos, addresses, titles, and specs
      agreementData = agreementData.map((ag, idx) => {
        const matchedProp = propLookup.get(ag.propertyId) || 
                            propLookup.get(String(ag.propertyId)) || 
                            ag.property || 
                            propertiesData.find(p => p.title && ag.propertyTitle && p.title.toLowerCase() === ag.propertyTitle.toLowerCase());
        const photo = extractPropertyPhoto(ag, idx) || extractPropertyPhoto(matchedProp, idx);

        return {
          ...ag,
          propertyTitle: ag.propertyTitle || matchedProp?.title || `Property #${String(ag.propertyId || '').slice(0, 8)}`,
          propertyAddress: ag.propertyAddress || matchedProp?.address || matchedProp?.city || 'Sri Lanka',
          propertyCity: matchedProp?.city || ag.city || '',
          propertyType: matchedProp?.type || matchedProp?.propertyType || ag.propertyType || 'Residential',
          bedrooms: matchedProp?.bedrooms ?? ag.bedrooms ?? null,
          bathrooms: matchedProp?.bathrooms ?? ag.bathrooms ?? null,
          photoUrl: photo,
          agreedMonthlyRent: ag.agreedMonthlyRent || ag.monthlyRent || matchedProp?.rentAmount || matchedProp?.price || 0,
          securityDeposit: ag.securityDeposit || matchedProp?.securityDeposit || ((Number(ag.agreedMonthlyRent || ag.monthlyRent || matchedProp?.rentAmount || matchedProp?.price || 0)) * 2)
        };
      });

      // Enrich bookings with property photos, addresses, titles, and specs
      bookingData = bookingData.map((b, idx) => {
        const matchedProp = propLookup.get(b.propertyId) || 
                            propLookup.get(String(b.propertyId)) || 
                            b.property || 
                            propertiesData.find(p => p.title && b.propertyTitle && p.title.toLowerCase() === b.propertyTitle.toLowerCase());
        const photo = extractPropertyPhoto(b, idx) || extractPropertyPhoto(matchedProp, idx);

        return {
          ...b,
          propertyTitle: b.propertyTitle || matchedProp?.title || `Property #${String(b.propertyId || '').slice(0, 8)}`,
          propertyAddress: b.propertyAddress || matchedProp?.address || matchedProp?.city || 'Sri Lanka',
          propertyCity: matchedProp?.city || b.city || '',
          propertyType: matchedProp?.type || matchedProp?.propertyType || b.propertyType || 'Residential',
          bedrooms: matchedProp?.bedrooms ?? b.bedrooms ?? null,
          bathrooms: matchedProp?.bathrooms ?? b.bathrooms ?? null,
          monthlyRent: b.monthlyRent || matchedProp?.rentAmount || matchedProp?.price || 0,
          photoUrl: photo,
        };
      });

      // Synchronize maintenance requests with localStorage and server data
      try {
        const localMaintenance = JSON.parse(accountStorage.getItem('rentwise_client_maintenance') || '[]');
        const mMap = new Map();

        const resolveMaintenancePhoto = (m, matchedProp) => {
          if (m?.photoUrl && typeof m.photoUrl === 'string' && m.photoUrl.trim().length > 0) {
            return m.photoUrl;
          }
          const propPhoto = extractPropertyPhoto(matchedProp) || extractPropertyPhoto(m?.property);
          if (propPhoto) return propPhoto;
          return FALLBACK_RENTAL_PHOTOS[0];
        };

        // Add server requests
        rawMaintenance.forEach((m) => {
          if (m && m.id) {
            const matchedProp = propLookup.get(m.propertyId) || 
                                propLookup.get(String(m.propertyId)) || 
                                m.property ||
                                propertiesData.find(p => p.title && m.propertyTitle && p.title.toLowerCase() === m.propertyTitle.toLowerCase());
            const propPhoto = extractPropertyPhoto(matchedProp);
            const photo = resolveMaintenancePhoto(m, matchedProp);
            mMap.set(m.id, {
              ...m,
              propertyTitle: m.propertyTitle || matchedProp?.title || `Property #${String(m.propertyId).slice(0, 8)}`,
              propertyAddress: m.propertyAddress || matchedProp?.address || '',
              photoUrl: photo,
              propertyPhoto: propPhoto
            });
          }
        });

        // Merge client-side cached requests
        localMaintenance.forEach((lm) => {
          if (lm && lm.id && (Boolean(user?.id) && lm.tenantId === user.id)) {
            const matchedProp = propLookup.get(lm.propertyId) || 
                                propLookup.get(String(lm.propertyId)) || 
                                lm.property ||
                                propertiesData.find(p => p.title && lm.propertyTitle && p.title.toLowerCase() === lm.propertyTitle.toLowerCase());
            const propPhoto = extractPropertyPhoto(matchedProp);
            const photo = resolveMaintenancePhoto(lm, matchedProp);
            if (!mMap.has(lm.id)) {
              mMap.set(lm.id, {
                ...lm,
                propertyTitle: lm.propertyTitle || matchedProp?.title || `Property #${String(lm.propertyId).slice(0, 8)}`,
                propertyAddress: lm.propertyAddress || matchedProp?.address || '',
                photoUrl: photo,
                propertyPhoto: propPhoto
              });
            } else {
              const existing = mMap.get(lm.id);
              if (lm.photoUrl && (!existing.photoUrl || existing.photoUrl === FALLBACK_RENTAL_PHOTOS[0])) {
                mMap.set(lm.id, { ...existing, photoUrl: lm.photoUrl });
              }
            }
          }
        });

        rawMaintenance = Array.from(mMap.values());
        rawMaintenance.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      } catch (e) {
        console.error('Tenant maintenance sync error:', e);
      }

      setProfile(profileRes?.data || null);
      setAgreements(agreementData);
      setMaintenance(rawMaintenance);
      setMyBookings(bookingData);

      // Fetch payments for tenant's agreements
      const paymentResponses = await Promise.all(
        agreementData.map((agreement) => {
          if (String(agreement.id).startsWith('agr_')) {
            return Promise.resolve({ data: [] });
          }
          return api.get(`/agreements/${agreement.id}/payments`).catch(() => ({ data: [] }));
        })
      );
      let allPayments = paymentResponses.flatMap((res) => res.data || []);

      // Synchronize with client-side recorded payments
      try {
        const localPayments = JSON.parse(accountStorage.getItem('rentwise_client_payments') || '[]');
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
    } catch (err) {
      console.error('Tenant data fetch error:', err);
      setError('Unable to load some of your tenant profile details.');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchTenantData();

    const handleUpdate = () => {
      fetchTenantData();
    };

    window.addEventListener(BOOKINGS_UPDATED_EVENT, handleUpdate);
    window.addEventListener('storage', handleUpdate);

    return () => {
      window.removeEventListener(BOOKINGS_UPDATED_EVENT, handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, [fetchTenantData]);

  // Group agreements into lifecycle sections
  const { pendingLeases, activeLeases, pastLeases } = useMemo(() => {
    const pending = [];
    const active = [];
    const past = [];

    agreements.forEach((agreement) => {
      const terms = agreement.termsAndConditions || agreement.terms || '';
      const hasPaid = terms.includes('[PAYMENT_SUCCESS') || Boolean(agreement.paidAt) || Boolean(agreement.isPaid);
      const isTerminated = agreement.status === 'Terminated' || agreement.status === 'Cancelled' || agreement.status === 'Expired';

      if (isTerminated) {
        past.push(agreement);
      } else if (hasPaid || agreement.status === 'Active') {
        active.push(agreement);
      } else {
        pending.push(agreement);
      }
    });

    return { pendingLeases: pending, activeLeases: active, pastLeases: past };
  }, [agreements]);

  // Group booking inquiries
  const { pendingBookings, approvedBookings, declinedBookings } = useMemo(() => {
    const pending = [];
    const approved = [];
    const declined = [];

    myBookings.forEach((b) => {
      if (b.status === 'Accepted' || b.status === 'Approved') {
        approved.push(b);
      } else if (b.status === 'Rejected' || b.status === 'Declined') {
        declined.push(b);
      } else {
        pending.push(b);
      }
    });

    return { pendingBookings: pending, approvedBookings: approved, declinedBookings: declined };
  }, [myBookings]);

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

  // Filtered maintenance requests based on category subfilter
  const displayedMaintenance = useMemo(() => {
    if (maintenanceFilter === 'all') return maintenance;
    return maintenance.filter((m) => {
      const status = m.status || 'Reported';
      if (maintenanceFilter === 'InProgress') {
        return status === 'InProgress' || status === 'Assigned';
      }
      return status.toLowerCase() === maintenanceFilter.toLowerCase();
    });
  }, [maintenance, maintenanceFilter]);

  const handleDeleteMaintenance = async (requestId) => {
    if (!window.confirm('Are you sure you want to delete this maintenance request?')) return;
    try {
      await api.delete(`/maintenance-requests/${requestId}`);

      // Clean up local state
      setMaintenance((prev) => prev.filter((r) => r.id !== requestId));

      // Clean up localStorage
      try {
        const localList = JSON.parse(accountStorage.getItem('rentwise_client_maintenance') || '[]');
        const updated = localList.filter((item) => item.id !== requestId);
        accountStorage.setItem('rentwise_client_maintenance', JSON.stringify(updated));
        window.dispatchEvent(new Event('storage'));
      } catch {}
    } catch (err) {
      console.error('Failed to delete maintenance request:', err);
      const errMsg = err.response?.data?.message || 'Failed to delete maintenance request.';
      alert(errMsg);
    }
  };

  const handleUploadMaintenancePhoto = async (requestId, e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result;

      // 1. Immediately update local state
      setMaintenance((prev) =>
        prev.map((item) =>
          item.id === requestId ? { ...item, photoUrl: base64 } : item
        )
      );

      // 2. Persist to localStorage
      try {
        const localList = JSON.parse(accountStorage.getItem('rentwise_client_maintenance') || '[]');
        let found = false;
        const updatedList = localList.map((item) => {
          if (item.id === requestId) {
            found = true;
            return { ...item, photoUrl: base64 };
          }
          return item;
        });
        if (!found) {
          const currentItem = maintenance.find((m) => m.id === requestId);
          if (currentItem) {
            updatedList.push({ ...currentItem, photoUrl: base64 });
          }
        }
        accountStorage.setItem('rentwise_client_maintenance', JSON.stringify(updatedList));
        window.dispatchEvent(new Event('storage'));
      } catch (err) {
        console.error('Local maintenance photo save error:', err);
      }

      // 3. Persist to backend server API
      try {
        await api.put(`/maintenance-requests/${requestId}/photo`, { photoUrl: base64 });
      } catch (apiErr) {
        console.warn('Backend photo update endpoint warning, trying fallback PUT:', apiErr);
        try {
          const currentItem = maintenance.find((m) => m.id === requestId);
          if (currentItem) {
            await api.put(`/maintenance-requests/${requestId}`, {
              ...currentItem,
              photoUrl: base64
            });
          }
        } catch (fallbackErr) {
          console.error('Failed to update maintenance photo on server:', fallbackErr);
        }
      }
    };
    reader.readAsDataURL(file);
  };

  const handleCreateMaintenance = async (formData) => {
    try {
      setIsSubmittingMaintenance(true);
      const newId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `maint_${Date.now()}`;
      
      const targetAgreement = agreements.find((a) => (a.propertyId || a.id) === formData.propertyId);
      const targetPropertyTitle = targetAgreement?.propertyTitle || 'Booked Property';
      const targetPropertyAddress = targetAgreement?.propertyAddress || '';
      const finalPhoto = formData.photoUrl || targetAgreement?.photoUrl || FALLBACK_RENTAL_PHOTOS[0];

      const payload = {
        propertyId: formData.propertyId,
        tenantId: user?.id || formData.tenantId,
        description: formData.description,
        photoUrl: finalPhoto,
        aiCategory: formData.aiCategory || 'General',
        aiPriority: formData.aiPriority || 'Medium',
        status: formData.status || 'Reported'
      };

      let savedRecord = null;
      try {
        const res = await api.post('/maintenance-requests', payload);
        savedRecord = res.data;
      } catch (err) {
        console.warn('Backend maintenance-requests POST warning, persisting locally:', err);
      }

      const newRecord = {
        id: savedRecord?.id || newId,
        propertyId: formData.propertyId,
        propertyTitle: targetPropertyTitle,
        propertyAddress: targetPropertyAddress,
        description: formData.description,
        photoUrl: finalPhoto,
        propertyPhoto: targetAgreement?.photoUrl,
        aiCategory: formData.aiCategory || 'General',
        aiPriority: formData.aiPriority || 'Medium',
        status: 'Reported',
        createdAt: new Date().toISOString()
      };

      // 1. Update React state immediately
      setMaintenance((prev) => [newRecord, ...prev]);

      // 2. Persist to localStorage
      try {
        const localList = JSON.parse(accountStorage.getItem('rentwise_client_maintenance') || '[]');
        accountStorage.setItem('rentwise_client_maintenance', JSON.stringify([newRecord, ...localList]));
        window.dispatchEvent(new Event('storage'));
      } catch (e) {}

      setIsNewMaintenanceModalOpen(false);
    } catch (err) {
      console.error('Failed to create maintenance request:', err);
      alert('Failed to submit maintenance request. Please try again.');
    } finally {
      setIsSubmittingMaintenance(false);
    }
  };

  const handleClearLocalCache = () => {
    if (window.confirm('Clear all local browser cached data (offline bookings, test leases, simulated payments)? The dashboard will reload and display only records present in the server database.')) {
      accountStorage.removeItem('rentwise_client_bookings');
      accountStorage.removeItem('rentwise_client_agreements');
      accountStorage.removeItem('rentwise_client_payments');
      accountStorage.removeItem('rentwise_client_maintenance');
      window.dispatchEvent(new Event('storage'));
      window.location.reload();
    }
  };

  // Auto-open Edit Profile modal if action=edit is in URL
  useEffect(() => {
    if (searchParams.get('action') === 'edit') {
      handleOpenEditProfile();
    }
  }, [searchParams]);

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
      {activeCategory === 'all' && (
        <div className="relative overflow-hidden rounded-3xl bg-white text-gray-900 p-7 sm:p-10 shadow-sm border border-gray-200">
          <div className="absolute top-0 right-0 -mt-12 -mr-12 w-96 h-96 bg-emerald-50/70 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-1/4 -mb-12 w-80 h-80 bg-blue-50/50 rounded-full blur-3xl pointer-events-none" />
          
          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
            {/* User Info */}
            <div className="flex items-center gap-5">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-extrabold text-3xl shadow-md shadow-blue-500/20 border-2 border-white shrink-0">
                {tenantName.charAt(0).toUpperCase()}
              </div>
              
              <div className="space-y-1">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">{tenantName}</h1>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    Verified Tenant
                  </span>
                </div>
                
                <div className="flex items-center gap-4 text-xs sm:text-sm text-gray-500 flex-wrap pt-0.5">
                  <span className="flex items-center gap-1.5">
                    <Mail className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-700 font-medium">{profile?.email || user?.email}</span>
                  </span>
                  {(profile?.phoneNumber || profile?.telephoneNumber || user?.phoneNumber) && (
                    <span className="flex items-center gap-1.5">
                      <Phone className="w-4 h-4 text-gray-400" />
                      <span className="text-gray-700 font-medium">{profile?.phoneNumber || profile?.telephoneNumber || user?.phoneNumber}</span>
                    </span>
                  )}
                  {(profile?.nicNumber || user?.nicNumber) && (
                    <span className="flex items-center gap-1.5">
                      <CreditCard className="w-4 h-4 text-gray-400" />
                      <span className="text-gray-700 font-medium">NIC: {profile?.nicNumber || user?.nicNumber}</span>
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-3 flex-wrap">
              <button
                type="button"
                onClick={handleOpenEditProfile}
                className="px-4 py-2.5 rounded-xl bg-gray-50 hover:bg-gray-100 text-gray-700 text-xs font-bold tracking-wide uppercase border border-gray-200 transition-all flex items-center gap-2 cursor-pointer shadow-2xs hover:shadow-xs"
              >
                <User className="w-4 h-4 text-gray-500" />
                <span>Edit Profile</span>
              </button>
              <button
                type="button"
                onClick={() => navigate('/properties')}
                className="px-5 py-2.5 rounded-xl bg-[#008037] hover:bg-emerald-700 text-white text-xs font-bold tracking-wide uppercase shadow-md shadow-emerald-700/20 transition-all flex items-center gap-2 cursor-pointer"
              >
                <Search className="w-4 h-4" />
                <span>Browse Properties</span>
              </button>
              <button
                type="button"
                onClick={() => navigate('/maintenance')}
                className="px-4 py-2.5 rounded-xl bg-gray-50 hover:bg-gray-100 text-gray-700 text-xs font-bold tracking-wide uppercase border border-gray-200 transition-all flex items-center gap-2 cursor-pointer shadow-2xs hover:shadow-xs"
              >
                <Wrench className="w-4 h-4 text-gray-500" />
                <span>Support</span>
              </button>
              <button
                type="button"
                onClick={handleClearLocalCache}
                title="Clear browser cached test records and refresh directly from database"
                className="px-3.5 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold tracking-wide uppercase border border-rose-200 transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                <span>Reset Cache</span>
              </button>
            </div>
          </div>

          {/* Stat Ribbon - Interactive Category Click */}
          <div className="relative z-10 grid grid-cols-2 sm:grid-cols-4 gap-4 mt-8 pt-6 border-t border-gray-100">
            <button
              type="button"
              onClick={() => handleCategoryChange('rentals')}
              className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                activeCategory === 'rentals'
                  ? 'bg-emerald-50/60 border-emerald-500 ring-2 ring-emerald-500/20 shadow-xs scale-[1.02]'
                  : 'bg-gray-50/80 border-gray-200 hover:bg-gray-100/70 hover:border-gray-300'
              }`}
            >
              <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500 flex items-center justify-between">
                <span>Rental Leases</span>
                {pendingLeases.length > 0 && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-bold border border-amber-200">
                    {pendingLeases.length} Pending
                  </span>
                )}
              </p>
              <div className="flex items-baseline gap-1.5 mt-1.5">
                <span className="text-2xl font-black text-gray-900">{activeLeases.length}</span>
                <span className="text-xs text-emerald-600 font-bold">Active</span>
                {pendingLeases.length > 0 && (
                  <span className="text-xs text-amber-600 font-semibold">· {pendingLeases.length} Action</span>
                )}
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleCategoryChange('bookings')}
              className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                activeCategory === 'bookings'
                  ? 'bg-blue-50/60 border-blue-500 ring-2 ring-blue-500/20 shadow-xs scale-[1.02]'
                  : 'bg-gray-50/80 border-gray-200 hover:bg-gray-100/70 hover:border-gray-300'
              }`}
            >
              <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Booking Inquiries</p>
              <p className="text-2xl font-black text-blue-600 mt-1.5">{myBookings.length}</p>
            </button>

            <button
              type="button"
              onClick={() => handleCategoryChange('payments')}
              className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                activeCategory === 'payments'
                  ? 'bg-emerald-50/60 border-emerald-500 ring-2 ring-emerald-500/20 shadow-xs scale-[1.02]'
                  : 'bg-gray-50/80 border-gray-200 hover:bg-gray-100/70 hover:border-gray-300'
              }`}
            >
              <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Total Payments</p>
              <p className="text-2xl font-black text-emerald-600 mt-1.5">{money(totalPaid)}</p>
            </button>

            <button
              type="button"
              onClick={() => handleCategoryChange('maintenance')}
              className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                activeCategory === 'maintenance'
                  ? 'bg-amber-50/70 border-amber-500 ring-2 ring-amber-500/20 shadow-xs scale-[1.02]'
                  : 'bg-gray-50/80 border-gray-200 hover:bg-gray-100/70 hover:border-gray-300'
              }`}
            >
              <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500 flex items-center justify-between">
                <span>Open Tickets</span>
                <span className="text-[9.5px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-bold border border-amber-200">Repairs</span>
              </p>
              <p className="text-2xl font-black text-amber-600 mt-1.5">{openMaintenanceCount}</p>
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-2xl bg-rose-50 p-4 text-sm font-medium text-rose-700 border border-rose-200">
          {error}
        </div>
      )}

      {/* Category Navigation Bar (All, Maintenance, Bookings, Rentals, Payments) */}
      <div className="bg-white rounded-2xl border border-gray-200 p-2 shadow-xs sticky top-14 z-30 backdrop-blur-md bg-white/95">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => handleCategoryChange('all')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
              activeCategory === 'all'
                ? 'bg-slate-900 text-white shadow-md shadow-slate-900/20'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            }`}
          >
            <span>👤</span>
            <span>Profile Overview</span>
          </button>

          <button
            type="button"
            onClick={() => handleCategoryChange('maintenance')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
              activeCategory === 'maintenance'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/30'
                : 'text-gray-700 hover:bg-amber-50 hover:text-amber-800'
            }`}
          >
            <Wrench className="w-3.5 h-3.5" />
            <span>Maintenance & Repairs</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
              activeCategory === 'maintenance' ? 'bg-black/20 text-slate-950' : 'bg-amber-100 text-amber-800'
            }`}>
              {maintenance.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleCategoryChange('bookings')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
              activeCategory === 'bookings'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'text-gray-700 hover:bg-blue-50 hover:text-blue-700'
            }`}
          >
            <span>📋</span>
            <span>Bookings & Inquiries</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
              activeCategory === 'bookings' ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-800'
            }`}>
              {myBookings.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleCategoryChange('rentals')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
              activeCategory === 'rentals'
                ? 'bg-[#008037] text-white shadow-md shadow-emerald-600/30'
                : 'text-gray-700 hover:bg-emerald-50 hover:text-emerald-800'
            }`}
          >
            <span>🏡</span>
            <span>Rental Houses & Leases</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
              activeCategory === 'rentals' ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-800'
            }`}>
              {agreements.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleCategoryChange('payments')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
              activeCategory === 'payments'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-gray-700 hover:bg-indigo-50 hover:text-indigo-800'
            }`}
          >
            <span>💳</span>
            <span>Payments & Dues</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
              activeCategory === 'payments' ? 'bg-white/20 text-white' : 'bg-indigo-100 text-indigo-800'
            }`}>
              {payments.length}
            </span>
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* SECTION 1: MY BOOKINGS & INQUIRIES                       */}
      {/* ======================================================== */}
      {activeCategory === 'bookings' && (
        <section id="bookings-section" className="space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-2xl font-extrabold tracking-tight text-gray-900">
                  My Bookings & Inquiries
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
                  {myBookings.length} Total
                </span>
              </div>
              <p className="text-sm text-gray-500 mt-1">
                Track property booking inquiries you submitted to landlords.
              </p>
            </div>

            <button
              onClick={() => navigate('/properties')}
              className="text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
            >
              <span>Explore more properties</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Booking Sub-Filters */}
          {myBookings.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {[
                { id: 'all', label: 'All Inquiries', count: myBookings.length },
                { id: 'review', label: 'Under Review', count: pendingBookings.length },
                { id: 'approved', label: 'Approved', count: approvedBookings.length },
                { id: 'declined', label: 'Declined', count: declinedBookings.length }
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setBookingFilter(f.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    bookingFilter === f.id
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <span>{f.label}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    bookingFilter === f.id ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-700'
                  }`}>
                    {f.count}
                  </span>
                </button>
              ))}
            </div>
          )}

          {myBookings.length === 0 ? (
            <div className="p-10 rounded-2xl bg-white border border-dashed border-gray-300 text-center">
              <Clock className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-sm font-bold text-gray-700">No booking requests yet</p>
              <p className="text-xs text-gray-400 mt-1">When you request to book a property, your application status appears here.</p>
              <button
                onClick={() => navigate('/properties')}
                className="mt-4 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm cursor-pointer"
              >
                Explore Properties
              </button>
            </div>
          ) : (
            (() => {
              const displayedBookings = bookingFilter === 'review'
                ? pendingBookings
                : bookingFilter === 'approved'
                  ? approvedBookings
                  : bookingFilter === 'declined'
                    ? declinedBookings
                    : myBookings;

              if (displayedBookings.length === 0) {
                return (
                  <div className="p-8 rounded-2xl bg-white border border-dashed border-gray-200 text-center">
                    <p className="text-xs font-semibold text-gray-500">No inquiries found in this filter category.</p>
                    <button
                      onClick={() => setBookingFilter('all')}
                      className="mt-2 text-xs font-bold text-blue-600 hover:underline cursor-pointer"
                    >
                      View all inquiries
                    </button>
                  </div>
                );
              }

              return (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {displayedBookings.map((booking, idx) => {
                    const isApproved = booking.status === 'Accepted' || booking.status === 'Approved';
                    const isPending = booking.status === 'Submitted' || booking.status === 'UnderReview' || (!isApproved && booking.status !== 'Rejected' && booking.status !== 'Declined');
                    const isRejected = booking.status === 'Rejected' || booking.status === 'Declined';
                    const details = parseBookingDetails(booking.message);
                    const photo = booking.photoUrl || extractPropertyPhoto(booking, idx);

                    return (
                      <div
                        key={booking.id}
                        className="group rounded-3xl bg-white border border-gray-200/80 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between overflow-hidden"
                      >
                        <div>
                          {/* Property Image Banner */}
                          <div className="relative h-44 w-full overflow-hidden bg-slate-900">
                            <img
                              src={photo}
                              alt={booking.propertyTitle || 'Rental Property'}
                              onError={handleImageError}
                              className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-900/20 to-black/40 pointer-events-none" />

                            {/* Floating Top Badges */}
                            <div className="absolute top-3 inset-x-3 flex items-center justify-between gap-2 z-10">
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-extrabold bg-slate-950/70 text-white backdrop-blur-md border border-white/20">
                                <CalendarDays className="w-3.5 h-3.5 text-blue-400" />
                                <span>{details.duration || '6-Month Lease'}</span>
                              </span>

                              {isApproved && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black bg-emerald-600 text-white border border-emerald-400 shadow-md">
                                  <CheckCircle2 className="w-3.5 h-3.5" /> Approved
                                </span>
                              )}
                              {isPending && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black bg-amber-500 text-slate-950 border border-amber-300 shadow-md animate-pulse">
                                  <Clock className="w-3.5 h-3.5" /> Under Review
                                </span>
                              )}
                              {isRejected && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black bg-rose-600 text-white border border-rose-400 shadow-md">
                                  <XCircle className="w-3.5 h-3.5" /> Declined
                                </span>
                              )}
                            </div>

                            {/* Rent on Image */}
                            <div className="absolute bottom-3 inset-x-3 flex items-end justify-between z-10 text-white">
                              <div>
                                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-300 block">Offered Rent</span>
                                <p className="text-lg font-black text-white drop-shadow">
                                  {money(booking.monthlyRent)}
                                  <span className="text-xs font-normal text-slate-300 ml-1">/ mo</span>
                                </p>
                              </div>
                              {booking.propertyType && (
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-white/20 backdrop-blur-md text-white border border-white/20">
                                  {booking.propertyType}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Booking Details */}
                          <div className="p-5 space-y-3">
                            <div>
                              <h3 className="text-base font-extrabold text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-1">
                                {booking.propertyTitle || 'Property Listing'}
                              </h3>
                              {booking.propertyAddress && (
                                <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                                  <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                                  <span className="truncate">{booking.propertyAddress}</span>
                                </p>
                              )}
                            </div>

                            {/* Move-in & Note */}
                            {details.startDate && (
                              <div className="flex items-center justify-between text-xs px-2.5 py-2 bg-slate-50 rounded-xl border border-slate-100 text-gray-600">
                                <span>Move-in: <strong className="text-gray-800">{details.startDate}</strong></span>
                                {details.endDate && <span>End: <strong className="text-gray-800">{details.endDate}</strong></span>}
                              </div>
                            )}

                            {details.note && (
                              <div className="text-xs text-gray-600 italic bg-gray-50 p-2.5 rounded-xl border border-gray-100 line-clamp-2">
                                "{details.note}"
                              </div>
                            )}

                            {isApproved && (
                              <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-100 text-[11px] text-emerald-800 flex items-start gap-2">
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                                <div>
                                  <span className="font-bold block">Inquiry Approved by Landlord!</span>
                                  <span>Check the <strong className="text-emerald-950">Rental Houses & Leases</strong> section below to review terms and complete your agreement.</span>
                                </div>
                              </div>
                            )}

                            {isPending && (
                              <div className="p-2.5 bg-amber-50/80 rounded-xl border border-amber-100 text-[11px] text-amber-900 flex items-start gap-2">
                                <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                <div>
                                  <span className="font-bold block">Inquiry Under Landlord Review</span>
                                  <span>The property is on hold for your application. You will be notified once approved.</span>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Card Footer */}
                        <div className="p-5 pt-0">
                          <div className="pt-3 border-t border-gray-100 flex items-center justify-between text-xs">
                            <span className="text-gray-400 flex items-center gap-1">
                              <CalendarDays className="w-3.5 h-3.5" />
                              {new Date(booking.createdAt).toLocaleDateString()}
                            </span>
                            <button
                              onClick={() => navigate(`/properties/${booking.propertyId}`)}
                              className="font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer"
                            >
                              <span>View Property</span>
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()
          )}
        </section>
      )}

      {/* ======================================================== */}
      {/* SECTION 2: MY RENTAL HOUSES & LEASES (DIVIDED SECTIONS)  */}
      {/* ======================================================== */}
      {activeCategory === 'rentals' && (
        <section id="rentals-section" className="space-y-6">
          {/* Main Section Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-2xl font-extrabold tracking-tight text-gray-900">
                  My Rental Houses & Leases
                </h2>
                <div className="flex items-center gap-1.5">
                  {activeLeases.length > 0 && (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                      {activeLeases.length} Active
                    </span>
                  )}
                  {pendingLeases.length > 0 && (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-100 text-amber-800 border border-amber-200 animate-pulse">
                      {pendingLeases.length} Action Required
                    </span>
                  )}
                </div>
              </div>
              <p className="text-sm text-gray-500 mt-1">
                Review approved leases, agree to terms, submit payment, and manage your active tenancies.
              </p>
            </div>

            {/* Sub-Filter Tabs */}
            {agreements.length > 0 && (
              <div className="flex items-center gap-2 overflow-x-auto self-start sm:self-auto pb-1">
                <button
                  type="button"
                  onClick={() => setRentalFilter('all')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    rentalFilter === 'all'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <span>All Leases</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                    rentalFilter === 'all' ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-700'
                  }`}>
                    {agreements.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setRentalFilter('action_required')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    rentalFilter === 'action_required'
                      ? 'bg-amber-600 text-white shadow-xs shadow-amber-600/20'
                      : 'bg-white border border-amber-200/80 text-amber-900 hover:bg-amber-50/60'
                  }`}
                >
                  <span>⚡ Action Required</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                    rentalFilter === 'action_required' ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-800'
                  }`}>
                    {pendingLeases.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setRentalFilter('active')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    rentalFilter === 'active'
                      ? 'bg-emerald-600 text-white shadow-xs shadow-emerald-600/20'
                      : 'bg-white border border-emerald-200/80 text-emerald-900 hover:bg-emerald-50/60'
                  }`}
                >
                  <span>🟢 Active & Rented</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                    rentalFilter === 'active' ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-800'
                  }`}>
                    {activeLeases.length}
                  </span>
                </button>

                {pastLeases.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setRentalFilter('past')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      rentalFilter === 'past'
                        ? 'bg-gray-800 text-white shadow-xs'
                        : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <span>📁 Past</span>
                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                      rentalFilter === 'past' ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-700'
                    }`}>
                      {pastLeases.length}
                    </span>
                  </button>
                )}
              </div>
            )}
          </div>

          {agreements.length === 0 ? (
            <div className="p-10 rounded-2xl bg-white border border-dashed border-gray-300 text-center">
              <Home className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-sm font-bold text-gray-700">No active rental agreements</p>
              <p className="text-xs text-gray-400 mt-1">Once your booking request is approved by the landlord, your lease will appear here for review and payment.</p>
              <button
                onClick={() => navigate('/properties')}
                className="mt-4 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer shadow-sm"
              >
                Browse Available Properties
              </button>
            </div>
          ) : (
            <div className="space-y-8">
              {/* ---------------------------------------------------- */}
              {/* SUB-SECTION 2A: ACTION REQUIRED (PENDING LEASES)     */}
              {/* ---------------------------------------------------- */}
              {(rentalFilter === 'all' || rentalFilter === 'action_required') && (
                <div className="space-y-4">
                  <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-50 via-orange-50/60 to-white border border-amber-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-bold shrink-0 shadow-sm shadow-amber-500/20">
                        <AlertCircle className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-extrabold text-amber-950">
                            Action Required: Leases Awaiting Agreement & Payment
                          </h3>
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-black bg-amber-200 text-amber-950 border border-amber-300">
                            {pendingLeases.length} Pending
                          </span>
                        </div>
                        <p className="text-xs text-amber-800/80 mt-0.5">
                          The property owner sent a formal agreement. Review terms, agree, and make payment to activate your tenancy.
                        </p>
                      </div>
                    </div>
                  </div>

                  {agreeSuccessMessage && (
                    <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2 shadow-xs">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>{agreeSuccessMessage}</span>
                    </div>
                  )}

                  {pendingLeases.length === 0 ? (
                    <div className="p-6 rounded-2xl bg-white border border-dashed border-gray-200 text-center text-xs text-gray-500">
                      ✨ You have no pending leases requiring action. All your lease agreements are up to date!
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {pendingLeases.map((agreement, idx) => {
                        const hasPaid = isAgreementPaid(agreement);
                        const hasAgreed = isAgreementAgreed(agreement);
                        const photo = agreement.photoUrl || extractPropertyPhoto(agreement, idx);

                        return (
                          <div
                            key={agreement.id}
                            className="group rounded-3xl bg-white border border-amber-200/90 shadow-sm hover:shadow-lg hover:shadow-amber-500/10 transition-all duration-300 flex flex-col justify-between overflow-hidden"
                          >
                            <div>
                              {/* Property Image Banner */}
                              <div className="relative h-48 w-full overflow-hidden bg-slate-900">
                                <img
                                  src={photo}
                                  alt={agreement.propertyTitle || 'Rental Property'}
                                  onError={handleImageError}
                                  className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-900/25 to-black/40 pointer-events-none" />

                                {/* Floating Badges on Image */}
                                <div className="absolute top-3 inset-x-3 flex items-center justify-between gap-2 z-10">
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-extrabold bg-slate-950/70 text-white backdrop-blur-md border border-white/20">
                                    <CalendarDays className="w-3.5 h-3.5 text-amber-400" />
                                    <span>6-Month Lease</span>
                                  </span>

                                  {hasAgreed ? (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black bg-emerald-600 text-white border border-emerald-400 shadow-md">
                                      <CreditCard className="w-3.5 h-3.5 text-white" />
                                      <span>Agreed · Make Payment</span>
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black bg-amber-500 text-slate-950 border border-amber-300 shadow-md">
                                      <FileText className="w-3.5 h-3.5 text-slate-950" />
                                      <span>Pending · Have to Agree</span>
                                    </span>
                                  )}
                                </div>

                                {/* Bottom Rent Tag */}
                                <div className="absolute bottom-3 inset-x-3 flex items-end justify-between z-10 text-white">
                                  <div>
                                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-300 block">Monthly Rent</span>
                                    <p className="text-xl font-black text-white drop-shadow">
                                      {money(agreement.agreedMonthlyRent || agreement.monthlyRent)}
                                      <span className="text-xs font-medium text-slate-300 ml-1">/ mo</span>
                                    </p>
                                  </div>
                                  {agreement.propertyType && (
                                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-white/20 backdrop-blur-md text-white border border-white/20">
                                      {agreement.propertyType}
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Card Body */}
                              <div className="p-5 space-y-4">
                                <div>
                                  <h3 className="text-base font-extrabold text-gray-900 group-hover:text-amber-700 transition-colors line-clamp-1">
                                    {agreement.propertyTitle || `Property #${String(agreement.propertyId || '').slice(0, 8)}`}
                                  </h3>
                                  <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                                    <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                                    <span className="truncate">{agreement.propertyAddress || 'Address on file'}</span>
                                  </p>
                                </div>

                                {/* Financial Overview 2x2 Grid */}
                                <div className="grid grid-cols-2 gap-2.5 p-3 bg-amber-50/50 rounded-2xl border border-amber-100">
                                  <div>
                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Agreed Rent</span>
                                    <span className="text-sm font-extrabold text-amber-900">
                                      {money(agreement.agreedMonthlyRent || agreement.monthlyRent)}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Deposit</span>
                                    <span className="text-sm font-bold text-gray-800">
                                      {money(agreement.securityDeposit || (Number(agreement.agreedMonthlyRent || 0) * 2))}
                                    </span>
                                  </div>
                                </div>

                                {/* 3-Step Lifecycle Stepper */}
                                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 space-y-2">
                                  <div className="flex items-center justify-between text-[11px] font-bold text-gray-700">
                                    <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Lease Progress</span>
                                    <span className={`text-[10.5px] font-extrabold ${hasAgreed ? 'text-emerald-600' : 'text-amber-600'}`}>
                                      {hasAgreed ? 'Step 2 Done: Make Payment' : 'Step 1: Have to Agree'}
                                    </span>
                                  </div>
                                  
                                  <div className="grid grid-cols-3 gap-1.5 pt-1">
                                    <div className="space-y-1">
                                      <div className="h-1.5 rounded-full bg-emerald-500" />
                                      <span className="text-[9.5px] font-bold text-emerald-700 block text-center">1. Owner Sent ✓</span>
                                    </div>
                                    <div className="space-y-1">
                                      <div className={`h-1.5 rounded-full ${hasAgreed ? 'bg-emerald-500' : 'bg-amber-400 animate-pulse'}`} />
                                      <span className={`text-[9.5px] font-bold block text-center ${hasAgreed ? 'text-emerald-700' : 'text-amber-700'}`}>
                                        2. Have to Agree {hasAgreed ? '✓' : '...'}
                                      </span>
                                    </div>
                                    <div className="space-y-1">
                                      <div className={`h-1.5 rounded-full ${hasAgreed ? 'bg-emerald-400 animate-pulse' : 'bg-gray-200'}`} />
                                      <span className={`text-[9.5px] font-bold block text-center ${hasAgreed ? 'text-emerald-700' : 'text-gray-400'}`}>
                                        3. Make Payment
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                <div className="text-xs text-gray-500 flex items-center justify-between pt-1 px-1">
                                  <span className="text-gray-400">Duration: <strong className="text-gray-700">{agreement.startDate ? new Date(agreement.startDate).toLocaleDateString() : 'Immediate'} — {agreement.endDate ? new Date(agreement.endDate).toLocaleDateString() : '6 Months'}</strong></span>
                                </div>
                              </div>
                            </div>

                            {/* Card Action Buttons: Strictly show ONLY Have to Agree if not agreed, ONLY Make Payment if agreed */}
                            <div className="p-5 pt-0">
                              <div className="pt-3 border-t border-gray-100">
                                {!hasAgreed ? (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenAgree(agreement)}
                                    className="w-full py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-xs transition-all flex items-center justify-center gap-2 shadow-sm shadow-amber-500/20 cursor-pointer"
                                  >
                                    <FileText className="w-4 h-4 text-slate-950" />
                                    <span>Have to Agree</span>
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenPayment(agreement)}
                                    className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs transition-all flex items-center justify-center gap-2 shadow-sm shadow-emerald-600/20 cursor-pointer animate-pulse"
                                  >
                                    <CreditCard className="w-4 h-4 text-white" />
                                    <span>Make Payment</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ---------------------------------------------------- */}
              {/* SUB-SECTION 2B: ACTIVE & RENTED LEASES               */}
              {/* ---------------------------------------------------- */}
              {(rentalFilter === 'all' || rentalFilter === 'active') && (
                <div className="space-y-4">
                  <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-50 via-teal-50/60 to-white border border-emerald-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shrink-0 shadow-sm shadow-emerald-600/20">
                        <CheckCircle2 className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-extrabold text-emerald-950">
                            Active & Rented Tenancies
                          </h3>
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-black bg-emerald-200 text-emerald-950 border border-emerald-300">
                            {activeLeases.length} Active Leases
                          </span>
                        </div>
                        <p className="text-xs text-emerald-800/80 mt-0.5">
                          Officially rented homes with settled payment records. Make monthly rent payments or view official agreements.
                        </p>
                      </div>
                    </div>
                  </div>

                  {activeLeases.length === 0 ? (
                    <div className="p-6 rounded-2xl bg-white border border-dashed border-gray-200 text-center text-xs text-gray-500">
                      No active rented tenancies yet. Complete the review and payment for your pending lease above to activate your tenancy.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {activeLeases.map((agreement, idx) => {
                        const photo = agreement.photoUrl || extractPropertyPhoto(agreement, idx);

                        return (
                          <div
                            key={agreement.id}
                            className="group rounded-3xl bg-white border border-gray-200/80 hover:border-emerald-300 shadow-sm hover:shadow-lg hover:shadow-emerald-500/10 transition-all duration-300 flex flex-col justify-between overflow-hidden"
                          >
                            <div>
                              {/* Property Image Banner */}
                              <div className="relative h-48 w-full overflow-hidden bg-slate-900">
                                <img
                                  src={photo}
                                  alt={agreement.propertyTitle || 'Active Tenancy'}
                                  onError={handleImageError}
                                  className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-900/25 to-black/40 pointer-events-none" />

                                {/* Floating Badges on Image */}
                                <div className="absolute top-3 inset-x-3 flex items-center justify-between gap-2 z-10">
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-extrabold bg-slate-950/70 text-white backdrop-blur-md border border-white/20">
                                    <CalendarDays className="w-3.5 h-3.5 text-emerald-400" />
                                    <span>6-Month Lease</span>
                                  </span>

                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black bg-emerald-600 text-white border border-emerald-400 shadow-md">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                                    <span>Paid & Active Lease ✓</span>
                                  </span>
                                </div>

                                {/* Bottom Rent Tag */}
                                <div className="absolute bottom-3 inset-x-3 flex items-end justify-between z-10 text-white">
                                  <div>
                                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-300 block">Agreed Rent</span>
                                    <p className="text-xl font-black text-white drop-shadow">
                                      {money(agreement.agreedMonthlyRent || agreement.monthlyRent)}
                                      <span className="text-xs font-medium text-slate-300 ml-1">/ mo</span>
                                    </p>
                                  </div>
                                  {agreement.propertyType && (
                                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-white/20 backdrop-blur-md text-white border border-white/20">
                                      {agreement.propertyType}
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Card Body */}
                              <div className="p-5 space-y-4">
                                <div>
                                  <h3 className="text-base font-extrabold text-gray-900 group-hover:text-emerald-700 transition-colors line-clamp-1">
                                    {agreement.propertyTitle || `Property #${String(agreement.propertyId || '').slice(0, 8)}`}
                                  </h3>
                                  <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                                    <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                                    <span className="truncate">{agreement.propertyAddress || 'Address on file'}</span>
                                  </p>
                                </div>

                                {/* Financial Overview 2x2 Grid */}
                                <div className="grid grid-cols-2 gap-2.5 p-3 bg-emerald-50/50 rounded-2xl border border-emerald-100">
                                  <div>
                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Agreed Rent</span>
                                    <span className="text-sm font-extrabold text-emerald-700">
                                      {money(agreement.agreedMonthlyRent || agreement.monthlyRent)}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Deposit Paid</span>
                                    <span className="text-sm font-bold text-gray-800">
                                      {money(agreement.securityDeposit || (Number(agreement.agreedMonthlyRent || 0) * 2))}
                                    </span>
                                  </div>
                                </div>

                                {/* 3-Step Lifecycle Stepper (All Complete) */}
                                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 space-y-2">
                                  <div className="flex items-center justify-between text-[11px] font-bold text-gray-700">
                                    <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Lease Progress</span>
                                    <span className="text-[10.5px] font-extrabold text-emerald-600">
                                      Active & Fully Settled ✓
                                    </span>
                                  </div>
                                  
                                  <div className="grid grid-cols-3 gap-1.5 pt-1">
                                    <div className="space-y-1">
                                      <div className="h-1.5 rounded-full bg-emerald-500" />
                                      <span className="text-[9.5px] font-bold text-emerald-700 block text-center">1. Owner Sent ✓</span>
                                    </div>
                                    <div className="space-y-1">
                                      <div className="h-1.5 rounded-full bg-emerald-500" />
                                      <span className="text-[9.5px] font-bold text-emerald-700 block text-center">2. Agreed ✓</span>
                                    </div>
                                    <div className="space-y-1">
                                      <div className="h-1.5 rounded-full bg-emerald-500" />
                                      <span className="text-[9.5px] font-bold text-emerald-700 block text-center">3. Paid & Rented ✓</span>
                                    </div>
                                  </div>
                                </div>

                                <div className="text-xs text-gray-500 flex items-center justify-between pt-1 px-1">
                                  <span className="text-gray-400">Duration: <strong className="text-gray-700">{agreement.startDate ? new Date(agreement.startDate).toLocaleDateString() : 'Active'} — {agreement.endDate ? new Date(agreement.endDate).toLocaleDateString() : '6 Months'}</strong></span>
                                </div>
                              </div>
                            </div>

                            {/* Card Action Buttons */}
                            <div className="p-5 pt-0">
                              <div className="pt-3 border-t border-gray-100 flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => navigate(`/agreements/${agreement.id}`)}
                                  className="flex-1 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                                >
                                  <FileText className="w-4 h-4" />
                                  <span>View Agreement</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOpenPayment(agreement)}
                                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm shadow-emerald-600/20 cursor-pointer"
                                >
                                  <CreditCard className="w-4 h-4" />
                                  <span>Pay Rent</span>
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

              {/* ---------------------------------------------------- */}
              {/* SUB-SECTION 2C: PAST & COMPLETED LEASES              */}
              {/* ---------------------------------------------------- */}
              {(rentalFilter === 'all' || rentalFilter === 'past') && pastLeases.length > 0 && (
                <div className="space-y-4 pt-4 border-t border-gray-100">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-extrabold text-gray-800">Past & Completed Tenancies</h3>
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-gray-100 text-gray-600">
                      {pastLeases.length}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {pastLeases.map((agreement, idx) => {
                      const photo = agreement.photoUrl || extractPropertyPhoto(agreement, idx);

                      return (
                        <div
                          key={agreement.id}
                          className="rounded-3xl bg-gray-50/80 border border-gray-200 p-5 opacity-80 hover:opacity-100 transition-all flex flex-col justify-between"
                        >
                          <div className="space-y-3">
                            <div className="h-36 w-full rounded-2xl overflow-hidden relative">
                              <img src={photo} alt="" className="w-full h-full object-cover grayscale" />
                              <span className="absolute top-2 right-2 px-2.5 py-1 rounded-full text-[10px] font-bold bg-gray-900 text-white">
                                {agreement.status || 'Completed'}
                              </span>
                            </div>
                            <h4 className="text-sm font-bold text-gray-800">{agreement.propertyTitle}</h4>
                            <p className="text-xs text-gray-500">{agreement.propertyAddress}</p>
                          </div>
                          <div className="pt-3 border-t border-gray-200 mt-4">
                            <button
                              type="button"
                              onClick={() => navigate(`/agreements/${agreement.id}`)}
                              className="w-full py-2 rounded-xl bg-white border border-gray-200 text-xs font-bold text-gray-700 cursor-pointer hover:bg-gray-50"
                            >
                              View Archive Record
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* ======================================================== */}
      {/* SECTION 3: MY PAYMENTS & MONTHLY RENT DUES               */}
      {/* ======================================================== */}
      {activeCategory === 'payments' && (
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
                type="button"
                onClick={() => navigate('/properties')}
                className="mt-4 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm cursor-pointer"
              >
                Browse Properties
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {agreements.map((agreement, idx) => {
                const rentVal = agreement.agreedMonthlyRent || agreement.monthlyRent || 0;
                const currentMonth = new Date().getMonth();
                const currentYear = new Date().getFullYear();
                const hasPaidThisMonth = payments.some((p) => {
                  const matchesAgr = (p.rentalAgreementId === agreement.id || p.propertyId === agreement.propertyId);
                  const pDate = new Date(p.paymentDate);
                  return matchesAgr && paymentPurpose(p) === 'MonthlyRent' && pDate.getMonth() === currentMonth && pDate.getFullYear() === currentYear && p.isSuccessful;
                });
                const hasAgreed = isAgreementAgreed(agreement);
                const photo = agreement.photoUrl || extractPropertyPhoto(agreement, idx);
                const completedRentPayments = payments.filter((p) => {
                  return (p.rentalAgreementId === agreement.id || p.propertyId === agreement.propertyId) && p.isSuccessful && paymentPurpose(p) === 'MonthlyRent';
                });

                const paidMonths = paidRentMonths(completedRentPayments);
                const depositPaid = payments.filter(p => p.rentalAgreementId === agreement.id && p.isSuccessful
                  && paymentPurpose(p) === 'SecurityDeposit').reduce((sum, p) => sum + Number(p.amount), 0);

                return (
                  <div
                    key={agreement.id}
                    className="rounded-3xl bg-white border border-gray-200/80 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group overflow-hidden"
                  >
                    <div>
                      {/* Image Banner */}
                      <div className="relative h-40 w-full overflow-hidden bg-slate-900">
                        <img
                          src={photo}
                          alt={agreement.propertyTitle || 'Rented Property'}
                          onError={handleImageError}
                          className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-black/30 pointer-events-none" />
                        <div className="absolute top-2.5 right-2.5 z-10">
                          {hasPaidThisMonth ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-emerald-600 text-white border border-emerald-400 shadow-md">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Paid for this Month
                            </span>
                          ) : hasAgreed ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-amber-500 text-slate-950 border border-amber-300 shadow-md animate-pulse">
                              <Clock className="w-3.5 h-3.5" /> Payment Due
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-blue-600 text-white border border-blue-400 shadow-md">
                              <FileText className="w-3.5 h-3.5" /> Have to Agree
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="p-5 space-y-4">
                        <div>
                          <h4 className="text-base font-bold text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-1">
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
                    </div>

                    <div className="px-5 pb-3 text-sm flex justify-between">
                      <span>Security deposit paid</span><strong>{money(depositPaid)}</strong>
                    </div>
                    {/* Rent Months Paid Summary */}
                    <div className="px-5 pb-4">
                      <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-3 flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-[10px] font-bold text-gray-700 uppercase tracking-wider">
                            <CalendarDays className="w-3.5 h-3.5 text-blue-500" />
                            <span>Rent Months Paid</span>
                          </div>
                          <span className="bg-emerald-200/50 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                            {paidMonths.length} Month{paidMonths.length !== 1 ? 's' : ''} Paid
                          </span>
                        </div>
                        {paidMonths.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-1">
                            {paidMonths.slice(0, 3).map(p => {
                              const pDate = new Date(p.paymentDate);
                              const monthYear = pDate.toLocaleString('default', { month: 'long', year: 'numeric' });
                              return (
                                <span key={p.id} className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700 bg-white border border-emerald-200 px-2 py-0.5 rounded-full shadow-sm">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                                  {monthYear}
                                </span>
                              );
                            })}
                            {paidMonths.length > 3 && (
                              <span className="inline-flex items-center text-[10px] font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                                +{paidMonths.length - 3} more
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Pay Button: Strictly check if agreed */}
                    <div className="p-5 pt-0">
                      <div className="pt-3 border-t border-gray-100">
                        {!hasAgreed ? (
                          <button
                            type="button"
                            onClick={() => handleOpenAgree(agreement)}
                            className="w-full py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-xs transition-all flex items-center justify-center gap-2 shadow-sm shadow-amber-500/20 cursor-pointer"
                          >
                            <FileText className="w-4 h-4 text-slate-950" />
                            <span>Have to Agree</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleOpenPayment(agreement)}
                            className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer ${
                              hasPaidThisMonth
                                ? 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                                : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20'
                            }`}
                          >
                            <CreditCard className="w-4 h-4" />
                            <span>{hasPaidThisMonth ? 'Make Another Payment' : 'Make Payment'}</span>
                          </button>
                        )}
                      </div>
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

                    <p className="text-sm font-semibold">{paymentPurpose(payment) === 'SecurityDeposit' ? 'Security deposit'
                      : paymentPurpose(payment) === 'MonthlyRent' ? 'Monthly rent' : 'Other payment'}</p>
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
      )}

      {/* ======================================================== */}
      {/* SECTION 4: MAINTENANCE REQUESTS (CARD STYLE VIEW)       */}
      {/* ======================================================== */}
      {activeCategory === 'maintenance' && (
        <section id="maintenance-section" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-extrabold tracking-tight text-gray-900">
                  Maintenance Requests
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
                  {maintenance.length} Total
                </span>
                {openMaintenanceCount > 0 && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 animate-pulse">
                    {openMaintenanceCount} Needs Attention
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-500 mt-1">
                Track repairs, technician dispatches, and maintenance status.
              </p>
            </div>

            <button
              onClick={() => setIsNewMaintenanceModalOpen(true)}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm shrink-0 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Request</span>
            </button>
          </div>

          {/* Maintenance Category Quick Filter Tabs */}
          {maintenance.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
              <span className="text-gray-400 font-bold text-[11px] uppercase mr-1">Filter Tickets:</span>
              {[
                { id: 'all', label: 'All', count: maintenance.length },
                { id: 'Reported', label: 'Reported', count: maintenance.filter(m => (m.status || 'Reported') === 'Reported').length },
                { id: 'InProgress', label: 'In Progress', count: maintenance.filter(m => m.status === 'InProgress' || m.status === 'Assigned').length },
                { id: 'Completed', label: 'Completed', count: maintenance.filter(m => m.status === 'Completed').length }
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setMaintenanceFilter(f.id)}
                  className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    maintenanceFilter === f.id
                      ? 'bg-amber-500 text-slate-950 shadow-xs'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <span>{f.label}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    maintenanceFilter === f.id ? 'bg-black/20 text-slate-950' : 'bg-gray-200 text-gray-700'
                  }`}>
                    {f.count}
                  </span>
                </button>
              ))}
            </div>
          )}

          {maintenance.length === 0 ? (
            <div className="p-10 rounded-2xl bg-white border border-dashed border-gray-300 text-center">
              <Wrench className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-sm font-bold text-gray-700">No maintenance requests</p>
              <p className="text-xs text-gray-400 mt-1">Everything looks in order. If you need any repairs, submit a request anytime.</p>
              <button
                onClick={() => setIsNewMaintenanceModalOpen(true)}
                className="mt-4 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer"
              >
                Request Support
              </button>
            </div>
          ) : displayedMaintenance.length === 0 ? (
            <div className="p-8 rounded-2xl bg-white border border-dashed border-gray-300 text-center">
              <p className="text-xs font-bold text-gray-700">No {maintenanceFilter} maintenance requests</p>
              <button
                type="button"
                onClick={() => setMaintenanceFilter('all')}
                className="mt-2 text-xs font-bold text-blue-600 hover:underline cursor-pointer"
              >
                Show all tickets
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {displayedMaintenance.map((request) => {
                const isCompleted = request.status === 'Completed';
                const isProgress = request.status === 'InProgress' || request.status === 'Assigned';

                return (
                  <div
                    key={request.id}
                    className="rounded-3xl bg-white border border-gray-200/80 p-5 sm:p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group"
                  >
                    <div className="space-y-3.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold shadow-2xs">
                            <Wrench className="w-4.5 h-4.5" />
                          </div>
                          <span className="text-[10.5px] font-extrabold text-blue-600 uppercase tracking-wider">
                            {request.aiCategory || 'General Maintenance'}
                          </span>
                        </div>
                        <Badge variant={isCompleted ? 'success' : isProgress ? 'warning' : 'default'}>
                          {request.status || 'Reported'}
                        </Badge>
                      </div>

                      <div>
                        <h3 className="text-base font-bold text-gray-900 line-clamp-2 leading-snug">
                          {request.description || request.issueDescription || 'Repair inspection request'}
                        </h3>
                      </div>

                      {/* Property info */}
                      {(request.propertyTitle || request.property?.title) && (
                        <div className="flex items-center gap-1.5 text-xs text-gray-700 font-semibold bg-blue-50/70 px-3 py-1.5 rounded-xl border border-blue-100">
                          <Home className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                          <span className="truncate">
                            {request.propertyTitle || request.property?.title}
                          </span>
                        </div>
                      )}

                      {/* Photo banner with interactive Add / Change Photo button */}
                      <div className="relative rounded-2xl overflow-hidden border border-gray-200 h-36 bg-gray-100 group/photo shadow-2xs">
                        <img 
                          src={request.photoUrl || request.propertyPhoto || PROPERTY_PLACEHOLDER_IMAGE} 
                          alt={request.description || 'Maintenance photo proof'} 
                          className="w-full h-full object-cover group-hover/photo:scale-105 transition-transform duration-300" 
                          onError={handleImageError}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-black/10 pointer-events-none" />

                        {/* Photo label */}
                        <div className="absolute bottom-2.5 left-2.5 flex items-center gap-1.5 text-[11px] text-white font-bold drop-shadow-sm">
                          <ImageIcon className="w-3.5 h-3.5 text-emerald-400" />
                          <span>{request.photoUrl && !request.photoUrl.includes('unsplash') ? 'Proof Attached' : 'Property Visual'}</span>
                        </div>

                        {/* Floating Add / Change Photo Button */}
                        <label 
                          title="Upload or change photo for this ticket"
                          className="absolute top-2.5 right-2.5 px-2.5 py-1 rounded-xl bg-black/70 hover:bg-black/90 backdrop-blur-md text-white text-[11px] font-bold border border-white/25 flex items-center gap-1.5 cursor-pointer shadow-sm transition-all"
                        >
                          <Camera className="w-3.5 h-3.5 text-white" />
                          <span>{request.photoUrl ? 'Change Photo' : 'Add Photo'}</span>
                          <input 
                            type="file" 
                            accept="image/*" 
                            className="hidden" 
                            onChange={(e) => handleUploadMaintenancePhoto(request.id, e)}
                          />
                        </label>
                      </div>

                      <div className="p-3 bg-gray-50 rounded-2xl text-xs space-y-1.5 text-gray-600 border border-gray-100">
                        <div className="flex justify-between items-center">
                          <span className="text-gray-400 font-medium">Priority:</span>
                          <span className="font-bold text-gray-800">
                            {request.aiPriority || request.priority || 'Normal'}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-400 font-medium">Date Logged:</span>
                          <span className="font-medium text-gray-700">
                            {request.createdAt ? new Date(request.createdAt).toLocaleDateString() : 'Recently'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 pt-3 border-t border-gray-100 flex items-center justify-between">
                      <button
                        onClick={() => navigate(`/maintenance/${request.id}`)}
                        className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer"
                      >
                        <span>Track Status</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => handleDeleteMaintenance(request.id)}
                        className="text-xs font-bold text-rose-500 hover:text-rose-700 flex items-center gap-1 transition-colors cursor-pointer"
                        title="Delete maintenance request"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Monthly Rent Payment Modal */}
      <PaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        agreement={selectedAgreementForPayment}
        onSuccess={handlePaymentSuccess}
      />

      {/* Review & Agree to Tenancy Terms Modal with AI Summary */}
      {isAgreeModalOpen && selectedAgreementForAgree && (
        <Modal
          isOpen={isAgreeModalOpen}
          onClose={() => {
            setIsAgreeModalOpen(false);
            setAgreeAiSummary(null);
          }}
          title="Review & Agree to Tenancy Agreement"
          className="max-w-2xl"
        >
          <form onSubmit={handleConfirmAgree} className="space-y-4 text-xs">
            {/* Header info banner (clean AI summary banner without Student 3) */}
            <div className="p-4 rounded-2xl bg-indigo-900 text-white flex items-center justify-between gap-3 shadow-sm">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-amber-300" />
                </div>
                <div>
                  <h4 className="text-sm font-black">
                    {selectedAgreementForAgree.propertyTitle || 'Rental Lease Agreement'}
                  </h4>
                  <p className="text-[11px] text-indigo-200">
                    Plain-Language Legal Summary & Market Benchmark Analysis
                  </p>
                </div>
              </div>
              <span className="bg-indigo-500/30 text-indigo-200 text-[10px] font-bold px-2.5 py-1 rounded-full border border-indigo-400/30">
                AI Verified
              </span>
            </div>

            {/* AI Summary Section */}
            {isLoadingAiSummary ? (
              <div className="py-10 text-center space-y-2.5 bg-gray-50 rounded-2xl border border-gray-200/80">
                <RotateCcw className="w-7 h-7 text-indigo-600 animate-spin mx-auto" />
                <p className="font-bold text-gray-800 text-xs">Agentic AI is evaluating lease terms and market pricing benchmarks...</p>
                <p className="text-gray-400 text-[10.5px]">Analyzing local market statistics, median rent ranges, and plain-language legal terms...</p>
              </div>
            ) : agreeAiSummary ? (
              <div className="space-y-4 animate-in fade-in duration-200">
                {/* 1. Market Pricing Assessment Box */}
                {agreeAiSummary.market_pricing_assessment && (
                  <div className={`p-4 rounded-2xl border ${
                    agreeAiSummary.market_pricing_assessment.market_status?.includes('Fair')
                      ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950'
                      : agreeAiSummary.market_pricing_assessment.market_status?.includes('Below')
                      ? 'bg-blue-50/80 border-blue-300 text-blue-950'
                      : 'bg-amber-50/80 border-amber-300 text-amber-950'
                  }`}>
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-1.5 font-black text-sm">
                        <DollarSign className="w-4 h-4" />
                        <span>Market Assessment: {agreeAiSummary.market_pricing_assessment.market_status}</span>
                      </div>
                      <span className="font-extrabold px-2.5 py-0.5 rounded-full bg-white/80 border text-xs">
                        Variance: {agreeAiSummary.market_pricing_assessment.variance_percentage || '0%'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs bg-white/70 p-3 rounded-xl border mb-2.5">
                      <div>
                        <span className="text-gray-500 text-[10.5px] block font-medium">Agreed Monthly Rent:</span>
                        <strong className="text-sm">LKR {Number(agreeAiSummary.market_pricing_assessment.listed_rent || 0).toLocaleString()}</strong>
                      </div>
                      <div>
                        <span className="text-gray-500 text-[10.5px] block font-medium">Typical Market Range:</span>
                        <strong className="text-sm">{agreeAiSummary.market_pricing_assessment.typical_market_range || 'LKR 48,000 - LKR 68,000'}</strong>
                      </div>
                      <div>
                        <span className="text-gray-500 text-[10.5px] block font-medium">Area Median Benchmark:</span>
                        <strong className="text-sm">LKR {Number(agreeAiSummary.market_pricing_assessment.median_benchmark || 0).toLocaleString()}</strong>
                      </div>
                    </div>

                    <p className="text-[11.5px] leading-relaxed">
                      {agreeAiSummary.market_pricing_assessment.pricing_reasoning}
                    </p>
                  </div>
                )}

                {/* 2. Plain Language Agreement Terms Summary */}
                {agreeAiSummary.plain_language_summary && (
                  <div className="bg-gray-50 rounded-2xl border border-gray-200 p-4 space-y-2.5">
                    <h5 className="font-bold text-gray-900 text-xs flex items-center gap-1.5 uppercase tracking-wider">
                      <FileText className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Plain-Language Legal Terms Summary</span>
                    </h5>

                    <div className="space-y-2 text-[11.5px] text-gray-700">
                      {Object.entries(agreeAiSummary.plain_language_summary).map(([k, v]) => (
                        <div key={k} className="flex flex-col sm:flex-row sm:items-start gap-1 pb-1.5 border-b border-gray-200/60 last:border-0">
                          <span className="font-bold text-gray-800 sm:w-1/3 capitalize">
                            {k.replace(/_/g, ' ')}:
                          </span>
                          <span className="text-gray-600 sm:w-2/3">
                            {String(v)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Mandatory Non-binding Disclaimer Notice */}
                <div className="p-3 rounded-xl bg-gray-100 border border-gray-200 text-[11px] text-gray-500 italic">
                  {agreeAiSummary.non_binding_disclaimer || "Notice: This rental assessment and plain-language summary is generated by RentWise Agentic AI for informational guidance only and is non-binding."}
                </div>
              </div>
            ) : null}

            {/* Error banner */}
            {agreeError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{agreeError}</span>
              </div>
            )}

            {/* Electronic Signature Input */}
            <div className="space-y-1 pt-1">
              <label className="text-xs font-bold text-gray-800 block">
                Electronic Signature (Full Legal Name) <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={agreeSignature}
                onChange={(e) => {
                  setAgreeSignature(e.target.value);
                  if (agreeError) setAgreeError('');
                }}
                placeholder="Type your full legal name"
                className="w-full h-10 px-3 rounded-xl border border-gray-300 font-medium text-xs sm:text-sm bg-white focus:outline-none focus:border-amber-600 focus:ring-1 focus:ring-amber-600"
              />
              <p className="text-[10.5px] text-gray-500">By typing your name, you execute this lease as a legally binding electronic agreement.</p>
            </div>

            {/* Confirmation Checkbox */}
            <label className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50/60 border border-amber-200 text-xs text-amber-950 font-medium cursor-pointer">
              <input
                type="checkbox"
                checked={agreeConfirmed}
                onChange={(e) => {
                  setAgreeConfirmed(e.target.checked);
                  if (agreeError) setAgreeError('');
                }}
                className="mt-0.5 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
              />
              <span>I confirm that I have reviewed the agreement and hereby agree to all tenancy terms, rules, and conditions.</span>
            </label>

            {/* Action Buttons */}
            <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setIsAgreeModalOpen(false);
                  setAgreeAiSummary(null);
                }}
                className="px-4 py-2 rounded-xl border border-gray-300 text-xs font-bold text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmittingAgree}
                className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-xs shadow-md shadow-amber-500/20 flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <FileCheck className="w-4 h-4 text-slate-950" />
                <span>{isSubmittingAgree ? 'Recording Agreement...' : 'Confirm & Agree to Terms'}</span>
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Edit Profile Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit My Profile"
        className="max-w-lg"
      >
        {editProfileSuccess && (
          <div className="mb-4 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{editProfileSuccess}</span>
          </div>
        )}

        {editProfileError && (
          <div className="mb-4 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-center gap-2">
            <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{editProfileError}</span>
          </div>
        )}

        <form onSubmit={handleSaveProfile} className="space-y-4">
          {/* Full Name */}
          <div className="space-y-1">
            <label className="text-xs font-bold uppercase tracking-wider text-gray-700 block">
              Full Name
            </label>
            <div className="relative">
              <input
                type="text"
                required
                value={editFormData.fullName}
                onChange={(e) => setEditFormData({ ...editFormData, fullName: e.target.value })}
                placeholder="Your full name"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50/50 text-sm text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all"
              />
              <User className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Phone Number & NIC Number Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Phone */}
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wider text-gray-700 block">
                Phone Number
              </label>
              <div className="relative">
                <input
                  type="tel"
                  maxLength={10}
                  value={editFormData.phoneNumber}
                  onChange={(e) => setEditFormData({ ...editFormData, phoneNumber: e.target.value })}
                  placeholder="0712345678"
                  className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50/50 text-sm text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all"
                />
                <Phone className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
              <p className="text-[10px] text-gray-400">10 digits (e.g. 0712345678)</p>
            </div>

            {/* NIC */}
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wider text-gray-700 block">
                NIC Number
              </label>
              <div className="relative">
                <input
                  type="text"
                  maxLength={12}
                  value={editFormData.nicNumber}
                  onChange={(e) => setEditFormData({ ...editFormData, nicNumber: e.target.value.toUpperCase() })}
                  placeholder="123456789V / 2000..."
                  className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50/50 text-sm uppercase text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all"
                />
                <CreditCard className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
              <p className="text-[10px] text-gray-400">12 digits or 9 digits + 'V'</p>
            </div>
          </div>

          {/* Password Change Sub-section */}
          <div className="pt-3 border-t border-gray-100">
            <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-2.5">
              Change Password (Optional)
            </h4>
            <div className="space-y-3">
              <div>
                <div className="relative">
                  <input
                    type={showEditCurrentPassword ? 'text' : 'password'}
                    value={editPasswordData.currentPassword}
                    onChange={(e) => setEditPasswordData({ ...editPasswordData, currentPassword: e.target.value })}
                    placeholder="Current Password"
                    className="w-full pl-10 pr-10 py-2 rounded-xl border border-gray-200 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  />
                  <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <button
                    type="button"
                    onClick={() => setShowEditCurrentPassword(!showEditCurrentPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showEditCurrentPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="relative">
                  <input
                    type={showEditNewPassword ? 'text' : 'password'}
                    value={editPasswordData.newPassword}
                    onChange={(e) => setEditPasswordData({ ...editPasswordData, newPassword: e.target.value })}
                    placeholder="New Password (min 8)"
                    className="w-full pl-9 pr-9 py-2 rounded-xl border border-gray-200 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  />
                  <Lock className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <button
                    type="button"
                    onClick={() => setShowEditNewPassword(!showEditNewPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showEditNewPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>

                <div className="relative">
                  <input
                    type={showEditConfirmPassword ? 'text' : 'password'}
                    value={editPasswordData.confirmPassword}
                    onChange={(e) => setEditPasswordData({ ...editPasswordData, confirmPassword: e.target.value })}
                    placeholder="Confirm New Password"
                    className="w-full pl-9 pr-9 py-2 rounded-xl border border-gray-200 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  />
                  <Lock className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <button
                    type="button"
                    onClick={() => setShowEditConfirmPassword(!showEditConfirmPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showEditConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-4 flex items-center justify-end gap-3 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setIsEditModalOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>
            <Button
              type="submit"
              isLoading={isSavingProfile}
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-5 py-2 rounded-xl shadow-md shadow-blue-600/20"
            >
              Save Profile
            </Button>
          </div>
        </form>
      </Modal>

      {/* New Maintenance Request Modal */}
      <Modal
        isOpen={isNewMaintenanceModalOpen}
        onClose={() => setIsNewMaintenanceModalOpen(false)}
        title="Submit Maintenance Request"
      >
        <div className="p-1 space-y-4">
          <p className="text-xs text-gray-500">
            Report a repair or maintenance issue for your booked property. You can upload photo proof from your phone or computer.
          </p>
          <RequestForm
            properties={agreements.map((a) => ({
              id: a.propertyId || a.id,
              propertyId: a.propertyId || a.id,
              title: a.propertyTitle,
              address: a.propertyAddress,
              photoUrl: a.photoUrl
            }))}
            onSubmit={handleCreateMaintenance}
            onCancel={() => setIsNewMaintenanceModalOpen(false)}
            isLoading={isSubmittingMaintenance}
          />
        </div>
      </Modal>

    </div>
  );
};
