import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { Home, Mail, Lock, User, ArrowLeft, ShieldCheck, Eye, EyeOff, Phone, CreditCard } from 'lucide-react';

const registerSchema = z.object({
  fullName: z.string().min(3, 'Full name is required (min 3 characters)'),
  email: z.string().email('Invalid email address format'),
  phoneNumber: z.string()
    .min(1, 'Phone number is required')
    .regex(/^\d{10}$/, 'Phone number must be exactly 10 digits (e.g. 0712345678)'),
  nicNumber: z.string()
    .min(1, 'NIC number is required')
    .regex(/^([0-9]{9}[vV]|[0-9]{12})$/, "NIC must be 12 digits or 9 digits followed by 'V' (e.g. 123456789V or 200012345678)"),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string().min(8, 'Confirm password must be at least 8 characters'),
  role: z.enum(['Tenant', 'PropertyOwner']).default('Tenant')
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword']
});

const VILLA_BG = 'https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&w=2160&q=85';

export const Register = () => {
  const navigate = useNavigate();
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm({
    resolver: zodResolver(registerSchema),
    defaultValues: { role: 'Tenant' }
  });

  const selectedRole = watch('role');

  const onSubmit = async (data) => {
    try {
      setIsLoading(true);
      setError(null);
      
      const payload = {
        name: data.fullName.trim(),
        fullName: data.fullName.trim(),
        email: data.email.trim(),
        phoneNumber: data.phoneNumber.trim(),
        nicNumber: data.nicNumber.trim().toUpperCase(),
        password: data.password,
        role: data.role
      };

      await api.post('/auth/register', payload);
      navigate('/login', { state: { message: 'Registration successful! Please sign in with your credentials.' } });
    } catch (err) {
      let message = 'Registration failed. Please try again.';
      if (err.response?.data?.errors) {
        message = Object.values(err.response.data.errors).flat().join(' ');
      } else if (err.response?.data?.message) {
        message = err.response.data.message;
      } else if (typeof err.response?.data === 'string') {
        message = err.response.data;
      }
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center overflow-x-hidden overflow-y-auto font-sans py-12">
      {/* High-res Luxury Villa Background */}
      <div 
        className="fixed inset-0 bg-cover bg-center bg-no-repeat transition-transform duration-1000 scale-105"
        style={{ backgroundImage: `url('${VILLA_BG}')` }}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/55 to-black/70" />
        <div className="absolute inset-0 bg-slate-950/20 backdrop-blur-[1px]" />
      </div>

      {/* Top Navigation */}
      <header className="absolute top-0 left-0 right-0 z-20 px-6 py-6 sm:px-12 flex items-center justify-between">
        <button
          onClick={() => navigate('/')}
          className="group inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white/90 hover:text-white text-sm font-medium backdrop-blur-md border border-white/20 transition-all duration-200 hover:-translate-x-0.5"
        >
          <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
          <span>Back to Home</span>
        </button>

        <button
          onClick={() => navigate('/login')}
          className="text-xs font-semibold text-white/90 hover:text-white bg-white/10 hover:bg-white/20 px-4 py-2 rounded-full backdrop-blur-md border border-white/20 transition-all"
        >
          Already registered? Sign In
        </button>
      </header>

      {/* Centered Glassmorphism Card */}
      <div className="relative z-10 w-full max-w-[520px] mx-4 my-12 animate-in fade-in zoom-in-95 duration-500">
        <div className="relative rounded-[28px] bg-white/85 dark:bg-slate-900/85 backdrop-blur-2xl p-6 sm:p-8 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.5)] border border-white/50 dark:border-white/10">
          
          {/* Logo & Header */}
          <div className="text-center mb-5">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/30 mb-3">
              <Home className="w-6 h-6" />
            </div>
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <span className="text-xl font-black tracking-tight text-gray-900 dark:text-white">
                Rent<span className="text-blue-600">Wise</span>
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
              Create Your Account
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Join RentWise to discover and manage premium rental properties
            </p>
          </div>

          {/* Role Segmented Buttons */}
          <div className="grid grid-cols-2 gap-1 p-1 bg-gray-100/90 dark:bg-slate-800/80 rounded-xl mb-4 border border-gray-200/50 dark:border-slate-700/50">
            <button
              type="button"
              onClick={() => setValue('role', 'Tenant')}
              className={`py-2 text-xs font-bold rounded-lg transition-all duration-200 ${
                selectedRole === 'Tenant'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              I am a Tenant
            </button>
            <button
              type="button"
              onClick={() => setValue('role', 'PropertyOwner')}
              className={`py-2 text-xs font-bold rounded-lg transition-all duration-200 ${
                selectedRole === 'PropertyOwner'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              I am an Owner
            </button>
          </div>

          {/* Form */}
          <form className="space-y-3.5" onSubmit={handleSubmit(onSubmit)}>
            {/* Full Name */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
                Full Name
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  {...register('fullName')}
                  type="text"
                  placeholder="Alexander Wright"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/90 dark:bg-slate-800/90 border border-gray-200 dark:border-slate-700 text-gray-900 dark:text-white placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all shadow-sm"
                />
              </div>
              {errors.fullName && (
                <p className="text-rose-500 text-xs mt-1 font-medium">{errors.fullName.message}</p>
              )}
            </div>

            {/* Email Address */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
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
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/90 dark:bg-slate-800/90 border border-gray-200 dark:border-slate-700 text-gray-900 dark:text-white placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all shadow-sm"
                />
              </div>
              {errors.email && (
                <p className="text-rose-500 text-xs mt-1 font-medium">{errors.email.message}</p>
              )}
            </div>

            {/* Phone Number and NIC Number Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Phone Number */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
                  Phone Number
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                    <Phone className="w-4 h-4" />
                  </div>
                  <input
                    {...register('phoneNumber')}
                    type="tel"
                    maxLength={10}
                    placeholder="0712345678"
                    className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-white/90 dark:bg-slate-800/90 border border-gray-200 dark:border-slate-700 text-gray-900 dark:text-white placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all shadow-sm"
                  />
                </div>
                {errors.phoneNumber && (
                  <p className="text-rose-500 text-xs mt-1 font-medium">{errors.phoneNumber.message}</p>
                )}
              </div>

              {/* NIC Number */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
                  NIC Number
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                    <CreditCard className="w-4 h-4" />
                  </div>
                  <input
                    {...register('nicNumber')}
                    type="text"
                    maxLength={12}
                    placeholder="123456789V / 2000..."
                    className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-white/90 dark:bg-slate-800/90 border border-gray-200 dark:border-slate-700 text-gray-900 dark:text-white placeholder-gray-400 text-sm uppercase focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all shadow-sm"
                  />
                </div>
                {errors.nicNumber && (
                  <p className="text-rose-500 text-xs mt-1 font-medium">{errors.nicNumber.message}</p>
                )}
              </div>
            </div>

            {/* Password and Confirm Password Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Password */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    {...register('password')}
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Min 8 chars"
                    className="w-full pl-10 pr-9 py-2.5 rounded-xl bg-white/90 dark:bg-slate-800/90 border border-gray-200 dark:border-slate-700 text-gray-900 dark:text-white placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all shadow-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-rose-500 text-xs mt-1 font-medium">{errors.password.message}</p>
                )}
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
                  Confirm Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    {...register('confirmPassword')}
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="Re-enter password"
                    className="w-full pl-10 pr-9 py-2.5 rounded-xl bg-white/90 dark:bg-slate-800/90 border border-gray-200 dark:border-slate-700 text-gray-900 dark:text-white placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all shadow-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                    aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.confirmPassword && (
                  <p className="text-rose-500 text-xs mt-1 font-medium">{errors.confirmPassword.message}</p>
                )}
              </div>
            </div>

            {/* Server Error Display */}
            {error && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl text-rose-600 dark:text-rose-300 text-xs font-medium">
                {error}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-blue-600/30 hover:shadow-blue-600/50 transition-all duration-200 disabled:opacity-50 active:scale-[0.99] flex items-center justify-center gap-2 text-sm"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Creating account...</span>
                </>
              ) : (
                <span>Create Account</span>
              )}
            </button>

            {/* Login Link */}
            <div className="text-center pt-2">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Already have an account?{' '}
              </span>
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="text-xs font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 hover:underline transition-colors"
              >
                Sign In
              </button>
            </div>
          </form>
        </div>

        <div className="mt-4 flex items-center justify-center gap-1.5 text-xs text-white/60 drop-shadow">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Protected by RentWise verification protocols</span>
        </div>
      </div>
    </div>
  );
};
export default Register;
