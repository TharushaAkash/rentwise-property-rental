import React, { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, ArrowLeft, Plus, Sparkles, Home, FileText, ClipboardCheck, Check, RefreshCw, Loader2, CalendarDays, Wallet, ShieldCheck, AlertCircle, Clock, Trash2 } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import api from '../../services/api';

const empty = { objective: '', maxMonthlyRent: '', startDate: '', endDate: '' };
// Keep the tenant's original green theme; owner/admin use the indigo defaults.
const tenantPalette = {
  '--color-indigo-50': '#ecfdf5',
  '--color-indigo-100': '#d1fae5',
  '--color-indigo-200': '#a7f3d0',
  '--color-indigo-300': '#6ee7b7',
  '--color-indigo-500': '#10b981',
  '--color-indigo-600': '#059669',
  '--color-indigo-700': '#047857',
  '--color-indigo-800': '#065f46',
  '--color-indigo-900': '#064e3b',
  backgroundColor: '#f5f7f6',
};
const input = 'mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-50';
const primary = 'inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-800 disabled:cursor-not-allowed disabled:opacity-50';
const secondary = 'inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50';
const statuses = { Ready: 'Getting ready', Executing: 'Preparing your proposal', Failed: 'Needs attention', AwaitingApproval: 'Awaiting owner review', Completed: 'Draft approved', RevisionRequested: 'Changes requested', Rejected: 'Not approved' };
const stages = { MatchingLocation: 'Finding a home for you', PropertyVerification: 'Checking availability', AgreementPricing: 'Preparing your agreement', MaintenanceTriage: 'Getting your move-in checklist ready' };
const money = value => `LKR ${Number(value || 0).toLocaleString()}`;
const date = value => new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

export const RentalWorkflows = () => {
  const { user } = useAuth();
  const tenant = user?.role === 'Tenant';
  const [params, setParams] = useSearchParams();
  const id = params.get('id');
  const currentId = useRef(id);
  useEffect(() => { currentId.current = id; }, [id]);
  const [runs, setRuns] = useState([]);
  const [run, setRun] = useState(null);
  const [request, setRequest] = useState(empty);
  const [formStep, setFormStep] = useState(0);
  const [tab, setTab] = useState('home');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revising, setRevising] = useState(false);
  const busyRef = useRef(false);

  const read = async (target) => {
    const { data } = await api.get(`/rental-workflows/${target}`);
    if (currentId.current === target) setRun(data);
    return data;
  };
  const refresh = async () => {
    const { data } = await api.get('/rental-workflows'); setRuns(data);
    if (currentId.current) await read(currentId.current);
  };
  useEffect(() => {
    let active = true;
    setLoading(true); setError(''); setRun(null); setRevising(false); setTab('home'); setNote('');
    Promise.all([api.get('/rental-workflows'), id ? api.get(`/rental-workflows/${id}`) : Promise.resolve(null)])
      .then(([list, detail]) => { if (active) { setRuns(list.data); setRun(detail?.data || null); } })
      .catch(() => { if (active) setError('We could not load your requests. Please refresh and try again.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id]);
  useEffect(() => {
    if (!id || !['Ready', 'Executing', 'AwaitingApproval'].includes(run?.status)) return;
    const timer = setInterval(() => { if (!busyRef.current) read(id).catch(() => {}); }, 7000);
    return () => clearInterval(timer);
  }, [id, run?.status]);
  const perform = async action => {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setError('');
    try { await action(); await refresh(); }
    catch (err) { setError(err.response?.data?.message || 'We could not complete that request. Refresh to check your saved progress before trying again.'); }
    finally { busyRef.current = false; setBusy(false); }
  };
  const prepare = async target => {
    let status;
    do {
      const { data } = await api.post(`/rental-workflows/${target}/advance`);
      status = data.status; await read(target);
    } while (status === 'Ready');
  };
  const submit = event => {
    event.preventDefault();
    if (formStep === 0) { setFormStep(1); return; }
    if (request.endDate <= request.startDate) { setError('Choose an end date after your move-in date.'); return; }
    perform(async () => {
      const body = { ...request, maxMonthlyRent: Number(request.maxMonthlyRent) };
      let target = id;
      if (revising) { await api.post(`/rental-workflows/${target}/revise`, body); setRevising(false); }
      else { const { data } = await api.post('/rental-workflows', body); target = data.id; currentId.current = target; setParams({ id: target }); }
      await read(target); await prepare(target);
    });
  };
  const deleteRequest = () => {
    if (!window.confirm('Delete this rental request? It will be removed from the request list. Any saved rental agreement will remain unchanged.')) return;
    perform(async () => {
      await api.delete(`/rental-workflows/${id}`);
      currentId.current = null;
      setRun(null); setParams({}); setRequest(empty); setFormStep(0);
    });
  };
  const decide = decision => perform(() => api.post(`/rental-workflows/${id}/decision`, { decision, note, version: run.version }));
  const outputs = run?.state.outputs || {};
  const processing = run && ['Ready', 'Executing'].includes(run.status);
  const prepared = run && ['AwaitingApproval', 'Completed', 'RevisionRequested', 'Rejected'].includes(run.status);
  const completed = Object.keys(outputs).length;
  const plan = run?.state.plan || [];
  const editing = tenant && (!id || revising);
  const canRetry = run?.canAdvance && (run.state.attempts < 3 || run.status === 'Executing');
  const stageIndex = prepared ? (run.status === 'Completed' ? 3 : 2) : id ? 1 : 0;

  return <main className="min-h-screen bg-slate-50 text-slate-900" style={tenant ? tenantPalette : undefined}>
    <div className="mx-auto max-w-7xl px-4 py-7 sm:px-8 sm:py-10">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-5">
        <div><p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-indigo-700">RentWise / Rental concierge</p><h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{tenant ? 'Your next chapter starts here.' : 'Great rentals start with a clear plan.'}</h1><p className="mt-3 max-w-xl text-sm leading-6 text-slate-500">{tenant ? 'Tell us what feels like home. We will bring your match, agreement and move-in essentials together.' : 'Review rental proposals, guide your tenants and approve the details with confidence.'}</p></div>
        {tenant && <button disabled={busy} className={primary} onClick={() => { setParams({}); setRequest(empty); setFormStep(0); }}><Plus size={17} />New request</button>}
      </header>
      {error && <div role="alert" className="mb-5 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><AlertCircle size={19} className="shrink-0" />{error}</div>}
      <div className="grid items-start gap-6 lg:grid-cols-[270px_minmax(0,1fr)]">
        <aside className="rounded-3xl border border-slate-200 bg-white p-4 lg:sticky lg:top-6">
          <div className="mb-4 flex items-center justify-between px-2"><h2 className="font-semibold">{tenant ? 'Your requests' : 'Review inbox'}</h2><button aria-label="Refresh requests" disabled={busy} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" onClick={() => perform(refresh)}><RefreshCw size={16} /></button></div>
          <div className="flex gap-2 overflow-x-auto lg:max-h-[65vh] lg:flex-col lg:overflow-y-auto">{runs.map((item, index) => <button disabled={busy} key={item.id} onClick={() => setParams({ id: item.id })} className={`min-w-52 rounded-2xl border p-4 text-left transition lg:min-w-0 ${id === item.id ? 'border-indigo-200 bg-indigo-50' : 'border-transparent hover:bg-slate-50'}`}><span className="mb-2 block text-sm font-semibold">Rental request {runs.length - index}</span><span className={`block text-xs font-medium ${item.status === 'Failed' || item.status === 'Rejected' ? 'text-rose-700' : 'text-indigo-700'}`}>{statuses[item.status] || item.status}</span><span className="mt-2 block text-xs text-slate-400">{date(item.createdAt)}</span></button>)}</div>
          {!loading && !runs.length && <p className="px-2 py-6 text-sm leading-6 text-slate-500">{tenant ? 'Your rental journey will appear here once you send your first request.' : 'New rental proposals will appear here when they are ready for you.'}</p>}
        </aside>
        <section className="min-w-0 space-y-5">
          <div className="grid grid-cols-4 rounded-2xl border border-slate-200 bg-white px-3 py-4 sm:px-6">{['Your preferences', 'Personalised plan', 'Owner review', 'Ready for you'].map((name, index) => <div key={name} className="flex flex-col items-center gap-2 text-center"><span className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${index <= stageIndex ? 'bg-indigo-700 text-white' : 'bg-slate-100 text-slate-400'}`}>{index < stageIndex ? <Check size={15} /> : index + 1}</span><span className={`text-[10px] font-semibold sm:text-xs ${index === stageIndex ? 'text-indigo-800' : 'text-slate-500'}`}>{name}</span></div>)}</div>
          {loading && <div role="status" className="rounded-3xl bg-white p-12 text-center text-slate-500"><Loader2 className="mx-auto mb-3 animate-spin" />Loading your rental journey...</div>}
          {editing && <form onSubmit={submit} className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 p-6 sm:p-8"><span className="mb-4 inline-flex rounded-xl bg-indigo-50 p-3 text-indigo-700"><Sparkles size={24} /></span><p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-400">{revising ? 'Update your preferences' : `Let us make it yours - ${formStep + 1} of 2`}</p><h2 className="text-2xl font-bold">{formStep === 0 ? 'What does home look like to you?' : 'A budget and timeline that fit.'}</h2><p className="mt-2 text-sm text-slate-500">{formStep === 0 ? 'Start with the location, space and little things that matter.' : 'We will use these details to check rent and availability.'}</p></div>
            <div className="space-y-6 p-6 sm:p-8">{formStep === 0 ? <><label className="block text-sm font-semibold">Your ideal home<textarea autoFocus required minLength={10} maxLength={2000} rows={5} value={request.objective} onChange={e => setRequest({ ...request, objective: e.target.value })} className={input} placeholder="I am looking for a two-bedroom home in Malabe, with parking and a quiet space to work..." /></label><p className="text-xs text-slate-400">Include your preferred area, bedrooms and must-have features.</p></> : <><div className="rounded-xl bg-indigo-50 p-4 text-sm leading-6 text-indigo-900">{request.objective}</div><label className="block text-sm font-semibold">Monthly budget (LKR)<input autoFocus required type="number" min="1" max="10000000" step="0.01" className={input} value={request.maxMonthlyRent} onChange={e => setRequest({ ...request, maxMonthlyRent: e.target.value })} placeholder="e.g. 100000" /></label><div className="grid gap-5 sm:grid-cols-2">{[['startDate', 'Move-in date'], ['endDate', 'Lease end date']].map(([key, label]) => <label key={key} className="block text-sm font-semibold">{label}<input required type="date" min={key === 'endDate' ? request.startDate : new Date().toLocaleDateString('en-CA')} className={input} value={request[key]} onChange={e => setRequest({ ...request, [key]: e.target.value })} /></label>)}</div><div className="flex gap-3 text-xs leading-5 text-slate-500"><ShieldCheck size={19} className="shrink-0 text-indigo-600" />Your proposal goes to the owner for review. An agreement is saved as a draft only after approval.</div></>}
            <div className="flex justify-between gap-3 border-t border-slate-100 pt-5">{formStep > 0 ? <button type="button" disabled={busy} className={secondary} onClick={() => setFormStep(0)}><ArrowLeft size={16} />Back</button> : <span />}<button disabled={busy} className={primary}>{busy ? <Loader2 size={17} className="animate-spin" /> : <ArrowRight size={17} />}{formStep === 0 ? 'Continue' : revising ? 'Update my proposal' : 'Find my next home'}</button></div></div>
          </form>}
          {run && !revising && <>
            {tenant && run.canAdvance && <div className="flex justify-end"><button type="button" disabled={busy || (run.status === 'Executing' && Date.now() - new Date(run.updatedAt).getTime() < 180000)} onClick={deleteRequest} className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40"><Trash2 size={16} />Delete request</button></div>}
            {processing && <div className="relative overflow-hidden rounded-3xl bg-[#103f35] p-8 text-white sm:p-12"><div className="absolute -right-12 -top-12 h-56 w-56 rounded-full border-[35px] border-white/5" /><div className="relative"><span className="mb-6 inline-flex rounded-2xl bg-white/10 p-4"><Sparkles size={28} /></span><p className="text-xs font-semibold uppercase tracking-widest text-indigo-200">A little closer to home</p><h2 role="status" className="mt-3 text-2xl font-semibold sm:text-3xl">{stages[plan[completed]] || 'Putting everything together'}</h2><p className="mt-4 max-w-md text-sm leading-6 text-indigo-100/80">We are preparing a proposal around your preferences. Your progress is saved as we go.</p><div role="progressbar" aria-label="Proposal preparation" aria-valuemin={0} aria-valuemax={plan.length || 1} aria-valuenow={completed} className="mt-8 h-2 overflow-hidden rounded-full bg-white/15"><div className="h-full rounded-full bg-indigo-300 transition-all duration-700" style={{ width: `${Math.max(8, completed / Math.max(plan.length, 1) * 100)}%` }} /></div><p className="mt-3 text-xs text-indigo-100">{completed} of {plan.length} preparation checks complete</p>{!busy && run.canAdvance && <button className="mt-6 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-indigo-900" onClick={() => perform(() => prepare(id))}>Continue preparing my proposal</button>}</div></div>}
            {run.status === 'Failed' && <div className="rounded-3xl border border-amber-200 bg-amber-50 p-7"><AlertCircle className="mb-3 text-amber-700" /><h2 className="text-xl font-bold">Let us get your request back on track.</h2><p className="mt-3 text-sm leading-6 text-amber-900">{run.state.error || 'We could not finish preparing this proposal.'}</p><div className="mt-5 flex flex-wrap gap-3">{canRetry && <button disabled={busy} className={primary} onClick={() => perform(() => prepare(id))}>Try again</button>}{tenant && <button className={secondary} disabled={busy} onClick={() => { setRequest({ ...run.state.request, startDate: run.state.request.startDate.slice(0, 10), endDate: run.state.request.endDate.slice(0, 10) }); setFormStep(1); setParams({}); }}>Adjust preferences</button>}</div></div>}
            {prepared && <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"><div className="p-6 sm:p-8"><div className="mb-4 inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-800">{run.status === 'Completed' ? <Check size={14} /> : <Clock size={14} />}{statuses[run.status]}</div><h2 className="text-2xl font-bold">{run.status === 'Completed' ? 'Your rental draft is ready.' : 'A rental plan, made for you.'}</h2><p className="mt-3 text-sm leading-6 text-slate-500">{run.state.request.objective}</p><div className="mt-6 grid gap-4 sm:grid-cols-2"><div className="flex items-center gap-3 rounded-2xl bg-slate-50 p-4"><Wallet className="text-indigo-700" size={20} /><div><p className="text-xs text-slate-500">Monthly budget</p><p className="mt-1 text-sm font-semibold">{money(run.state.request.maxMonthlyRent)}</p></div></div><div className="flex items-center gap-3 rounded-2xl bg-slate-50 p-4"><CalendarDays className="text-indigo-700" size={20} /><div><p className="text-xs text-slate-500">Your lease period</p><p className="mt-1 text-xs font-semibold">{date(run.state.request.startDate)} to {date(run.state.request.endDate)}</p></div></div></div></div>
            <div role="tablist" aria-label="Proposal details" className="flex overflow-x-auto border-y border-slate-100 px-4 sm:px-8">{[['home', 'Your match', Home], ['agreement', 'Agreement', FileText], ['move', 'Move-in', ClipboardCheck]].map(([key, label, Icon]) => <button key={key} role="tab" tabIndex={tab === key ? 0 : -1} onKeyDown={e => { const keys = ["home", "agreement", "move"]; if (["ArrowRight", "ArrowLeft", "Home", "End"].includes(e.key)) { e.preventDefault(); const next = e.key === "Home" ? 0 : e.key === "End" ? 2 : (keys.indexOf(key) + (e.key === "ArrowRight" ? 1 : 2)) % 3; setTab(keys[next]); document.getElementById(`tab-${keys[next]}`)?.focus(); } }} aria-selected={tab === key} aria-controls="proposal-panel" id={`tab-${key}`} onClick={() => setTab(key)} className={`inline-flex shrink-0 items-center gap-2 border-b-2 px-4 py-4 text-sm font-semibold ${tab === key ? 'border-indigo-700 text-indigo-800' : 'border-transparent text-slate-400 hover:text-slate-700'}`}><Icon size={17} />{label}</button>)}</div>
            <div role="tabpanel" id="proposal-panel" aria-labelledby={`tab-${tab}`} className="p-6 sm:p-8">{tab === 'home' && <><h3 className="mb-3 text-lg font-semibold">Why this home fits</h3><p className="whitespace-pre-wrap text-sm leading-7 text-slate-600">{outputs.MatchingLocation?.summary}</p>{outputs.MatchingLocation && <Link className={`${secondary} mt-6`} to={`/properties/${outputs.MatchingLocation.propertyId}`}>Explore this property<ArrowRight size={16} /></Link>}</>}{tab === 'agreement' && <><div className="mb-5 flex flex-wrap items-end justify-between gap-3"><h3 className="text-lg font-semibold">Your proposed agreement</h3><p className="text-lg font-bold text-indigo-800">{money(outputs.AgreementPricing?.monthlyRent)}<span className="ml-1 text-xs font-normal text-slate-500">/ month</span></p></div><p className="mb-5 text-sm leading-6 text-slate-500">{outputs.AgreementPricing?.summary}</p><div className="rounded-2xl bg-slate-50 p-5 text-sm leading-7 whitespace-pre-wrap">{outputs.AgreementPricing?.terms}</div><p className="mt-4 text-xs text-slate-500">Deposit: LKR 0 (not yet negotiated). This is a draft, not an active tenancy.</p></>}{tab === 'move' && <><h3 className="mb-3 text-lg font-semibold">A smooth start to your stay</h3><p className="mb-5 text-sm leading-6 text-slate-500">{outputs.MaintenanceTriage?.summary}</p><ul className="space-y-3">{outputs.MaintenanceTriage?.checklist?.map((item, i) => <li key={i} className="flex gap-3 rounded-xl bg-slate-50 p-4 text-sm leading-6"><ClipboardCheck size={18} className="mt-1 shrink-0 text-indigo-700" />{item}</li>)}</ul></>}</div></div>}
            {run.status === 'AwaitingApproval' && <div className="rounded-3xl border border-indigo-200 bg-indigo-50/60 p-6 sm:p-8"><h3 className="text-lg font-semibold">{run.canReview ? 'Ready to review this proposal?' : 'Your owner has the next step.'}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{run.canReview ? 'Check the property, lease dates and agreement terms before saving the draft.' : 'The owner or an administrator will review the proposal. Any updates will appear here.'}</p>{run.canReview && <><label className="mt-5 block text-sm font-semibold">Message to the tenant<textarea value={note} maxLength={2000} onChange={e => setNote(e.target.value)} rows={3} className={input} placeholder="Required if you request changes or decline the proposal." /></label><div className="mt-5 flex flex-wrap gap-3">{tab !== 'agreement' ? <button className={primary} onClick={() => setTab('agreement')}>Review agreement<ArrowRight size={16} /></button> : <button className={primary} disabled={busy} onClick={() => decide('approve')}>Approve & save draft<Check size={16} /></button>}<button className={secondary} disabled={busy || !note.trim()} onClick={() => decide('revise')}>Request changes</button><button className="px-3 text-sm font-medium text-rose-700 disabled:opacity-40" disabled={busy || !note.trim()} onClick={() => decide('reject')}>Decline</button></div></>}</div>}
            {run.status === 'RevisionRequested' && run.canAdvance && <button className={primary} disabled={busy} onClick={() => { setRequest({ ...run.state.request, startDate: run.state.request.startDate.slice(0, 10), endDate: run.state.request.endDate.slice(0, 10) }); setFormStep(0); setRevising(true); }}>Update my preferences<ArrowRight size={16} /></button>}
            {run.agreementId && <Link className={primary} to={`/agreements/${run.agreementId}`}>View agreement draft<ArrowRight size={16} /></Link>}
            {run.state.decisions.length > 0 && <div className="rounded-2xl border border-slate-200 bg-white p-6"><h3 className="mb-4 font-semibold">Updates from your reviewer</h3>{run.state.decisions.map((decision, i) => <div key={i} className="mt-3 border-l-2 border-indigo-200 pl-4"><p className="text-sm text-slate-700">{decision.note || 'Your proposal was approved.'}</p><p className="mt-1 text-xs text-slate-400">{date(decision.at)}</p></div>)}</div>}
            <details className="px-2 text-xs text-slate-400"><summary className="cursor-pointer">Request activity</summary><p className="mt-3 break-all">Reference {run.id}</p>{run.steps.map(step => <div key={step.id} className="mt-3 flex justify-between gap-3 border-b border-slate-200 pb-2"><span>{stages[step.agentName] || (step.agentName === 'HumanApproval' ? 'Review decision saved' : 'Request updated')} - {step.validationResult.startsWith('Passed') ? 'Complete' : step.validationResult === 'Running' ? 'In progress' : 'Needs attention'}</span><span>{date(step.createdAt)}</span></div>)}</details>
          </>}
          {!loading && !id && !tenant && <div className="rounded-3xl border border-dashed border-slate-300 p-12 text-center"><FileText size={36} className="mx-auto mb-4 text-indigo-700" /><h2 className="text-xl font-semibold">A clear view of every proposal.</h2><p className="mt-3 text-sm text-slate-500">Choose a request from your inbox to review the details.</p></div>}
        </section>
      </div>
    </div>
  </main>;
};
