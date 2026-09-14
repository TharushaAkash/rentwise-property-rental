import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import api from '../../services/api';
import { Home, Mail, Lock, Eye, EyeOff, ArrowLeft, ShieldCheck, Sparkles, Building2 } from 'lucide-react';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required')
});

const VILLA_BG = 'https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&w=2160&q=85';

export const Login = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [activeRole, setActiveRole] = useState('Tenant'); // 'Tenant' or 'PropertyOwner'
  const [rememberMe, setRememberMe] = useState(true);

  const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(loginSchema)
  });

  const onSubmit = async (data) => {
    try {
      setServerError('');
      const response = await api.post('/auth/login', data);
      login(response.data.token);
      navigate('/dashboard', { replace: true });
    } catch (error) {
      const message = error.response?.data?.message || error.response?.data || 'Invalid email or password. Please try again.';
      setServerError(typeof message === 'string' ? message : 'Failed to login');
    }
  };

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center overflow-hidden font-sans">
      {/* High-res Luxury Villa Background with ambient overlay */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-transform duration-1000 scale-105"
        style={{ backgroundImage: `url('${VILLA_BG}')` }}
      >
        {/* Cinematic dark gradient overlays */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/45 to-black/60" />
        <div className="absolute inset-0 bg-slate-950/20 backdrop-blur-[1px]" />
      </div>

      {/* Top Bar with "Back to Home" Button */}
      <header className="absolute top-0 left-0 right-0 z-20 px-6 py-6 sm:px-12 flex items-center justify-between">
        <button
          onClick={() => navigate('/')}
          className="group inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white/90 hover:text-white text-sm font-medium backdrop-blur-md border border-white/20 transition-all duration-200 hover:-translate-x-0.5"
        >
          <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
          <span>Back to Home</span>
        </button>

        <div className="hidden sm:flex items-center gap-2 text-white/80 text-xs font-medium tracking-wider uppercase">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          Luxury Rental Portal
        </div>
      </header>

      {/* Centered Glassmorphism Login Card */}
      <div className="relative z-10 w-full max-w-[440px] mx-4 my-16 animate-in fade-in zoom-in-95 duration-500">
        <div className="relative rounded-[28px] bg-white/85 dark:bg-slate-900/85 backdrop-blur-2xl p-7 sm:p-9 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.5)] border border-white/50 dark:border-white/10">
          
          {/* Logo & Header */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/30 mb-3.5">
              <Home className="w-6 h-6" />
            </div>
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <span className="text-xl font-black tracking-tight text-gray-900 dark:text-white">
                Rent<span className="text-blue-600">Wise</span>
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
              Welcome Back
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Sign in to continue to your dashboard
            </p>
          </div>

          {/* Role Segmented Selector: User (Tenant) | Seller (Owner) */}
          <div className="grid grid-cols-2 gap-1 p-1 bg-gray-100/90 dark:bg-slate-800/80 rounded-xl mb-6 border border-gray-200/50 dark:border-slate-700/50">
            <button
              type="button"
              onClick={() => setActiveRole('Tenant')}
              className={`py-2 text-xs font-bold rounded-lg transition-all duration-200 ${
                activeRole === 'Tenant'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              User / Tenant
            </button>
            <button
              type="button"
              onClick={() => setActiveRole('PropertyOwner')}
              className={`py-2 text-xs font-bold rounded-lg transition-all duration-200 ${
                activeRole === 'PropertyOwner'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              Owner / Admin
            </button>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Email Field */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  {...register('email')}
                  type="email"
                  placeholder="name@example.com"
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/90 dark:bg-slate-800/90 border border-gray-200 dark:border-slate-700 text-gray-900 dark:text-white placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all shadow-sm"
                />
              </div>
              {errors.email && (
                <p className="text-rose-500 text-xs mt-1.5 font-medium">{errors.email.message}</p>
              )}
            </div>

            {/* Password Field */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  {...register('password')}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-3 rounded-xl bg-white/90 dark:bg-slate-800/90 border border-gray-200 dark:border-slate-700 text-gray-900 dark:text-white placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all shadow-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-rose-500 text-xs mt-1.5 font-medium">{errors.password.message}</p>
              )}
            </div>

            {/* Remember Me & Forgot Password */}
            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500/30"
                />
                <span className="text-xs text-gray-600 dark:text-gray-400">Remember me</span>
              </label>
              <button
                type="button"
                onClick={() => alert('Please contact administrator or reset through support.')}
                className="text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 hover:underline"
              >
                Forgot Password?
              </button>
            </div>

            {/* Error Message */}
            {serverError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl text-rose-600 dark:text-rose-300 text-xs font-medium">
                {serverError}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-2 py-3.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-blue-600/30 hover:shadow-blue-600/50 transition-all duration-200 disabled:opacity-50 active:scale-[0.99] flex items-center justify-center gap-2 text-sm"
            >
              {isSubmitting ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Signing in...</span>
                </>
              ) : (
                <span>Sign In</span>
              )}
            </button>

            {/* Register Link */}
            <div className="text-center pt-3">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Don't have an account?{' '}
              </span>
              <button
                type="button"
                onClick={() => navigate('/register')}
                className="text-xs font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 hover:underline transition-colors"
              >
                Create for free
              </button>
            </div>
          </form>
        </div>

        {/* Security watermark */}
        <div className="mt-4 flex items-center justify-center gap-1.5 text-xs text-white/60 drop-shadow">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Bank-grade 256-bit encrypted authentication</span>
        </div>
      </div>
    </div>
  );
};