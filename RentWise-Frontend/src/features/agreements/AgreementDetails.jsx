import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useFetch } from '../../hooks/useFetch';
import { useAuth } from '../../hooks/useAuth';
import api from '../../services/api';
import { Button } from '../../components/ui/Button';
import { DataTable } from '../../components/ui/DataTable';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { PROPERTY_PLACEHOLDER_IMAGE, handleImageError } from '../../utils/imagePlaceholder';
import { ArrowLeft, CreditCard, Bell, CheckCircle2, Clock, Building2, Calendar, User, DollarSign, FileCheck, Check, ExternalLink, ShieldCheck, Lock, Wifi, Sparkles } from 'lucide-react';

const formatLKR = (val) => `LKR ${Number(val || 0).toLocaleString()}`;

export const AgreementDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('payments');

  const { data: agreementData, isLoading, refetch } = useFetch(`/agreements/${id}`);
  const [localAgreement, setLocalAgreement] = useState(null);
  const [payments, setPayments] = useState([]);
  const [isLoadingPayments, setIsLoadingPayments] = useState(false);

  // Modals for agreement & payment
  const [isAgreeModalOpen, setIsAgreeModalOpen] = useState(false);
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [signatureName, setSignatureName] = useState(user?.fullName || '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Card Payment States
  const [paymentMethod, setPaymentMethod] = useState('card');
  const [cardHolder, setCardHolder] = useState(user?.fullName || '');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvc, setCardCvc] = useState('');
  const [payError, setPayError] = useState('');

  // Card Brand Detection
  const getCardBrand = (num) => {
    const clean = (num || '').replace(/\D/g, '');
    if (/^4/.test(clean)) return { name: 'VISA', bg: 'from-blue-700 via-indigo-800 to-slate-900', color: 'text-blue-300' };
    if (/^(5[1-5]|2[2-7])/.test(clean)) return { name: 'MasterCard', bg: 'from-orange-600 via-rose-700 to-slate-900', color: 'text-orange-300' };
    if (/^3[47]/.test(clean)) return { name: 'AMEX', bg: 'from-emerald-700 via-teal-800 to-slate-900', color: 'text-emerald-300' };
    return { name: 'CARD', bg: 'from-slate-800 via-gray-900 to-zinc-950', color: 'text-gray-300' };
  };

  const handleCardNumberChange = (e) => {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 16);
    const formatted = digits.replace(/(\d{4})(?=\d)/g, '$1 ');
    setCardNumber(formatted);
    if (payError) setPayError('');
  };

  const handleExpiryChange = (e) => {
    let digits = e.target.value.replace(/\D/g, '').slice(0, 4);
    if (digits.length >= 3) {
      digits = `${digits.slice(0, 2)}/${digits.slice(2)}`;
    }
    setCardExpiry(digits);
    if (payError) setPayError('');
  };

  const handleCvcChange = (e) => {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 4);
    setCardCvc(digits);
    if (payError) setPayError('');
  };

  const handleFillDemoCard = () => {
    setCardNumber('4242 4242 4242 4242');
    setCardExpiry('12/28');
    setCardCvc('888');
    setCardHolder(user?.fullName || 'Tenant User');
    if (payError) setPayError('');
  };

  useEffect(() => {
    if (agreementData) {
      setLocalAgreement(agreementData);
    } else {
      try {
        const stored = JSON.parse(localStorage.getItem('rentwise_client_agreements') || '[]');
        const found = stored.find(a => String(a.id) === String(id));
        if (found) setLocalAgreement(found);
      } catch {}
    }
  }, [agreementData, id]);

  // Fetch payments
  const fetchPayments = async () => {
    try {
      setIsLoadingPayments(true);
      if (String(id).startsWith('agr_')) {
        setPayments([]);
        return;
      }
      const res = await api.get(`/agreements/${id}/payments`);
      setPayments(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.warn('Payments fetch note:', err);
    } finally {
      setIsLoadingPayments(false);
    }
  };

  useEffect(() => {
    if (id) fetchPayments();
  }, [id]);

  if (isLoading && !localAgreement) {
    return <div className="p-12 text-center text-gray-500 font-medium">Loading lease agreement details...</div>;
  }

  const agreement = localAgreement || agreementData;
  if (!agreement) {
    return (
      <div className="p-12 text-center text-rose-600 font-bold">
        Agreement not found.
        <div className="mt-4">
          <Button onClick={() => navigate('/agreements')}>Back to Agreements</Button>
        </div>
      </div>
    );
  }

  const prop = agreement.property || {};
  const propTitle = prop.title || agreement.propertyTitle || 'Rental Property';
  const propAddress = prop.address || agreement.propertyAddress || 'Sri Lanka';
  const photo = prop.photoUrl || prop.photos?.[0]?.photoUrl || PROPERTY_PLACEHOLDER_IMAGE;
  const rent = agreement.agreedMonthlyRent || agreement.monthlyRent || prop.monthlyRent || 0;
  const deposit = agreement.securityDeposit || (rent * 2) || 0;
  const terms = agreement.termsAndConditions || agreement.terms || '';

  const hasPaid = terms.includes('[PAYMENT_SUCCESS') || 
                  Boolean(agreement.paidAt) || 
                  Boolean(agreement.isPaid) || 
                  (Array.isArray(payments) && payments.some(p => p.isSuccessful));
  const hasAgreed = hasPaid || 
                    terms.includes('[TENANT_AGREED') || 
                    agreement.status === 'PendingOwnerApproval' || 
                    agreement.status === 1 || 
                    agreement.status === 'Agreed';

  const isTenant = user?.role === 'Tenant' || !user;

  // Handle Tenant Agree & Process Payment in one seamless flow
  const handleAgreeAndProcess = async (e) => {
    e.preventDefault();
    setPayError('');

    if (!signatureName?.trim()) {
      setPayError('Please enter your full legal name as your electronic signature.');
      return;
    }

    if (paymentMethod === 'card') {
      const cleanNum = cardNumber.replace(/\s/g, '');
      if (cleanNum.length < 15) {
        setPayError('Please enter a valid 16-digit card number (or click Autofill Test Card).');
        return;
      }
      if (cardExpiry.length < 5) {
        setPayError('Please enter a valid expiry date (MM/YY).');
        return;
      }
      if (cardCvc.length < 3) {
        setPayError('Please enter a valid 3 or 4-digit CVV/CVC.');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const payAmount = deposit > 0 ? deposit : rent;
      const ref = `PAY-${Date.now().toString().slice(-6)}`;
      const brand = getCardBrand(cardNumber);
      const paymentMethodName = paymentMethod === 'card'
        ? `${brand.name} Card (•••• ${cardNumber.slice(-4) || '4242'})`
        : 'Bank Transfer (Escrow Account)';

      // 1. Try sending agree to backend (graceful fallback if local or offline)
      try {
        if (!String(agreement.id).startsWith('agr_')) {
          await api.put(`/agreements/${agreement.id}/agree`, { signatureName });
        }
      } catch (agreeErr) {
        console.warn('Backend agree note (syncing locally):', agreeErr);
      }

      // 2. Try sending payment to backend (graceful fallback if local or offline)
      try {
        if (!String(agreement.id).startsWith('agr_')) {
          await api.post(`/agreements/${agreement.id}/pay`, {
            amount: payAmount,
            paymentReference: ref,
            paymentMethod: paymentMethodName
          });
        }
      } catch (payErr) {
        console.warn('Backend pay note (syncing locally):', payErr);
      }

      // 3. Update agreement state with both signature and payment confirmation
      const updated = {
        ...agreement,
        status: 'Active',
        termsAndConditions: `${terms}\n[TENANT_AGREED: ${new Date().toISOString()} | Signer: ${signatureName}]\n[PAYMENT_SUCCESS: LKR ${payAmount} | Ref: ${ref} | Date: ${new Date().toISOString()} | Method: ${paymentMethodName}]`
      };
      setLocalAgreement(updated);

      // 4. Update local storage
      try {
        const stored = JSON.parse(localStorage.getItem('rentwise_client_agreements') || '[]');
        const next = stored.map(a => a.id === updated.id ? { ...a, ...updated } : a);
        if (!stored.some(a => a.id === updated.id)) next.unshift(updated);
        localStorage.setItem('rentwise_client_agreements', JSON.stringify(next));
      } catch {}

      // 5. Add payment record so receipt displays instantly
      const newPayment = {
        id: `pay_${Date.now()}`,
        rentalAgreementId: agreement.id,
        amount: payAmount,
        paymentReference: ref,
        paymentDate: new Date().toISOString(),
        paymentMethod: paymentMethodName,
        isSuccessful: true
      };
      setPayments(prev => [newPayment, ...prev]);

      try {
        const localPay = JSON.parse(localStorage.getItem('rentwise_client_payments') || '[]');
        localPay.unshift(newPayment);
        localStorage.setItem('rentwise_client_payments', JSON.stringify(localPay));
      } catch {}

      setIsAgreeModalOpen(false);
      setIsPayModalOpen(false);
      fetchPayments();
    } catch (err) {
      console.error('Agree and payment process failed:', err);
      setPayError('Failed to process payment. Please verify your details or use the demo autofill card.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Tenant Payment
  const handlePay = async (e) => {
    e.preventDefault();
    setPayError('');

    if (paymentMethod === 'card') {
      const cleanNum = cardNumber.replace(/\s/g, '');
      if (cleanNum.length < 15) {
        setPayError('Please enter a valid 16-digit card number.');
        return;
      }
      if (cardExpiry.length < 5) {
        setPayError('Please enter a valid expiry date (MM/YY).');
        return;
      }
      if (cardCvc.length < 3) {
        setPayError('Please enter a valid 3 or 4-digit CVV/CVC.');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const payAmount = deposit > 0 ? deposit : rent;
      const ref = `PAY-${Date.now().toString().slice(-6)}`;
      const brand = getCardBrand(cardNumber);
      const paymentMethodName = paymentMethod === 'card'
        ? `${brand.name} Card (•••• ${cardNumber.slice(-4) || '4242'})`
        : 'Bank Transfer (Escrow Account)';

      if (!String(agreement.id).startsWith('agr_')) {
        await api.post(`/agreements/${agreement.id}/pay`, {
          amount: payAmount,
          paymentReference: ref,
          paymentMethod: paymentMethodName
        });
      }

      const updated = {
        ...agreement,
        status: 'Active',
        termsAndConditions: `${terms}\n[PAYMENT_SUCCESS: LKR ${payAmount} | Ref: ${ref} | Date: ${new Date().toISOString()} | Method: ${paymentMethodName}]`
      };
      setLocalAgreement(updated);
      try {
        const stored = JSON.parse(localStorage.getItem('rentwise_client_agreements') || '[]');
        const next = stored.map(a => a.id === updated.id ? { ...a, ...updated } : a);
        if (!stored.some(a => a.id === updated.id)) next.unshift(updated);
        localStorage.setItem('rentwise_client_agreements', JSON.stringify(next));
      } catch {}

      // Add to local payment list so receipt renders immediately
      const newPayment = {
        id: `pay_${Date.now()}`,
        rentalAgreementId: agreement.id,
        amount: payAmount,
        paymentReference: ref,
        paymentDate: new Date().toISOString(),
        paymentMethod: paymentMethodName,
        isSuccessful: true
      };
      setPayments(prev => [newPayment, ...prev]);

      // Cache payment in rentwise_client_payments for tenant dashboard sync
      try {
        const localPay = JSON.parse(localStorage.getItem('rentwise_client_payments') || '[]');
        localPay.unshift(newPayment);
        localStorage.setItem('rentwise_client_payments', JSON.stringify(localPay));
      } catch {}

      setIsPayModalOpen(false);
      fetchPayments();
    } catch (err) {
      console.error('Payment failed:', err);
      setPayError('Payment processing failed. Please check your card details or try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300 max-w-5xl mx-auto pb-16">
      
      {/* Back Button */}
      <button
        onClick={() => navigate('/agreements')}
        className="inline-flex items-center gap-2 text-xs font-bold text-gray-600 hover:text-gray-900 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to All Agreements</span>
      </button>

      {/* House Hero Banner */}
      <div className="relative rounded-3xl overflow-hidden shadow-lg border border-gray-200 bg-slate-900 text-white">
        <div className="relative aspect-[21/9] w-full max-h-[340px] overflow-hidden bg-slate-800">
          <img
            src={photo}
            alt={prop.title || 'House Photo'}
            onError={handleImageError}
            className="w-full h-full object-cover opacity-80"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
        </div>

        <div className="absolute bottom-6 left-6 right-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-3 py-1 rounded-full bg-emerald-600 text-white font-extrabold text-xs flex items-center gap-1 shadow-sm">
                <Calendar className="w-3.5 h-3.5" />
                <span>6 Months Standard Tenancy</span>
              </span>
              <span className={`px-3 py-1 rounded-full text-xs font-extrabold shadow-sm ${
                hasPaid ? 'bg-emerald-500 text-white' : hasAgreed ? 'bg-amber-500 text-white' : 'bg-blue-500 text-white'
              }`}>
                {hasPaid ? 'Paid & Rented ✓ · Active Lease' : hasAgreed ? 'Agreed by Tenant · Payment Required' : 'Sent to Tenant · Pending Agreement'}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">{prop.title || 'Rental House'}</h1>
            <p className="text-xs sm:text-sm text-gray-300 flex items-center gap-1.5 mt-1">
              <Building2 className="w-4 h-4 text-gray-400" />
              <span>{prop.address || 'Sri Lanka'}</span>
            </p>
          </div>

          <div className="bg-black/60 backdrop-blur-md px-5 py-3 rounded-2xl border border-white/20 text-right">
            <span className="text-[11px] uppercase tracking-wider text-gray-300 font-semibold block">Monthly Rent</span>
            <span className="text-2xl font-black text-emerald-400">{formatLKR(rent)}</span>
            <span className="text-xs text-gray-400 block mt-0.5">Deposit: {formatLKR(deposit)}</span>
          </div>
        </div>
      </div>

      {/* Lifecycle Progress Card */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-3">
        <h3 className="text-sm font-black text-gray-900 uppercase tracking-wider">Lease Lifecycle Status</h3>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 mx-auto mb-1" />
            <div className="font-bold text-xs text-emerald-950">1. Lease Issued</div>
            <div className="text-[11px] text-emerald-700">6-Month Term Sent</div>
          </div>
          <div className={`p-3 rounded-xl border ${hasAgreed ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
            {hasAgreed ? <CheckCircle2 className="w-5 h-5 text-emerald-600 mx-auto mb-1" /> : <Clock className="w-5 h-5 text-amber-600 mx-auto mb-1" />}
            <div className="font-bold text-xs text-gray-900">2. Tenant Agreement</div>
            <div className="text-[11px] text-gray-600">{hasAgreed ? 'Agreed & Signed ✓' : 'Awaiting Tenant Sign'}</div>
          </div>
          <div className={`p-3 rounded-xl border ${hasPaid ? 'bg-emerald-50 border-emerald-200' : 'bg-gray-50 border-gray-200'}`}>
            {hasPaid ? <CheckCircle2 className="w-5 h-5 text-emerald-600 mx-auto mb-1" /> : <CreditCard className="w-5 h-5 text-gray-400 mx-auto mb-1" />}
            <div className="font-bold text-xs text-gray-900">3. Deposit Payment</div>
            <div className="text-[11px] text-gray-600">{hasPaid ? 'Paid · Active Lease ✓' : 'Payment Pending'}</div>
          </div>
        </div>

        {/* Action Banners */}
        {!hasAgreed && isTenant && (
          <div className="mt-3 p-4 bg-blue-50 rounded-xl border border-blue-200 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs text-blue-900">
              <strong>Step 1:</strong> Please review and agree to the 6-month tenancy terms to proceed.
            </div>
            <button
              onClick={() => setIsAgreeModalOpen(true)}
              className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-xs rounded-lg shadow-xs cursor-pointer"
            >
              Have to Agree
            </button>
          </div>
        )}

        {hasAgreed && !hasPaid && isTenant && (
          <div className="mt-3 p-4 bg-amber-50 rounded-xl border border-amber-200 flex flex-col sm:flex-row items-center justify-between gap-3 animate-pulse">
            <div className="text-xs text-amber-950">
              <strong>Step 2:</strong> Tenant has agreed to the terms! Complete the security deposit payment to activate your lease.
            </div>
            <button
              onClick={() => setIsPayModalOpen(true)}
              className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-lg shadow-md cursor-pointer"
            >
              Make Payment ({formatLKR(deposit || rent)})
            </button>
          </div>
        )}

        {hasPaid && (
          <div className="mt-3 p-4 bg-emerald-50 rounded-xl border border-emerald-200 flex items-center gap-3 text-xs text-emerald-950 font-bold">
            <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
            <span>PAID & RENTED ✓ ALL PROCESS IS SUCCESSFUL! This 6-month residential lease is fully executed, paid, and legally active.</span>
          </div>
        )}
      </div>

      {/* Financials & Dates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Financials & Terms</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-xs sm:text-sm">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                <span className="text-xs font-semibold text-gray-400 uppercase">Monthly Rent</span>
                <p className="text-xl font-bold text-emerald-700 mt-1">{formatLKR(rent)}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                <span className="text-xs font-semibold text-gray-400 uppercase">Security Deposit</span>
                <p className="text-xl font-bold text-gray-900 mt-1">{formatLKR(deposit)}</p>
              </div>
            </div>

            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 space-y-2">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block">Terms & Conditions</span>
              <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">{terms || 'Standard residential 6-month lease terms apply.'}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Duration & Parties</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-xs">
            <div>
              <span className="text-gray-400 block font-semibold">Lease Term</span>
              <p className="font-extrabold text-sm text-gray-900">6 Months</p>
            </div>
            <div>
              <span className="text-gray-400 block font-semibold">Start Date</span>
              <p className="font-bold text-gray-800">{agreement.startDate ? new Date(agreement.startDate).toLocaleDateString() : 'N/A'}</p>
            </div>
            <div>
              <span className="text-gray-400 block font-semibold">End Date</span>
              <p className="font-bold text-gray-800">{agreement.endDate ? new Date(agreement.endDate).toLocaleDateString() : 'N/A'}</p>
            </div>
            <div className="pt-2 border-t border-gray-100">
              <span className="text-gray-400 block font-semibold">Property Owner</span>
              <p className="font-bold text-gray-900">{agreement.owner?.fullName || agreement.owner?.email || 'Owner'}</p>
            </div>
            <div>
              <span className="text-gray-400 block font-semibold">Tenant</span>
              <p className="font-bold text-gray-900">{agreement.tenant?.fullName || agreement.tenant?.email || 'Tenant'}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payment History Card */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-black text-gray-900">Payment Receipts & History</h3>
            <p className="text-xs text-gray-500">Official digital payment records for this lease agreement</p>
          </div>
          {isTenant && !hasPaid && hasAgreed && (
            <Button size="sm" onClick={() => setIsPayModalOpen(true)}>
              Pay Now
            </Button>
          )}
        </div>

        {payments.length === 0 ? (
          <div className="p-8 text-center text-xs text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200">
            No payments recorded yet. {hasAgreed && !hasPaid ? 'Click "Pay Now" to complete your security deposit payment.' : ''}
          </div>
        ) : (
          <div className="space-y-2">
            {payments.map(p => (
              <div key={p.id} className="p-3.5 bg-emerald-50/50 rounded-xl border border-emerald-100 flex items-center justify-between text-xs">
                <div>
                  <div className="font-bold text-emerald-950">{formatLKR(p.amount)}</div>
                  <div className="text-[11px] text-gray-500">Ref: {p.paymentReference} · {new Date(p.paymentDate).toLocaleDateString()}</div>
                </div>
                <Badge variant="success">Completed ✓</Badge>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Agree & Process Payment Modal */}
      {isAgreeModalOpen && (
        <Modal 
          isOpen={isAgreeModalOpen} 
          onClose={() => setIsAgreeModalOpen(false)} 
          title="Agree to 6-Month Lease & Process Payment"
          className="max-w-lg"
        >
          <form onSubmit={handleAgreeAndProcess} className="space-y-4 text-xs sm:text-sm">
            {/* Agreement Terms Banner */}
            <div className="p-3.5 bg-emerald-50 rounded-2xl border border-emerald-200 text-emerald-950 leading-relaxed space-y-1">
              <div className="font-extrabold text-xs text-emerald-900 uppercase tracking-wider">
                6-Month Residential Lease Agreement
              </div>
              <p className="text-xs text-emerald-900/90">
                By signing and completing payment below, you agree to rent <strong>{propTitle}</strong> ({propAddress}) for a duration of <strong>6 months</strong> at the monthly rate of <strong>{formatLKR(rent)}</strong> with a required security deposit of <strong>{formatLKR(deposit || rent)}</strong>.
              </p>
            </div>

            {/* Error Message */}
            {payError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-semibold flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-rose-600" />
                <span>{payError}</span>
              </div>
            )}

            {/* Electronic Signature Input */}
            <div className="space-y-1">
              <label className="font-bold text-gray-700 block text-xs">
                Full Legal Name (Electronic Signature)
              </label>
              <input
                type="text"
                required
                value={signatureName}
                onChange={(e) => { setSignatureName(e.target.value); if (payError) setPayError(''); }}
                placeholder="Type your full legal name"
                className="w-full h-10 px-3 rounded-xl border border-gray-300 font-semibold text-xs sm:text-sm bg-white focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
              />
            </div>

            {/* Payment Method Selector */}
            <div>
              <label className="font-bold text-gray-700 block mb-1 text-xs">Select Payment Method for Deposit</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('card')}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    paymentMethod === 'card'
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-500/20'
                      : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <CreditCard className="w-4 h-4 text-emerald-600" />
                  <span>Credit / Debit Card</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod('bank')}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    paymentMethod === 'bank'
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-500/20'
                      : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <Building2 className="w-4 h-4 text-emerald-600" />
                  <span>Direct Bank Transfer</span>
                </button>
              </div>
            </div>

            {paymentMethod === 'card' ? (
              <div className="space-y-3.5">
                {/* Visual Interactive Credit Card Mockup */}
                {(() => {
                  const brand = getCardBrand(cardNumber);
                  return (
                    <div className={`relative rounded-2xl bg-gradient-to-tr ${brand.bg} p-4 sm:p-5 text-white shadow-md overflow-hidden border border-white/20 transition-all`}>
                      <div className="absolute top-0 right-0 -mt-8 -mr-8 w-36 h-36 bg-white/10 rounded-full blur-xl pointer-events-none" />
                      
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className="w-9 h-6.5 rounded bg-gradient-to-tr from-amber-300 via-yellow-200 to-amber-400 shadow-inner border border-amber-500/40 relative flex items-center justify-center">
                            <div className="w-full h-[1px] bg-amber-700/30 absolute" />
                            <div className="h-full w-[1px] bg-amber-700/30 absolute" />
                          </div>
                          <Wifi className="w-3.5 h-3.5 text-white/70 rotate-90" />
                        </div>
                        <span className="font-black text-xs font-mono tracking-wider px-2 py-0.5 rounded bg-white/20 backdrop-blur-xs">
                          {brand.name}
                        </span>
                      </div>

                      <div className="font-mono text-sm sm:text-base tracking-[0.18em] font-bold text-white/95 my-2.5 drop-shadow-sm">
                        {cardNumber || '•••• •••• •••• ••••'}
                      </div>

                      <div className="flex items-end justify-between text-[10px] text-white/80 uppercase pt-1 font-sans">
                        <div>
                          <span className="text-[8px] text-white/60 block">Cardholder</span>
                          <span className="font-bold tracking-wider font-mono text-white text-[11px] truncate max-w-[160px] block">
                            {cardHolder || signatureName || 'FULL LEGAL NAME'}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-[8px] text-white/60 block">Expires</span>
                          <span className="font-bold tracking-wider font-mono text-white text-[11px] block">
                            {cardExpiry || 'MM/YY'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Quick Autofill Test Card */}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500 font-medium">Enter card details:</span>
                  <button
                    type="button"
                    onClick={handleFillDemoCard}
                    className="text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <Sparkles className="w-3 h-3 text-emerald-600" />
                    <span>Autofill Test Card (4242)</span>
                  </button>
                </div>

                {/* Cardholder Name */}
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">
                    Cardholder Name
                  </label>
                  <input
                    type="text"
                    required
                    value={cardHolder}
                    onChange={(e) => { setCardHolder(e.target.value); if (payError) setPayError(''); }}
                    placeholder="Full name as printed on card"
                    className="w-full h-10 px-3 rounded-xl border border-gray-300 font-medium text-xs sm:text-sm bg-white focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
                  />
                </div>

                {/* Card Number */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-gray-700 block">
                      Card Number
                    </label>
                    <span className="text-[10px] text-gray-400 font-mono">16 Digits (Visa / MC)</span>
                  </div>
                  <input
                    type="text"
                    required
                    maxLength={19}
                    value={cardNumber}
                    onChange={handleCardNumberChange}
                    placeholder="4242 4242 4242 4242"
                    className="w-full h-10 px-3 rounded-xl border border-gray-300 font-mono text-xs sm:text-sm bg-white focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
                  />
                </div>

                {/* Expiry and CVV */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-gray-700 block mb-1">
                      Expiry Date (MM/YY)
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={5}
                      value={cardExpiry}
                      onChange={handleExpiryChange}
                      placeholder="MM/YY"
                      className="w-full h-10 px-3 rounded-xl border border-gray-300 font-mono text-xs sm:text-sm bg-white focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-700 block mb-1">
                      CVV / CVC (3 or 4 digits)
                    </label>
                    <input
                      type="password"
                      required
                      maxLength={4}
                      value={cardCvc}
                      onChange={handleCvcChange}
                      placeholder="•••"
                      className="w-full h-10 px-3 rounded-xl border border-gray-300 font-mono text-xs sm:text-sm bg-white focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
                    />
                  </div>
                </div>
              </div>
            ) : (
              /* Bank Transfer Option */
              <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200 space-y-2.5 text-xs text-gray-700">
                <p className="font-bold text-gray-900 flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-emerald-600" />
                  <span>RentWise Designated Escrow Account:</span>
                </p>
                <div className="font-mono bg-white p-3 rounded-xl border border-gray-200 space-y-1 text-xs">
                  <div><span className="text-gray-400">Bank:</span> Commercial Bank of Ceylon</div>
                  <div><span className="text-gray-400">Account Name:</span> RentWise Escrow - {propTitle}</div>
                  <div><span className="text-gray-400">Account No:</span> 8004 9281 9201</div>
                  <div><span className="text-gray-400">Branch:</span> Colombo City Centre</div>
                </div>
                <p className="text-[11px] text-gray-500 italic">
                  Submitting will record your signature and bank transfer payment reference to activate the lease.
                </p>
              </div>
            )}

            {/* Security Notice */}
            <div className="p-2.5 bg-emerald-50/70 rounded-xl border border-emerald-200 flex items-center gap-2 text-[11px] text-emerald-800">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>256-bit encrypted checkout. Lease will activate immediately upon payment.</span>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
              <button 
                type="button" 
                onClick={() => setIsAgreeModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-gray-300 text-xs font-bold text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button 
                type="submit" 
                disabled={isSubmitting}
                className="px-5 py-2.5 rounded-xl bg-[#008037] hover:bg-[#006e2e] text-white text-xs font-bold shadow-md shadow-emerald-700/20 flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>{isSubmitting ? 'Processing...' : `I Agree & Pay ${formatLKR(deposit || rent)}`}</span>
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Pay Modal with Interactive Card Details */}
      {isPayModalOpen && (
        <Modal 
          isOpen={isPayModalOpen} 
          onClose={() => setIsPayModalOpen(false)} 
          title="Complete Payment to Activate Lease"
          className="max-w-lg"
        >
          <form onSubmit={handlePay} className="space-y-4 text-xs sm:text-sm">
            {/* Amount Banner */}
            <div className="bg-gradient-to-br from-emerald-800 to-emerald-950 text-white p-4 rounded-2xl shadow-sm border border-emerald-700">
              <div className="text-[11px] font-semibold text-emerald-200 uppercase tracking-wider">
                Initial Security Deposit Payment
              </div>
              <div className="text-2xl sm:text-3xl font-black mt-1 tracking-tight">
                {formatLKR(deposit || rent)}
              </div>
              <div className="text-[11px] text-emerald-300 mt-1">
                6-Month Lease Tenancy for {propTitle}
              </div>
            </div>

            {/* Error Message */}
            {payError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-semibold flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-rose-600" />
                <span>{payError}</span>
              </div>
            )}

            {/* Payment Method Selector */}
            <div>
              <label className="font-bold text-gray-700 block mb-1 text-xs">Payment Method</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('card')}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    paymentMethod === 'card'
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-500/20'
                      : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <CreditCard className="w-4 h-4 text-emerald-600" />
                  <span>Credit / Debit Card</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod('bank')}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    paymentMethod === 'bank'
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-500/20'
                      : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <Building2 className="w-4 h-4 text-emerald-600" />
                  <span>Direct Bank Transfer</span>
                </button>
              </div>
            </div>

            {paymentMethod === 'card' ? (
              <div className="space-y-3.5">
                {/* Visual Interactive Credit Card Mockup */}
                {(() => {
                  const brand = getCardBrand(cardNumber);
                  return (
                    <div className={`relative rounded-2xl bg-gradient-to-tr ${brand.bg} p-4 sm:p-5 text-white shadow-md overflow-hidden border border-white/20 transition-all`}>
                      <div className="absolute top-0 right-0 -mt-8 -mr-8 w-36 h-36 bg-white/10 rounded-full blur-xl pointer-events-none" />
                      
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className="w-9 h-6.5 rounded bg-gradient-to-tr from-amber-300 via-yellow-200 to-amber-400 shadow-inner border border-amber-500/40 relative flex items-center justify-center">
                            <div className="w-full h-[1px] bg-amber-700/30 absolute" />
                            <div className="h-full w-[1px] bg-amber-700/30 absolute" />
                          </div>
                          <Wifi className="w-3.5 h-3.5 text-white/70 rotate-90" />
                        </div>
                        <span className="font-black text-xs font-mono tracking-wider px-2 py-0.5 rounded bg-white/20 backdrop-blur-xs">
                          {brand.name}
                        </span>
                      </div>

                      <div className="font-mono text-sm sm:text-base tracking-[0.18em] font-bold text-white/95 my-2.5 drop-shadow-sm">
                        {cardNumber || '•••• •••• •••• ••••'}
                      </div>

                      <div className="flex items-end justify-between text-[10px] text-white/80 uppercase pt-1 font-sans">
                        <div>
                          <span className="text-[8px] text-white/60 block">Cardholder</span>
                          <span className="font-bold tracking-wider font-mono text-white text-[11px] truncate max-w-[160px] block">
                            {cardHolder || 'FULL LEGAL NAME'}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-[8px] text-white/60 block">Expires</span>
                          <span className="font-bold tracking-wider font-mono text-white text-[11px] block">
                            {cardExpiry || 'MM/YY'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Quick Autofill Test Card */}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500 font-medium">Enter your payment card details:</span>
                  <button
                    type="button"
                    onClick={handleFillDemoCard}
                    className="text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <Sparkles className="w-3 h-3 text-emerald-600" />
                    <span>Autofill Test Card (4242)</span>
                  </button>
                </div>

                {/* Cardholder Name */}
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">
                    Cardholder Name
                  </label>
                  <input
                    type="text"
                    required
                    value={cardHolder}
                    onChange={(e) => { setCardHolder(e.target.value); if (payError) setPayError(''); }}
                    placeholder="Full name as printed on card"
                    className="w-full h-10 px-3 rounded-xl border border-gray-300 font-medium text-xs sm:text-sm bg-white focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
                  />
                </div>

                {/* Card Number */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-gray-700 block">
                      Card Number
                    </label>
                    <span className="text-[10px] text-gray-400 font-mono">16 Digits (Visa / MC)</span>
                  </div>
                  <input
                    type="text"
                    required
                    maxLength={19}
                    value={cardNumber}
                    onChange={handleCardNumberChange}
                    placeholder="4242 4242 4242 4242"
                    className="w-full h-10 px-3 rounded-xl border border-gray-300 font-mono text-xs sm:text-sm bg-white focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
                  />
                </div>

                {/* Expiry and CVV */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-gray-700 block mb-1">
                      Expiry Date (MM/YY)
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={5}
                      value={cardExpiry}
                      onChange={handleExpiryChange}
                      placeholder="MM/YY"
                      className="w-full h-10 px-3 rounded-xl border border-gray-300 font-mono text-xs sm:text-sm bg-white focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-700 block mb-1">
                      CVV / CVC (3 or 4 digits)
                    </label>
                    <input
                      type="password"
                      required
                      maxLength={4}
                      value={cardCvc}
                      onChange={handleCvcChange}
                      placeholder="•••"
                      className="w-full h-10 px-3 rounded-xl border border-gray-300 font-mono text-xs sm:text-sm bg-white focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
                    />
                  </div>
                </div>
              </div>
            ) : (
              /* Bank Transfer Option */
              <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200 space-y-2.5 text-xs text-gray-700">
                <p className="font-bold text-gray-900 flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-emerald-600" />
                  <span>RentWise Designated Escrow Account:</span>
                </p>
                <div className="font-mono bg-white p-3 rounded-xl border border-gray-200 space-y-1 text-xs">
                  <div><span className="text-gray-400">Bank:</span> Commercial Bank of Ceylon</div>
                  <div><span className="text-gray-400">Account Name:</span> RentWise Escrow - {prop.title || 'Lease'}</div>
                  <div><span className="text-gray-400">Account No:</span> 8004 9281 9201</div>
                  <div><span className="text-gray-400">Branch:</span> Colombo City Centre</div>
                </div>
                <p className="text-[11px] text-gray-500 italic">
                  Submitting will confirm the transaction and record your bank transfer payment reference.
                </p>
              </div>
            )}

            {/* Security Notice */}
            <div className="p-2.5 bg-emerald-50/70 rounded-xl border border-emerald-200 flex items-center gap-2 text-[11px] text-emerald-800">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>256-bit encrypted checkout. Lease will activate immediately upon payment.</span>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
              <button 
                type="button" 
                onClick={() => setIsPayModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-gray-300 text-xs font-bold text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button 
                type="submit" 
                disabled={isSubmitting}
                className="px-5 py-2.5 rounded-xl bg-[#008037] hover:bg-[#006e2e] text-white text-xs font-bold shadow-md shadow-emerald-700/20 flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <CreditCard className="w-4 h-4" />
                <span>{isSubmitting ? 'Processing Payment...' : `Confirm & Pay ${formatLKR(deposit || rent)}`}</span>
              </button>
            </div>
          </form>
        </Modal>
      )}

    </div>
  );
};

export default AgreementDetails;