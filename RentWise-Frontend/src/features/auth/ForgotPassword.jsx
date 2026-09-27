import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Clock3, Eye, EyeOff, Home, Loader2, LockKeyhole, Mail, ShieldCheck } from 'lucide-react';
import api from '../../services/api';

const inputClass = 'w-full rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-800 dark:text-white';
const buttonClass = 'flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition hover:from-blue-700 hover:to-indigo-700 disabled:cursor-not-allowed disabled:opacity-50';

export const ForgotPassword = () => {
  const [step, setStep] = useState(0);
  const [email, setEmail] = useState('');
  const [digits, setDigits] = useState(Array(6).fill(''));
  const [deadline, setDeadline] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [resetToken, setResetToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const inputs = useRef([]);
  const heading = useRef(null);
  const inFlight = useRef(false);

  useEffect(() => {
    if (step !== 1) return;
    const tick = () => setSeconds(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
    tick();
    const timer = setInterval(tick, 250);
    return () => clearInterval(timer);
  }, [deadline, step]);

  useEffect(() => {
    if (step === 1) inputs.current[0]?.focus();
    else heading.current?.focus();
  }, [step]);

  const request = async (action) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    try { await action(); }
    catch (err) {
      const data = err.response?.data;
      setError(data?.message || Object.values(data?.errors || {}).flat()[0] ||
        (err.response?.status === 429 ? 'Too many requests. Please wait a minute and try again.' : 'Unable to connect. Please try again.'));
    } finally { setBusy(false); inFlight.current = false; }
  };

  const sendCode = () => request(async () => {
    const normalized = email.trim().toLowerCase();
    const { data } = await api.post('/auth/forgot-password', { email: normalized });
    setEmail(normalized);
    setDigits(Array(6).fill(''));
    setResetToken('');
    setDeadline(Date.now() + data.expiresInSeconds * 1000);
    setSeconds(data.expiresInSeconds);
    setStep(1);
    setNotice(data.message);
    inputs.current[0]?.focus();
  });

  const verify = () => request(async () => {
    const { data } = await api.post('/auth/verify-reset-code', { email, code: digits.join('') });
    setResetToken(data.resetToken);
    setStep(2);
  });

  const reset = () => {
    if (password !== confirm) { setError('Passwords do not match. Please check both fields.'); return; }
    return request(async () => {
      await api.post('/auth/reset-password', { email, resetToken, newPassword: password, confirmPassword: confirm });
      setResetToken(''); setPassword(''); setConfirm(''); setStep(3);
    });
  };

  const fillDigits = (value, index) => {
    const numbers = value.replace(/[^0-9]/g, '').slice(0, 6 - index);
    setDigits(current => {
      const next = [...current];
      if (!numbers) next[index] = '';
      else numbers.split('').forEach((digit, offset) => { next[index + offset] = digit; });
      return next;
    });
    if (numbers) inputs.current[Math.min(index + numbers.length, 5)]?.focus();
  };

  const restart = () => { setStep(0); setError(''); setNotice(''); setResetToken(''); setPassword(''); setConfirm(''); };
  const Icon = [Mail, ShieldCheck, LockKeyhole, CheckCircle2][step];
  const titles = ['Forgot your password?', 'Check your inbox', 'Create a new password', 'You’re all set!'];

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-slate-950 px-4 py-24 font-sans">
      <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&w=2160&q=85')" }} />
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950/90 via-slate-950/65 to-blue-950/80" />
      <Link to="/login" className="absolute left-6 top-7 z-10 flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm text-white backdrop-blur-md hover:bg-white/20"><ArrowLeft size={16} /> Back to sign in</Link>
      <section className="relative z-10 w-full max-w-[480px] rounded-[28px] border border-white/50 bg-white/95 p-6 shadow-2xl backdrop-blur-2xl sm:p-10 dark:border-white/10 dark:bg-slate-900/95" aria-labelledby="reset-heading">
        <div className="mb-8 flex items-center justify-center gap-2 text-xl font-black tracking-tight text-slate-900 dark:text-white"><Home className="text-blue-600" size={24} />Rent<span className="-ml-2 text-blue-600">Wise</span></div>
        {step < 3 && <ol aria-label="Password reset progress" className="mb-8 flex items-center justify-center">
          {['Email', 'Verify', 'Reset'].map((label, index) => <li key={label} aria-current={index === step ? 'step' : undefined} className="flex items-center">
            {index > 0 && <span className={`mx-3 h-px w-5 sm:w-8 ${index <= step ? 'bg-blue-500' : 'bg-slate-200 dark:bg-slate-700'}`} />}
            <span className={`flex items-center gap-1.5 text-xs font-semibold ${index <= step ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'}`}><span className={`flex h-6 w-6 items-center justify-center rounded-full ${index <= step ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800'}`}>{index < step ? <Check size={13} /> : index + 1}</span>{label}</span>
          </li>)}
        </ol>}
        <div className="mb-6 text-center">
          <div className={`mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl ${step === 3 ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-50 text-blue-600 dark:bg-blue-500/10'}`}><Icon size={30} strokeWidth={1.7} /></div>
          <h1 id="reset-heading" ref={heading} tabIndex={-1} className="text-2xl font-bold tracking-tight text-slate-900 outline-none dark:text-white">{titles[step]}</h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-500 dark:text-slate-400">{step === 0 ? 'No worries. Enter your account email and we’ll help you get back in.' : step === 1 ? <>Enter the 6-digit code sent to your registered email.<span className="mt-1 block break-all font-semibold text-slate-700 dark:text-slate-200">{email}</span></> : step === 2 ? 'Choose a strong password to keep your account secure.' : 'Your password has been updated. Sign in with your new password to continue.'}</p>
        </div>
        {error && <div role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}
        {notice && <p role="status" className="mb-4 rounded-xl bg-blue-50 p-3 text-xs leading-relaxed text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">{notice}</p>}
        <form onSubmit={e => { e.preventDefault(); if (!busy) { if (step === 0) sendCode(); else if (step === 1 && seconds > 0 && digits.every(Boolean)) verify(); else if (step === 2) reset(); } }} className="space-y-5">
          {step === 0 && <><div><label htmlFor="reset-email" className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">Email address</label><input id="reset-email" type="email" autoComplete="email" required maxLength={200} value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" className={inputClass} disabled={busy} /></div><button disabled={busy} className={buttonClass}>{busy ? <Loader2 size={18} className="animate-spin" /> : <>Send verification code <ArrowRight size={17} /></>}</button></>}
          {step === 1 && <>
            <fieldset disabled={busy || seconds === 0}><legend className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">Verification code</legend><div className="grid grid-cols-6 gap-2">
              {digits.map((digit, index) => <input key={index} ref={node => { inputs.current[index] = node; }} aria-label={`Digit ${index + 1} of 6`} type="text" inputMode="numeric" autoComplete={index === 0 ? 'one-time-code' : 'off'} value={digit} onChange={e => fillDigits(e.target.value, index)} onFocus={e => e.target.select()} onPaste={e => { e.preventDefault(); fillDigits(e.clipboardData.getData('text'), index); }} onKeyDown={e => {
                if (e.key === 'Backspace' && !digit && index > 0) { e.preventDefault(); setDigits(current => current.map((d, i) => i === index - 1 ? '' : d)); inputs.current[index - 1]?.focus(); }
                if (e.key === 'ArrowLeft' && index > 0) { e.preventDefault(); inputs.current[index - 1]?.focus(); }
                if (e.key === 'ArrowRight' && index < 5) { e.preventDefault(); inputs.current[index + 1]?.focus(); }
              }} className="h-14 min-w-0 rounded-xl border-2 border-slate-200 bg-white text-center text-2xl font-bold text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 disabled:opacity-50 sm:h-16 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />)}
            </div></fieldset>
            <div className={`flex items-center justify-center gap-2 text-sm ${seconds === 0 ? 'text-rose-600' : 'text-slate-500 dark:text-slate-400'}`}><Clock3 size={16} /><span role="timer">{seconds > 0 ? <>Code expires in <strong className="tabular-nums text-blue-600 dark:text-blue-400">{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}</strong></> : 'Your code has expired.'}</span></div>
            <button disabled={busy || seconds === 0 || !digits.every(Boolean)} className={buttonClass}>{busy ? <Loader2 size={18} className="animate-spin" /> : <>Verify code <ArrowRight size={17} /></>}</button>
            <div className="text-center text-sm text-slate-500 dark:text-slate-400">{seconds === 0 ? <button type="button" disabled={busy} onClick={sendCode} className="font-bold text-blue-600 hover:underline disabled:opacity-50 dark:text-blue-400">Resend code</button> : 'You can resend a code when the timer ends.'}<p className="mt-3 text-xs">Check your spam folder too.</p></div>
            <button type="button" disabled={busy} onClick={restart} className="block w-full text-center text-xs font-semibold text-slate-500 hover:text-blue-600 dark:text-slate-400">Use a different email</button>
          </>}
          {step === 2 && <>
            {[['new-password', 'New password', password, setPassword], ['confirm-password', 'Confirm password', confirm, setConfirm]].map(([id, label, value, setter]) => <div key={id}><label htmlFor={id} className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">{label}</label><div className="relative"><input id={id} required minLength={8} maxLength={64} type={visible ? 'text' : 'password'} autoComplete="new-password" value={value} onChange={e => setter(e.target.value)} disabled={busy} className={`${inputClass} pr-12`} /><button type="button" onClick={() => setVisible(!visible)} aria-label={visible ? 'Hide passwords' : 'Show passwords'} className="absolute inset-y-0 right-0 px-4 text-slate-400">{visible ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></div>)}
            <p className="text-xs text-slate-500 dark:text-slate-400">Use 8–64 characters. A mix of letters, numbers and symbols works best.</p>
            <button disabled={busy} className={buttonClass}>{busy ? <Loader2 size={18} className="animate-spin" /> : <>Reset password <LockKeyhole size={17} /></>}</button>
            <button type="button" disabled={busy} onClick={restart} className="block w-full text-center text-xs text-slate-500 hover:text-blue-600">Need a new code? Start again</button>
          </>}
          {step === 3 && <Link to="/login" className={buttonClass}>Back to sign in <ArrowRight size={17} /></Link>}
        </form>
        <div className="mt-7 flex items-center justify-center gap-1.5 border-t border-slate-200/70 pt-5 text-xs text-slate-400 dark:border-slate-700"><ShieldCheck size={14} /> Secure account recovery</div>
      </section>
    </main>
  );
};
