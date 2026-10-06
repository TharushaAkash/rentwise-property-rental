import React, { useEffect, useState } from 'react';
import { Building2, CheckCircle2, Loader2 } from 'lucide-react';
import api from '../../services/api';

export function OwnerBankDetails() {
  const [details, setDetails] = useState({ bankName: '', accountName: '', accountNumber: '', branch: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const load = async () => {
    setLoading(true); setError('');
    try { const { data } = await api.get('/bank-details/mine'); setDetails({ bankName: data.bankName || '', accountName: data.accountName || '', accountNumber: data.accountNumber || '', branch: data.branch || '' }); }
    catch { setError('Bank details could not be loaded. Please try again.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);
  const save = async (event) => {
    event.preventDefault(); setSaving(true); setError(''); setSaved(false);
    try { await api.put('/bank-details/mine', details); setSaved(true); }
    catch (err) { setError(err.response?.data?.message || 'Could not save bank details. Check all fields and try again.'); }
    finally { setSaving(false); }
  };
  return <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
    <div className="flex items-center gap-3"><div className="rounded-xl bg-emerald-50 p-3 text-emerald-700"><Building2 size={22} /></div><div><h2 className="text-lg font-bold text-gray-900">Bank transfer details</h2><p className="text-sm text-gray-500">The account your tenants use to pay their rent.</p></div></div>
    {loading ? <p className="mt-5 text-sm text-gray-500">Loading bank details...</p> : <form onSubmit={save} className="mt-6 space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">{[['bankName', 'Bank name', 120], ['branch', 'Branch', 120], ['accountName', 'Account holder name', 150], ['accountNumber', 'Account number', 40]].map(([key, label, max]) => <label key={key} className="block text-sm font-medium text-gray-700">{label}<input required maxLength={max} pattern={key === 'accountNumber' ? '[0-9A-Za-z -]{4,40}' : undefined} value={details[key]} onChange={e => { setDetails({ ...details, [key]: e.target.value }); setSaved(false); }} className="mt-1.5 w-full rounded-xl border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-600" /></label>)}</div>
      <p className="text-xs text-gray-500">Check the account number carefully. Saved changes appear in your tenants’ bank transfer instructions.</p>
      <button disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{saving && <Loader2 size={16} className="animate-spin" />}Save bank details</button>
      {saved && <p role="status" className="flex items-center gap-2 text-sm text-emerald-700"><CheckCircle2 size={16} />Bank details saved.</p>}
    </form>}
    {error && <p role="alert" className="mt-4 text-sm text-red-700">{error} <button type="button" onClick={load} className="underline">Reload</button></p>}
  </section>;
}
