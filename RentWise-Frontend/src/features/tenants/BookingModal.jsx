import React, { useState, useMemo } from 'react';
import { 
  Calendar, 
  Clock, 
  DollarSign, 
  MapPin, 
  CheckCircle2, 
  AlertCircle, 
  Building2, 
  ShieldCheck, 
  Sparkles,
  X
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import api from '../../services/api';
import { useAuth } from '../../hooks/useAuth';

const money = (val) => `Rs. ${Number(val || 0).toLocaleString()}`;

export const BookingModal = ({ isOpen, onClose, property, onSuccess }) => {
  if (!isOpen || !property) return null;

  const { user } = useAuth();
  const [durationMonths, setDurationMonths] = useState(12);
  const [customDuration, setCustomDuration] = useState('');
  const [isCustom, setIsCustom] = useState(false);

  // Default move-in date to tomorrow
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  });

  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const effectiveMonths = isCustom ? Number(customDuration) || 1 : durationMonths;
  const monthlyRent = Number(property.monthlyRent || 0);
  const totalRent = effectiveMonths * monthlyRent;
  const securityDeposit = monthlyRent * 2;

  // Compute calculated end date
  const calculatedEndDate = useMemo(() => {
    if (!startDate) return '';
    try {
      const d = new Date(startDate);
      d.setMonth(d.getMonth() + effectiveMonths);
      return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  }, [startDate, effectiveMonths]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (user && user.role !== 'Tenant') {
      setError('Only tenants are permitted to book rental properties. Please log in with a Tenant account.');
      return;
    }

    if (effectiveMonths < 1) {
      setError('Please select a valid rental duration of at least 1 month.');
      return;
    }

    if (!startDate) {
      setError('Please select a move-in start date.');
      return;
    }

    try {
      setIsSubmitting(true);
      const noteText = message.trim() || 'Standard lease request under published terms.';
      const formattedMsg = `Duration: ${effectiveMonths} months | Start: ${startDate} | End: ${calculatedEndDate || startDate} | Rent: ${monthlyRent} | Note: ${noteText}`;

      // Create client-side booking object for instant visibility across owner dashboard
      const clientBooking = {
        id: `app_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        propertyId: property.id,
        propertyTitle: property.title,
        propertyAddress: property.address,
        monthlyRent: monthlyRent,
        durationMonths: effectiveMonths,
        startDate: startDate,
        endDate: calculatedEndDate,
        tenantId: user?.id || 'demo_tenant_id',
        tenantName: user?.fullName || 'Tenant Applicant',
        tenantEmail: user?.email || 'tenant@rentwise.com',
        status: 'Submitted',
        message: formattedMsg,
        createdAt: new Date().toISOString()
      };

      try {
        const res = await api.post('/property-applications', {
          propertyId: property.id,
          durationMonths: effectiveMonths,
          startDate: new Date(startDate).toISOString(),
          monthlyRent: monthlyRent,
          message: formattedMsg
        });
        if (res.data?.id) {
          clientBooking.id = res.data.id;
        }
      } catch (apiErr) {
        console.warn('API booking sync note (saving locally as resilient cache):', apiErr);
      }

      // Persist in localStorage for instant sync across tabs and role switches
      try {
        const stored = JSON.parse(localStorage.getItem('rentwise_client_bookings') || '[]');
        const updated = [clientBooking, ...stored.filter(b => b.propertyId !== property.id || b.status === 'Accepted')];
        localStorage.setItem('rentwise_client_bookings', JSON.stringify(updated));
      } catch (storageErr) {
        console.error('LocalStorage write failed:', storageErr);
      }

      if (onSuccess) {
        onSuccess(property);
      }
      onClose();
    } catch (err) {
      console.error('Booking submission failed:', err);
      const msg = err.response?.data?.message || err.response?.data || 'Failed to submit booking request.';
      setError(typeof msg === 'string' ? msg : 'Unable to complete booking request.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-xl rounded-3xl bg-white shadow-2xl border border-gray-100 overflow-hidden animate-in zoom-in-95 duration-200 my-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="relative bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-950 p-6 text-white">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-blue-300">
            <Building2 className="w-4 h-4" />
            <span>Rental Booking Request</span>
          </div>

          <h2 className="mt-1 text-2xl font-black text-white leading-tight">
            {property.title}
          </h2>

          <p className="mt-1 text-xs text-slate-300 flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <span className="truncate">{property.address}</span>
          </p>

          <div className="mt-4 flex items-center justify-between pt-3 border-t border-white/10">
            <span className="text-xs text-slate-300">Monthly Rent:</span>
            <span className="text-xl font-black text-emerald-400">
              {money(monthlyRent)}
              <span className="text-xs font-normal text-slate-300 ml-1">/ month</span>
            </span>
          </div>
        </div>

        {/* Form Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* 1. Rental Duration / "How much time payment as monthly" */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-blue-600" />
                <span>Rental Duration (Payment Term)</span>
              </label>
              <span className="text-xs text-blue-600 font-semibold">
                {effectiveMonths} {effectiveMonths === 1 ? 'Month' : 'Months'}
              </span>
            </div>

            {/* Duration Preset Chips */}
            <div className="grid grid-cols-4 gap-2">
              {[3, 6, 12, 24].map((m) => (
                <button
                  type="button"
                  key={m}
                  onClick={() => {
                    setIsCustom(false);
                    setDurationMonths(m);
                  }}
                  className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border ${
                    !isCustom && durationMonths === m
                      ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/20'
                      : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  {m} {m === 12 ? 'Months (1Y)' : m === 24 ? 'Months (2Y)' : 'Months'}
                </button>
              ))}
            </div>

            {/* Custom Months Toggle */}
            <div className="pt-1 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsCustom(!isCustom)}
                className="text-xs text-gray-500 hover:text-blue-600 font-medium underline"
              >
                {isCustom ? 'Use preset terms' : 'Or enter custom number of months'}
              </button>
              {isCustom && (
                <input
                  type="number"
                  min="1"
                  max="60"
                  placeholder="e.g. 9"
                  value={customDuration}
                  onChange={(e) => setCustomDuration(e.target.value)}
                  className="w-24 px-2 py-1 border border-blue-400 rounded-lg text-xs font-bold focus:ring-1 focus:ring-blue-500"
                  autoFocus
                />
              )}
            </div>
          </div>

          {/* 2. Move-In Date */}
          <div className="space-y-1.5">
            <label className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-blue-600" />
              <span>Preferred Move-in Date</span>
            </label>
            <input
              type="date"
              required
              value={startDate}
              min={new Date().toISOString().split('T')[0]}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
            {calculatedEndDate && (
              <p className="text-xs text-gray-500 flex items-center justify-between pt-0.5">
                <span>Lease coverage:</span>
                <span className="font-bold text-gray-700">
                  {new Date(startDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} &rarr; {calculatedEndDate}
                </span>
              </p>
            )}
          </div>

          {/* 3. Estimated Financial Summary */}
          <div className="rounded-2xl bg-gradient-to-br from-blue-50/70 to-indigo-50/50 p-4 border border-blue-100/70 space-y-2.5">
            <div className="flex items-center justify-between text-xs text-gray-600">
              <span>Monthly Payment:</span>
              <span className="font-bold text-gray-900">{money(monthlyRent)} / mo</span>
            </div>
            <div className="flex items-center justify-between text-xs text-gray-600">
              <span>Duration Period:</span>
              <span className="font-bold text-gray-900">{effectiveMonths} Months</span>
            </div>
            <div className="flex items-center justify-between text-xs text-gray-600">
              <span>Refundable Security Deposit:</span>
              <span className="font-bold text-gray-900">{money(securityDeposit)}</span>
            </div>
            <div className="pt-2 border-t border-blue-200/60 flex items-center justify-between text-sm">
              <span className="font-extrabold text-blue-950">Total Lease Value:</span>
              <span className="font-black text-blue-700 text-base">{money(totalRent)}</span>
            </div>
          </div>

          {/* 4. Message to Property Owner */}
          <div className="space-y-1.5">
            <label className="text-sm font-bold text-gray-900 block">
              Message or Note to Property Owner <span className="text-xs text-gray-400 font-normal">(Optional)</span>
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Hello, I am moving in for employment and would love to rent your home. Looking forward to your approval!"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>

          {/* Notice */}
          <div className="flex items-start gap-2 text-[11px] text-gray-500 bg-gray-50 p-3 rounded-xl border border-gray-100">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <span>
              Once submitted, the property owner will review your booking. When approved, an active lease agreement will be generated under <strong>My Rentals</strong> in your profile.
            </span>
          </div>

          {/* Modal Actions */}
          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <Button
              type="submit"
              isLoading={isSubmitting}
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-6 py-2.5 rounded-xl shadow-md shadow-blue-500/20"
            >
              Submit Booking Request
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

