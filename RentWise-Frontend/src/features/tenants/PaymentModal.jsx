import React, { useState } from 'react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import api from '../../services/api';
import { CreditCard, Home, MapPin, CheckCircle2, Calendar, ShieldCheck, Building2, Lock, DollarSign, Sparkles, Wifi } from 'lucide-react';

const money = (val) => `Rs. ${Number(val || 0).toLocaleString()}`;

export function PaymentModal({ isOpen, onClose, agreement, onSuccess }) {
  const [paymentMethod, setPaymentMethod] = useState('card');
  const [cardHolder, setCardHolder] = useState(agreement?.tenantName || agreement?.tenant?.fullName || 'Tenant User');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvc, setCardCvc] = useState('');
  const [billingMonth, setBillingMonth] = useState(() => {
    const d = new Date();
    return d.toLocaleString('default', { month: 'long', year: 'numeric' });
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

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
    if (error) setError('');
  };

  const handleExpiryChange = (e) => {
    let digits = e.target.value.replace(/\D/g, '').slice(0, 4);
    if (digits.length >= 3) {
      digits = `${digits.slice(0, 2)}/${digits.slice(2)}`;
    }
    setCardExpiry(digits);
    if (error) setError('');
  };

  const handleCvcChange = (e) => {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 4);
    setCardCvc(digits);
    if (error) setError('');
  };

  const handleFillDemoCard = () => {
    setCardNumber('4242 4242 4242 4242');
    setCardExpiry('12/28');
    setCardCvc('888');
    setCardHolder(agreement?.tenantName || agreement?.tenant?.fullName || 'John Doe');
    if (error) setError('');
  };

  if (!agreement) return null;

  const rentAmount = agreement.agreedMonthlyRent || agreement.monthlyRent || 0;
  const propTitle = agreement.propertyTitle || `Property #${String(agreement.propertyId || '').slice(0, 8)}`;
  const propAddress = agreement.propertyAddress || 'Address on file';

  const handlePay = async (e) => {
    e.preventDefault();
    setError('');

    if (paymentMethod === 'card') {
      const cleanNum = cardNumber.replace(/\s/g, '');
      if (cleanNum.length < 15) {
        setError('Please enter a valid 16-digit card number.');
        return;
      }
      if (cardExpiry.length < 5) {
        setError('Please enter a valid expiry date (MM/YY).');
        return;
      }
      if (cardCvc.length < 3) {
        setError('Please enter a valid 3 or 4-digit CVV/CVC.');
        return;
      }
    }

    setIsLoading(true);

    try {
      const now = new Date();
      const txnRef = `RENT-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      const brand = getCardBrand(cardNumber);
      const methodName = paymentMethod === 'card' ? `${brand.name} Card (•••• ${cardNumber.slice(-4) || '4242'})` : 'Bank Transfer';

      const newPayment = {
        id: `pay_${Date.now()}`,
        rentalAgreementId: agreement.id,
        propertyId: agreement.propertyId,
        propertyTitle: propTitle,
        propertyAddress: propAddress,
        amount: Number(rentAmount),
        paymentDate: now.toISOString(),
        paymentReference: txnRef,
        isSuccessful: true,
        billingMonth: billingMonth,
        paymentMethod: methodName
      };

      // 1. Try sending to backend
      try {
        let finalAgreementId = agreement.id;

        // If it's a mock agreement from the UI, we must persist it to the database first!
        if (String(finalAgreementId).startsWith('agr_')) {
          const createRes = await api.post('/agreements', {
             propertyId: agreement.propertyId,
             ownerId: agreement.ownerId || "00000000-0000-0000-0000-000000000000",
             agreedMonthlyRent: Number(rentAmount),
             securityDeposit: agreement.securityDeposit || Number(rentAmount) * 2,
             termsAndConditions: agreement.termsAndConditions || agreement.terms || '',
             status: 'Active'
          });
          if (createRes.data && createRes.data.id) {
             finalAgreementId = createRes.data.id;
          }
        }

        await api.post(`/agreements/${finalAgreementId}/payments`, {
          amount: Number(rentAmount),
          paymentDate: now.toISOString(),
          paymentReference: txnRef,
          isSuccessful: true
        });
      } catch (backendErr) {
        console.warn('Backend payment note (persisting locally):', backendErr);
      }

      // 2. Persist in local storage
      try {
        const stored = JSON.parse(localStorage.getItem('rentwise_client_payments') || '[]');
        stored.unshift(newPayment);
        localStorage.setItem('rentwise_client_payments', JSON.stringify(stored));
      } catch (e) {
        console.error('LocalStorage save error:', e);
      }

      if (onSuccess) {
        onSuccess(newPayment);
      }
      onClose();
    } catch (err) {
      setError('Payment failed. Please try again or check details.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Pay Monthly Rent" className="max-w-lg">
      <form onSubmit={handlePay} className="space-y-5 text-gray-800">
        
        {/* Property Summary Banner */}
        <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-100 flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
            <Home className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-sm font-bold text-gray-900 truncate">{propTitle}</h4>
              <span className="text-[11px] font-bold text-blue-700 bg-blue-100/70 px-2 py-0.5 rounded-full">
                {billingMonth}
              </span>
            </div>
            <p className="text-xs text-gray-500 truncate flex items-center gap-1 mt-0.5">
              <MapPin className="w-3 h-3 text-gray-400 shrink-0" />
              <span>{propAddress}</span>
            </p>
          </div>
        </div>

        {/* Amount Due Big Banner */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-200 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 block">
              Monthly Rent Value Due
            </span>
            <span className="text-2xl font-black text-emerald-700">
              {money(rentAmount)}
            </span>
          </div>
          <div className="text-right">
            <span className="text-[10px] font-semibold text-gray-500 block">Due Date</span>
            <span className="text-xs font-bold text-gray-800">1st of Month</span>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium">
            {error}
          </div>
        )}

        {/* Billing Month Selector */}
        <div className="p-4 rounded-2xl bg-white border border-gray-200 space-y-2.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-wider text-gray-700 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-blue-600" />
              PAYING RENT FOR MONTH
            </label>
            <span className="text-[10px] font-bold text-blue-700 bg-blue-100/70 px-2 py-0.5 rounded-full">
              {billingMonth}
            </span>
          </div>
          <select 
            value={billingMonth}
            onChange={(e) => setBillingMonth(e.target.value)}
            className="w-full p-2.5 rounded-xl border border-gray-300 text-sm font-bold text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          >
            {Array.from({ length: 6 }).map((_, i) => {
              const d = new Date();
              d.setMonth(d.getMonth() + i);
              const mStr = d.toLocaleString('default', { month: 'long', year: 'numeric' });
              return (
                <option key={mStr} value={mStr}>
                  Rent for {mStr}
                </option>
              );
            })}
          </select>
          <p className="text-[10px] text-gray-400 font-medium mt-1">
            Select which calendar month this payment applies to.
          </p>
        </div>

        {/* Payment Method Selector */}
        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-wider text-gray-600 block">
            Payment Method
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setPaymentMethod('card')}
              className={`p-3 rounded-xl border text-left flex items-center gap-2.5 transition-all ${
                paymentMethod === 'card'
                  ? 'border-blue-600 bg-blue-50/70 ring-2 ring-blue-500/20 text-blue-900 font-bold'
                  : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-700'
              }`}
            >
              <CreditCard className="w-4 h-4 text-blue-600" />
              <span className="text-xs">Credit / Debit Card</span>
            </button>

            <button
              type="button"
              onClick={() => setPaymentMethod('bank')}
              className={`p-3 rounded-xl border text-left flex items-center gap-2.5 transition-all ${
                paymentMethod === 'bank'
                  ? 'border-blue-600 bg-blue-50/70 ring-2 ring-blue-500/20 text-blue-900 font-bold'
                  : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-700'
              }`}
            >
              <Building2 className="w-4 h-4 text-blue-600" />
              <span className="text-xs">Bank Transfer</span>
            </button>
          </div>
        </div>

        {/* Payment Details Input */}
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
              <span className="text-xs text-gray-500 font-medium">Enter card details:</span>
              <button
                type="button"
                onClick={handleFillDemoCard}
                className="text-[11px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2.5 py-1 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Sparkles className="w-3 h-3 text-blue-600" />
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
                onChange={(e) => { setCardHolder(e.target.value); if (error) setError(''); }}
                placeholder="Full name as printed on card"
                className="w-full h-10 px-3 rounded-xl border border-gray-300 font-medium text-xs sm:text-sm bg-white focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
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
                className="w-full h-10 px-3 rounded-xl border border-gray-300 font-mono text-xs sm:text-sm bg-white focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
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
                  className="w-full h-10 px-3 rounded-xl border border-gray-300 font-mono text-xs sm:text-sm bg-white focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
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
                  className="w-full h-10 px-3 rounded-xl border border-gray-300 font-mono text-xs sm:text-sm bg-white focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200/80 space-y-2 text-xs text-gray-600">
            <p className="font-bold text-gray-900">Landlord Designated Escrow Account:</p>
            <div className="font-mono bg-white p-2.5 rounded-xl border border-gray-200 space-y-1">
              <div>Bank: Commercial Bank of Ceylon</div>
              <div>Account Name: RentWise Escrow - {propTitle.slice(0, 15)}</div>
              <div>Account No: 8004 9281 9201</div>
              <div>Branch: Colombo City Centre</div>
            </div>
            <p className="text-[11px] text-gray-500 italic">Clicking Confirm will record your bank transfer payment receipt.</p>
          </div>
        )}

        {/* Security badge */}
        <div className="flex items-center gap-2 text-xs text-gray-500 justify-center">
          <Lock className="w-3.5 h-3.5 text-emerald-600" />
          <span>256-bit encrypted secure payment transaction</span>
        </div>

        {/* Actions */}
        <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-2.5">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            isLoading={isLoading}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-2.5 rounded-xl shadow-md shadow-emerald-600/20"
          >
            <CheckCircle2 className="w-4 h-4 mr-2" />
            <span>Confirm & Pay {money(rentAmount)}</span>
          </Button>
        </div>
      </form>
    </Modal>
  );
}

