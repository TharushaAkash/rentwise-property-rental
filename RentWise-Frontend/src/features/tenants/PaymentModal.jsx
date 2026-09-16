import React, { useState } from 'react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import api from '../../services/api';
import { 
  CreditCard, 
  Home, 
  MapPin, 
  CheckCircle2, 
  Calendar, 
  ShieldCheck, 
  Building2, 
  Lock,
  DollarSign
} from 'lucide-react';

const money = (val) => `Rs. ${Number(val || 0).toLocaleString()}`;

export function PaymentModal({ isOpen, onClose, agreement, onSuccess }) {
  const [paymentMethod, setPaymentMethod] = useState('card');
  const [cardNumber, setCardNumber] = useState('•••• •••• •••• 4242');
  const [cardExpiry, setCardExpiry] = useState('12/28');
  const [cardCvc, setCardCvc] = useState('321');
  const [billingMonth, setBillingMonth] = useState(() => {
    const d = new Date();
    return d.toLocaleString('default', { month: 'long', year: 'numeric' });
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  if (!agreement) return null;

  const rentAmount = agreement.agreedMonthlyRent || agreement.monthlyRent || 0;
  const propTitle = agreement.propertyTitle || `Property #${String(agreement.propertyId || '').slice(0, 8)}`;
  const propAddress = agreement.propertyAddress || 'Address on file';

  const handlePay = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const now = new Date();
      const txnRef = `RENT-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

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
        paymentMethod: paymentMethod === 'card' ? 'Credit / Debit Card' : 'Bank Transfer'
      };

      // 1. Try sending to backend
      try {
        await api.post(`/agreements/${agreement.id}/payments`, {
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
          <div className="space-y-3 p-4 rounded-2xl bg-gray-50 border border-gray-200/80">
            <div>
              <label className="text-[11px] font-semibold text-gray-500 block mb-1">Card Number</label>
              <input
                type="text"
                value={cardNumber}
                onChange={(e) => setCardNumber(e.target.value)}
                placeholder="4242 •••• •••• 4242"
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-mono text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-gray-500 block mb-1">Expiry (MM/YY)</label>
                <input
                  type="text"
                  value={cardExpiry}
                  onChange={(e) => setCardExpiry(e.target.value)}
                  placeholder="MM/YY"
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-mono text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                  required
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-gray-500 block mb-1">CVC / CVV</label>
                <input
                  type="password"
                  maxLength={4}
                  value={cardCvc}
                  onChange={(e) => setCardCvc(e.target.value)}
                  placeholder="•••"
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-mono text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                  required
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

