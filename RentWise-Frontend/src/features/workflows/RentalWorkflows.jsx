import React, { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import api from '../../services/api';

const emptyRequest = { objective: '', maxMonthlyRent: '', startDate: '', endDate: '' };
const fieldClass = 'w-full rounded-lg border border-gray-300 p-3 text-gray-900';
const buttonClass = 'rounded-lg bg-emerald-700 px-4 py-2 font-semibold text-white disabled:opacity-50';
const labels = { MatchingLocation: 'Property matching', PropertyVerification: 'Listing eligibility', AgreementPricing: 'Agreement preparation', MaintenanceTriage: 'Maintenance handover' };

export const RentalWorkflows = () => {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const id = params.get('id');
  const [runs, setRuns] = useState([]);
  const [run, setRun] = useState(null);
  const [request, setRequest] = useState(emptyRequest);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revising, setRevising] = useState(false);
  const refresh = useCallback(async () => {
    const [list, detail] = await Promise.all([
      api.get('/rental-workflows'), id ? api.get(`/rental-workflows/${id}`) : Promise.resolve(null)
    ]);
    setRuns(list.data);
    setRun(detail?.data || null);
  }, [id]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setRun(null);
    setError('');
    setRevising(false);
    setNote('');
    Promise.all([api.get('/rental-workflows'), id ? api.get(`/rental-workflows/${id}`) : Promise.resolve(null)])
      .then(([list, detail]) => { if (active) { setRuns(list.data); setRun(detail?.data || null); } })
      .catch(() => { if (active) setError('Could not load rental workflows. Please refresh.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id]);

  const perform = async (action, reload = true) => {
    setBusy(true);
    setError('');
    try { await action(); if (reload) await refresh(); }
    catch (err) { setError(err.response?.data?.message || 'The request could not complete. Refresh to check the saved status before retrying.'); }
    finally { setBusy(false); }
  };
  const submit = (event) => {
    event.preventDefault();
    perform(async () => {
      const body = { ...request, maxMonthlyRent: Number(request.maxMonthlyRent) };
      if (revising && run) {
        await api.post(`/rental-workflows/${run.id}/revise`, body);
        setRevising(false);
        await refresh();
      } else {
        const res = await api.post('/rental-workflows', body);
        setParams({ id: res.data.id });
      }
    }, false);
  };
  const advance = () => perform(async () => {
    // Separate requests checkpoint every agent. Closing this page never loses a completed step.
    let status;
    do {
      const res = await api.post(`/rental-workflows/${run.id}/advance`);
      status = res.data.status;
      await refresh();
    } while (status === 'Ready');
  });
  const decide = (decision) => perform(() => api.post(`/rental-workflows/${run.id}/decision`, { decision, note, version: run.version }));
  const outputs = run?.state.outputs || {};

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-4 sm:p-8 text-gray-900">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-2xl font-bold">Rental workflows</h1><p className="mt-1 text-gray-600">Find a home, prepare an agreement and review it before saving a draft.</p></div>
        <button className={buttonClass} disabled={busy || loading} onClick={() => perform(refresh)}>Refresh</button>
      </div>
      {error && <p role="alert" className="rounded-lg bg-red-50 p-4 text-red-800">{error}</p>}
      {loading && <p role="status">Loading workflows…</p>}
      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <aside className="space-y-3">
          {user?.role === 'Tenant' && <button className={buttonClass} disabled={busy} onClick={() => { setParams({}); setRequest(emptyRequest); }}>New rental request</button>}
          {!loading && runs.length === 0 && <p className="text-gray-600">No rental workflows yet.</p>}
          {runs.map(item => <button key={item.id} disabled={busy} onClick={() => setParams({ id: item.id })}
            className={`w-full rounded-xl border p-3 text-left ${id === item.id ? 'border-emerald-700 bg-emerald-50' : 'border-gray-200'}`}>
            <span className="block font-semibold">{item.status}</span><span className="text-sm text-gray-500">{new Date(item.createdAt).toLocaleString()}</span>
          </button>)}
        </aside>
        <section className="space-y-5">
          {user?.role === 'Tenant' && (!id || revising) && <form onSubmit={submit} className="space-y-4 rounded-xl border border-gray-200 p-5">
            <h2 className="text-lg font-bold">{revising ? 'Revise your request' : 'Describe your rental needs'}</h2>
            <label className="block">Rental objective<textarea required minLength={10} maxLength={2000} className={fieldClass} rows={3} value={request.objective} onChange={e => setRequest({ ...request, objective: e.target.value })} placeholder="A two-bedroom home in Malabe with parking…" /></label>
            <label className="block">Maximum monthly rent (LKR)<input required type="number" min="1" max="10000000" step="0.01" className={fieldClass} value={request.maxMonthlyRent} onChange={e => setRequest({ ...request, maxMonthlyRent: e.target.value })} /></label>
            <div className="grid gap-3 sm:grid-cols-2">{['startDate', 'endDate'].map(key => <label key={key} className="block">{key === 'startDate' ? 'Lease start' : 'Lease end'}<input required type="date" className={fieldClass} value={request[key]} onChange={e => setRequest({ ...request, [key]: e.target.value })} /></label>)}</div>
            <p className="text-sm text-gray-600">The owner or an administrator must review the proposal before an agreement draft is saved. No booking, payment or tenancy activation happens here.</p>
            <button disabled={busy} className={buttonClass}>{busy ? 'Saving…' : revising ? 'Submit revision' : 'Create workflow'}</button>
          </form>}
          {run && <>
            <div className="rounded-xl border border-gray-200 p-5 space-y-3">
              <h2 className="text-lg font-bold">{run.status}</h2>
              <p>{run.state.request.objective}</p>
              <p className="text-sm text-gray-600">Budget: LKR {Number(run.state.request.maxMonthlyRent).toLocaleString()} · {run.state.request.startDate.slice(0, 10)} to {run.state.request.endDate.slice(0, 10)}</p>
              <p className="break-all text-xs text-gray-500">Reference: {run.id}</p>
              <ol className="list-inside list-decimal space-y-1">{run.state.plan.map(role => <li key={role}>{labels[role]} — {outputs[role] ? 'Complete' : 'Pending'}</li>)}</ol>
              {run.state.error && <p role="alert" className="text-red-700">{run.state.error}</p>}
              {run.canAdvance && ['Ready', 'Failed', 'Executing'].includes(run.status) && <button className={buttonClass} disabled={busy || (run.state.attempts >= 3 && run.status !== 'Executing')} onClick={advance}>{busy ? 'Running agents…' : run.status === 'Ready' ? 'Run remaining steps' : 'Retry / recover step'}</button>}
              {run.status === 'Executing' && <p className="text-sm text-gray-600">If execution was interrupted, recovery becomes available after three minutes.</p>}
              {run.status === 'RevisionRequested' && run.canAdvance && <button disabled={busy} className={buttonClass} onClick={() => { setRequest({ ...run.state.request, startDate: run.state.request.startDate.slice(0, 10), endDate: run.state.request.endDate.slice(0, 10) }); setRevising(true); }}>Edit requested revision</button>}
              {run.agreementId && <Link className="block font-semibold text-emerald-700 underline" to={`/agreements/${run.agreementId}`}>Open saved agreement draft</Link>}
            </div>
            {Object.entries(outputs).map(([role, output]) => <article key={role} className="rounded-xl border border-gray-200 p-5 space-y-2">
              <h3 className="font-bold">{labels[role]}</h3><p className="whitespace-pre-wrap">{output.summary}</p>
              {role === 'MatchingLocation' && <Link className="text-emerald-700 underline" to={`/properties/${output.propertyId}`}>View selected property</Link>}
              {output.monthlyRent != null && <p>Monthly rent: LKR {Number(output.monthlyRent).toLocaleString()} · Deposit: LKR 0 (not negotiated)</p>}
              {output.terms && <p className="whitespace-pre-wrap rounded-lg bg-gray-50 p-3">{output.terms}</p>}
              {output.checklist && <ul className="list-inside list-disc">{output.checklist.map((item, i) => <li key={i}>{item}</li>)}</ul>}
            </article>)}
            {run.status === 'AwaitingApproval' && <div className="rounded-xl border border-amber-300 bg-amber-50 p-5 space-y-3">
              <h3 className="font-bold">Owner review required</h3><p>Approval saves the displayed terms as a draft agreement. Check the property, rent, dates and terms before deciding.</p>
              {run.canReview ? <><label className="block">Review note (required for rejection or revision)<textarea className={fieldClass} maxLength={2000} value={note} onChange={e => setNote(e.target.value)} /></label><div className="flex flex-wrap gap-3">
                <button disabled={busy} className={buttonClass} onClick={() => decide('approve')}>Approve and save draft</button>
                <button disabled={busy || !note.trim()} className={buttonClass} onClick={() => decide('revise')}>Request revision</button>
                <button disabled={busy || !note.trim()} className="rounded-lg border border-red-600 px-4 py-2 text-red-700 disabled:opacity-50" onClick={() => decide('reject')}>Reject</button>
              </div></> : <p>The property owner or an administrator can review this request from their Rental workflows page.</p>}
            </div>}
            {run.state.decisions.map((decision, i) => <p key={i} className="rounded-lg bg-gray-50 p-3"><strong>{decision.decision}</strong>: {decision.note || 'Approved'} · {new Date(decision.at).toLocaleString()}</p>)}
            <details className="rounded-xl border border-gray-200 p-5"><summary className="cursor-pointer font-bold">Execution history ({run.steps.length} records)</summary>
              {run.steps.map(step => <div key={step.id} className="mt-4 border-t pt-3"><p className="font-semibold">{step.agentName} · attempt {step.attempt}</p><p className="text-sm">{step.validationResult}</p><p className="text-xs text-gray-500">{new Date(step.createdAt).toLocaleString()} · {Math.max(0, (new Date(step.updatedAt) - new Date(step.createdAt)) / 1000).toFixed(1)}s</p>
                <details><summary className="cursor-pointer text-sm text-emerald-700">Input, tools and output</summary><pre className="max-h-80 overflow-auto whitespace-pre-wrap break-all rounded bg-gray-50 p-3 text-xs">{JSON.stringify({ input: step.inputJson, tools: step.toolCallsJson, output: step.outputJson }, null, 2)}</pre></details>
              </div>)}
            </details>
          </>}
          {!loading && !id && user?.role !== 'Tenant' && <p>Select a workflow to review its results and approval request.</p>}
        </section>
      </div>
    </main>
  );
};
