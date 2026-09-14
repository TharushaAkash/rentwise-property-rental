import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import api from '../../services/api';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { 
  User, 
  Mail, 
  Lock, 
  ShieldCheck, 
  Calendar, 
  CheckCircle2, 
  AlertCircle, 
  Eye, 
  EyeOff, 
  KeyRound,
  Building,
  Sparkles,
  Phone,
  CreditCard
} from 'lucide-react';

export const OwnerProfileSection = () => {
  const { user, updateUser } = useAuth();

  // Profile Form State
  const [profileData, setProfileData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    fullName: '',
    phoneNumber: '',
    nicNumber: '',
    role: '',
    createdAt: ''
  });
  const [isFetchingProfile, setIsFetchingProfile] = useState(true);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSuccessMsg, setProfileSuccessMsg] = useState('');
  const [profileErrorMsg, setProfileErrorMsg] = useState('');

  // Password Form State
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordSuccessMsg, setPasswordSuccessMsg] = useState('');
  const [passwordErrorMsg, setPasswordErrorMsg] = useState('');

  // Fetch live profile details
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setIsFetchingProfile(true);
        const res = await api.get('/auth/profile');
        if (res.data) {
          setProfileData({
            firstName: res.data.firstName || '',
            lastName: res.data.lastName || '',
            email: res.data.email || user?.email || '',
            fullName: res.data.fullName || res.data.name || `${res.data.firstName || ''} ${res.data.lastName || ''}`.trim(),
            phoneNumber: res.data.phoneNumber || '',
            nicNumber: res.data.nicNumber || '',
            role: res.data.role || user?.role || 'PropertyOwner',
            createdAt: res.data.createdAt || ''
          });
        }
      } catch (err) {
        console.error('Failed to load profile', err);
        // Fallback to auth context
        setProfileData({
          firstName: user?.fullName?.split(' ')[0] || '',
          lastName: user?.fullName?.includes(' ') ? user.fullName.split(' ').slice(1).join(' ') : '',
          email: user?.email || '',
          fullName: user?.fullName || user?.email || '',
          phoneNumber: user?.phoneNumber || '',
          nicNumber: user?.nicNumber || '',
          role: user?.role || 'PropertyOwner',
          createdAt: ''
        });
      } finally {
        setIsFetchingProfile(false);
      }
    };

    fetchProfile();
  }, [user]);

  // Handle Profile Update
  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setProfileSuccessMsg('');
    setProfileErrorMsg('');

    // Validate Phone Number (10 digits)
    if (profileData.phoneNumber && !/^\d{10}$/.test(profileData.phoneNumber.trim())) {
      setProfileErrorMsg('Phone number must be exactly 10 digits (e.g. 0712345678).');
      return;
    }

    // Validate NIC (12 digits or 9 digits with 'v'/'V')
    if (profileData.nicNumber && !/^([0-9]{9}[vV]|[0-9]{12})$/.test(profileData.nicNumber.trim())) {
      setProfileErrorMsg("NIC must be 12 digits or 9 digits followed by 'V' (e.g. 123456789V or 200012345678).");
      return;
    }

    try {
      setIsSavingProfile(true);
      const res = await api.put('/auth/profile', {
        firstName: profileData.firstName.trim(),
        lastName: profileData.lastName.trim(),
        fullName: `${profileData.firstName.trim()} ${profileData.lastName.trim()}`.trim(),
        phoneNumber: profileData.phoneNumber ? profileData.phoneNumber.trim() : null,
        nicNumber: profileData.nicNumber ? profileData.nicNumber.trim().toUpperCase() : null
      });

      setProfileSuccessMsg('Profile details updated successfully!');
      
      // Update auth context with refreshed token and user details
      if (res.data?.token) {
        updateUser(res.data.token, res.data.user);
      } else if (res.data?.user) {
        updateUser(null, res.data.user);
      }

      setTimeout(() => setProfileSuccessMsg(''), 5000);
    } catch (err) {
      console.error('Profile update failed:', err);
      let msg = 'Failed to update profile. Please check your inputs.';
      if (err.response?.data?.errors) {
        msg = Object.values(err.response.data.errors).flat().join(' ');
      } else if (err.response?.data?.message) {
        msg = err.response.data.message;
      } else if (typeof err.response?.data === 'string') {
        msg = err.response.data;
      }
      setProfileErrorMsg(msg);
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Handle Password Change
  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setPasswordSuccessMsg('');
    setPasswordErrorMsg('');

    if (!passwordData.currentPassword) {
      setPasswordErrorMsg('Please enter your current password.');
      return;
    }

    if (!passwordData.newPassword) {
      setPasswordErrorMsg('Please enter a new password.');
      return;
    }

    if (passwordData.newPassword.length < 8) {
      setPasswordErrorMsg('New password must be at least 8 characters.');
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordErrorMsg('New password and confirmation do not match.');
      return;
    }

    try {
      setIsChangingPassword(true);
      const res = await api.post('/auth/change-password', {
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword
      });

      setPasswordSuccessMsg(res.data?.message || 'Password changed successfully!');
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
      setTimeout(() => setPasswordSuccessMsg(''), 5000);
    } catch (err) {
      console.error('Password change failed:', err);
      const msg = err.response?.data || 'Failed to change password. Please verify current password.';
      setPasswordErrorMsg(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setIsChangingPassword(false);
    }
  };

  // Calculate initials for avatar
  const getInitials = () => {
    if (profileData.firstName && profileData.lastName) {
      return `${profileData.firstName[0]}${profileData.lastName[0]}`.toUpperCase();
    }
    if (profileData.fullName) {
      const parts = profileData.fullName.trim().split(' ');
      if (parts.length > 1) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
      return parts[0].slice(0, 2).toUpperCase();
    }
    if (profileData.email) {
      return profileData.email.slice(0, 2).toUpperCase();
    }
    return 'PO';
  };

  const formattedDate = profileData.createdAt 
    ? new Date(profileData.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
    : 'Active Member';

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-3 duration-500 max-w-6xl pb-12">
      {/* Section Header */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-gray-900">My Profile</h2>
        <p className="text-gray-500 mt-1 text-sm">
          Manage your personal account details, contact information, and security password.
        </p>
      </div>

      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-8 sm:p-10 text-white shadow-xl border border-slate-800">
        <div className="absolute right-0 top-0 -mt-12 -mr-12 h-64 w-64 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-2xl font-black text-white shadow-lg shadow-indigo-500/30 border border-white/20">
              {getInitials()}
            </div>
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                  {profileData.fullName || profileData.email || 'Property Owner'}
                </h1>
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  <ShieldCheck className="w-3.5 h-3.5 mr-1" />
                  Verified Landlord
                </span>
              </div>
              <div className="flex items-center gap-4 text-sm text-slate-300 mt-2 flex-wrap">
                <span className="flex items-center gap-1.5">
                  <Mail className="w-4 h-4 text-slate-400" />
                  {profileData.email}
                </span>
                {profileData.phoneNumber && (
                  <span className="flex items-center gap-1.5">
                    <Phone className="w-4 h-4 text-slate-400" />
                    {profileData.phoneNumber}
                  </span>
                )}
                {profileData.nicNumber && (
                  <span className="flex items-center gap-1.5">
                    <CreditCard className="w-4 h-4 text-slate-400" />
                    NIC: {profileData.nicNumber}
                  </span>
                )}
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  Member since {formattedDate}
                </span>
              </div>
            </div>
          </div>

          <div className="hidden lg:flex items-center gap-3 bg-white/10 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-white/10">
            <Building className="w-5 h-5 text-indigo-300" />
            <div className="text-left">
              <p className="text-xs text-slate-300 uppercase font-semibold">Account Role</p>
              <p className="text-sm font-bold text-white">Property Owner</p>
            </div>
          </div>
        </div>
      </div>

      {/* Grid: 2 Columns on Desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Profile Details */}
        <div className="lg:col-span-7 space-y-6">
          <Card className="border border-slate-200/80 shadow-sm bg-white rounded-2xl overflow-hidden">
            <CardHeader className="border-b border-gray-100 bg-gray-50/50 pb-5">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <User className="w-5 h-5 text-indigo-600" />
                    Personal Information
                  </CardTitle>
                  <p className="text-sm text-gray-500 mt-1">
                    Update your account contact details, phone, NIC, and public name.
                  </p>
                </div>
                <Badge variant="default" className="text-xs bg-indigo-50 text-indigo-700 border-indigo-200">
                  Editable
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="p-6">
              {profileSuccessMsg && (
                <div className="mb-5 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center gap-3 text-sm animate-in fade-in">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <span>{profileSuccessMsg}</span>
                </div>
              )}

              {profileErrorMsg && (
                <div className="mb-5 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-3 text-sm animate-in fade-in">
                  <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
                  <span>{profileErrorMsg}</span>
                </div>
              )}

              <form onSubmit={handleProfileSubmit} className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="First Name"
                    placeholder="e.g. Sarah"
                    value={profileData.firstName}
                    onChange={(e) => setProfileData({ ...profileData, firstName: e.target.value })}
                    required
                  />
                  <Input
                    label="Last Name"
                    placeholder="e.g. Jenkins"
                    value={profileData.lastName}
                    onChange={(e) => setProfileData({ ...profileData, lastName: e.target.value })}
                  />
                </div>

                {/* Phone & NIC inputs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="w-full space-y-1">
                    <label className="text-sm font-medium text-gray-700 block">
                      Phone Number
                    </label>
                    <div className="relative">
                      <input
                        type="tel"
                        maxLength={10}
                        placeholder="0712345678"
                        value={profileData.phoneNumber}
                        onChange={(e) => setProfileData({ ...profileData, phoneNumber: e.target.value })}
                        className="flex h-11 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 pl-9 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                      />
                      <Phone className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                    <p className="text-[11px] text-gray-400">10 digits (e.g. 0712345678)</p>
                  </div>

                  <div className="w-full space-y-1">
                    <label className="text-sm font-medium text-gray-700 block">
                      NIC Number
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        maxLength={12}
                        placeholder="123456789V or 2000..."
                        value={profileData.nicNumber}
                        onChange={(e) => setProfileData({ ...profileData, nicNumber: e.target.value.toUpperCase() })}
                        className="flex h-11 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 pl-9 text-sm text-gray-900 uppercase placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                      />
                      <CreditCard className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                    <p className="text-[11px] text-gray-400">12 digits or 9 digits + 'V'</p>
                  </div>
                </div>

                <div className="w-full space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-gray-700 block">
                      Email Address
                    </label>
                    <span className="text-xs text-gray-400 font-normal">Cannot be changed</span>
                  </div>
                  <div className="relative">
                    <input
                      type="email"
                      disabled
                      value={profileData.email}
                      className="flex h-11 w-full rounded-lg border border-gray-200 bg-gray-100/90 px-3 py-2 pr-9 text-sm text-gray-500 cursor-not-allowed font-medium select-none"
                    />
                    <Lock className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Your login email is permanently linked to your account for security.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                  <div className="w-full space-y-1">
                    <label className="text-sm font-medium text-gray-700 mb-1 block">
                      Account Type
                    </label>
                    <input
                      type="text"
                      disabled
                      value={profileData.role || 'PropertyOwner'}
                      className="flex h-11 w-full rounded-lg border border-gray-200 bg-gray-100/80 px-3 py-2 text-sm text-gray-500 cursor-not-allowed font-medium"
                    />
                  </div>

                  <div className="w-full space-y-1">
                    <label className="text-sm font-medium text-gray-700 mb-1 block">
                      Account Status
                    </label>
                    <div className="flex h-11 items-center px-3 rounded-lg border border-emerald-200 bg-emerald-50/50 text-emerald-700 text-sm font-semibold">
                      Active & Verified
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
                  <p className="text-xs text-gray-400">
                    Changes will reflect immediately across your rental listings.
                  </p>
                  <Button 
                    type="submit" 
                    isLoading={isSavingProfile}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20 px-6 font-semibold"
                  >
                    Save Changes
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Security & Change Password */}
        <div className="lg:col-span-5 space-y-6">
          <Card className="border border-slate-200/80 shadow-sm bg-white rounded-2xl overflow-hidden">
            <CardHeader className="border-b border-gray-100 bg-gray-50/50 pb-5">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <KeyRound className="w-5 h-5 text-indigo-600" />
                    Change Password
                  </CardTitle>
                  <p className="text-sm text-gray-500 mt-1">
                    Keep your account secure with a strong password.
                  </p>
                </div>
                <Lock className="w-4 h-4 text-gray-400" />
              </div>
            </CardHeader>

            <CardContent className="p-6">
              {passwordSuccessMsg && (
                <div className="mb-5 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center gap-3 text-sm animate-in fade-in">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <span>{passwordSuccessMsg}</span>
                </div>
              )}

              {passwordErrorMsg && (
                <div className="mb-5 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-3 text-sm animate-in fade-in">
                  <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
                  <span>{passwordErrorMsg}</span>
                </div>
              )}

              <form onSubmit={handlePasswordSubmit} className="space-y-4">
                {/* Current Password */}
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700 block">
                    Current Password
                  </label>
                  <div className="relative">
                    <input
                      type={showCurrentPassword ? 'text' : 'password'}
                      placeholder="Enter your current password"
                      value={passwordData.currentPassword}
                      onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                      required
                      className="flex h-11 w-full rounded-lg border border-gray-200/80 bg-white px-3 py-2 pr-10 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                      tabIndex={-1}
                    >
                      {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* New Password */}
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700 block">
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      placeholder="Min. 6 characters"
                      value={passwordData.newPassword}
                      onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                      required
                      className="flex h-11 w-full rounded-lg border border-gray-200/80 bg-white px-3 py-2 pr-10 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                      tabIndex={-1}
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Confirm New Password */}
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700 block">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      placeholder="Re-enter new password"
                      value={passwordData.confirmPassword}
                      onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                      required
                      className="flex h-11 w-full rounded-lg border border-gray-200/80 bg-white px-3 py-2 pr-10 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                      tabIndex={-1}
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {passwordData.confirmPassword && passwordData.newPassword !== passwordData.confirmPassword && (
                    <p className="text-xs text-rose-500 mt-1 font-medium">Passwords do not match.</p>
                  )}
                </div>

                <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-500 border border-slate-100 flex items-start gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                  <span>Choose a secure password with at least 6 characters. Use letters, numbers, and symbols for better protection.</span>
                </div>

                <div className="pt-2">
                  <Button 
                    type="submit" 
                    isLoading={isChangingPassword}
                    className="w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold py-2.5 shadow-md shadow-slate-900/10"
                  >
                    Update Password
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

