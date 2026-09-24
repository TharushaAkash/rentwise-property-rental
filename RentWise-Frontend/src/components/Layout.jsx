import React, { useMemo, useState, useRef, useEffect } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { Home, Users, FileText, Wrench, LogOut, Building2, User, Star, HelpCircle, ChevronDown, Heart, Search } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

export const Layout = () => {
  const { logout, user } = useAuth();
  const location = useLocation();
  const isTenant = user?.role === 'Tenant' || !user;

  // Live counter for saved wishlist items
  const [savedCount, setSavedCount] = useState(0);

  useEffect(() => {
    const updateSavedCount = () => {
      try {
        const stored = JSON.parse(localStorage.getItem('rentwise_saved_properties') || '[]');
        setSavedCount(Array.isArray(stored) ? stored.length : 0);
        const realItems = Array.isArray(stored)
          ? stored.filter((p) => {
              const id = typeof p === 'string' ? p : p?.id;
              return id && !id.toString().startsWith('sample-');
            })
          : [];
        setSavedCount(realItems.length);
      } catch {
        setSavedCount(0);
      }
    };
    updateSavedCount();
    window.addEventListener('rentwise_saved_updated', updateSavedCount);
    window.addEventListener('storage', updateSavedCount);
    return () => {
      window.removeEventListener('rentwise_saved_updated', updateSavedCount);
      window.removeEventListener('storage', updateSavedCount);
    };
  }, []);

  // State for My Profile expandable dropdown menu
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const profileDropdownRef = useRef(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target)) {
        setIsProfileDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Auto-close on route change
  useEffect(() => {
    setIsProfileDropdownOpen(false);
  }, [location.pathname, location.search]);

  const navItems = useMemo(() => {
    const role = user?.role;
    if (role === 'Tenant' || !role) {
      return [
        { name: 'Properties', path: '/properties', icon: <Home className="w-5 h-5" /> },
        { name: 'Find Rentals', path: '/find-rentals', icon: <Search className="w-5 h-5" /> },
        { name: 'Saved Items', path: '/saved-items', icon: <Heart className="w-5 h-5" /> },
        { name: 'My Profile', path: '/tenants', icon: <Users className="w-5 h-5" /> },
        { name: 'My Agreements', path: '/agreements', icon: <FileText className="w-5 h-5" /> },
        { name: 'Maintenance', path: '/maintenance', icon: <Wrench className="w-5 h-5" /> }
      ];
    } else if (role === 'PropertyOwner') {
      return [
        { name: 'My Properties', path: '/properties', icon: <Home className="w-5 h-5" /> },
        { name: 'My Profile', path: '/profile', icon: <User className="w-5 h-5" /> },
        { name: 'My Tenants', path: '/tenants', icon: <Users className="w-5 h-5" /> },
        { name: 'Agreements', path: '/agreements', icon: <FileText className="w-5 h-5" /> },
        { name: 'Maintenance', path: '/maintenance', icon: <Wrench className="w-5 h-5" /> }
      ];
    }
    // Administrator
    return [
      { name: 'Manage Properties', path: '/admin?tab=properties', icon: <Building2 className="w-5 h-5" /> },
      { name: 'Manage Users', path: '/admin?tab=users', icon: <Users className="w-5 h-5" /> },
      { name: 'Agreements Requests', path: '/admin?tab=agreements', icon: <FileText className="w-5 h-5" /> },
      { name: 'Manage Profile', path: '/admin?tab=profile', icon: <User className="w-5 h-5" /> }
    ];
  }, [user]);

  return (
    <div className={`${isTenant ? 'min-h-screen' : 'flex h-screen'} bg-white selection:bg-emerald-100 selection:text-emerald-900 font-sans`}>
      {/* LankaPropertyWeb Inspired Two-Tier Navigation Header for Tenant / User Pages */}
      {isTenant && (
        <header className="sticky top-0 z-40 shadow-sm">
          {/* Tier 1: Main White Bar */}
          <div className="bg-white border-b border-gray-200 px-4 sm:px-8 lg:px-12 py-2.5">
            <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4">
              
              {/* Brand Logo (LankaPropertyWeb style green circle + typography) */}
              <Link to={user ? "/properties" : "/"} className="flex items-center gap-2.5 group shrink-0">
                <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-[#008037] text-white shadow-sm group-hover:scale-105 transition-transform">
                  <Home className="w-5 h-5 stroke-[2.2]" />
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center text-xl sm:text-2xl font-black tracking-tight leading-none">
                    <span className="text-gray-900">Rent</span>
                    <span className="text-[#008037]">Wise</span>
                    <span className="text-xs sm:text-sm font-semibold text-gray-400 ml-1">PropertyWeb</span>
                  </div>
                </div>
              </Link>

              {/* Right Side Header Controls */}
              <div className="flex items-center gap-3 sm:gap-5 text-xs sm:text-sm">
                {user ? (
                  <>
                    {/* User / My Profile link */}
                    <Link
                      to="/tenants"
                      className="hidden md:flex items-center gap-1.5 font-medium text-gray-700 hover:text-[#008037] transition-colors"
                      title="View my profile"
                    >
                      <User className="w-3.5 h-3.5 text-gray-400" />
                      <span className="font-semibold text-xs sm:text-sm text-gray-700 max-w-[150px] truncate">
                        {user.fullName || user.email?.split('@')[0] || 'My Profile'}
                      </span>
                    </Link>

                    {/* Saved Items Quick Link */}
                    <Link
                      to="/saved-items"
                      className="hidden sm:flex items-center gap-1.5 font-medium text-gray-700 hover:text-[#008037] transition-colors text-xs sm:text-sm"
                      title="View saved wishlist properties"
                    >
                      <Heart className={`w-4 h-4 ${savedCount > 0 ? 'text-rose-500 fill-rose-500' : 'text-gray-400'}`} />
                      <span className="font-semibold text-gray-700">Saved</span>
                      {savedCount > 0 && (
                        <span className="px-1.5 py-0.2 bg-rose-500 text-white font-bold text-[10.5px] rounded-full">
                          {savedCount}
                        </span>
                      )}
                    </Link>

                    {/* Help / Support Link */}
                    <Link
                      to="/maintenance"
                      className="hidden sm:inline font-medium text-gray-600 hover:text-[#008037] transition-colors text-xs sm:text-sm"
                    >
                      Help
                    </Link>

                    {/* Post Your Ad (Bright Orange Button) */}
                  

                    {/* Sign out */}
                    <button
                      onClick={logout}
                      className="rounded border border-gray-200 px-2.5 py-1 text-xs font-semibold text-gray-600 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                      title="Sign out of account"
                    >
                      Sign out
                    </button>
                  </>
                ) : (
                  <>
                    <Link
                      to="/login"
                      className="px-4 py-1.5 rounded border border-gray-300 text-xs font-bold text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      Sign In
                    </Link>
                    <Link
                      to="/register"
                      className="px-4 py-1.5 rounded bg-[#008037] hover:bg-[#00662c] text-white text-xs font-bold shadow-xs transition-colors"
                    >
                      Register
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Tier 2: Solid Forest Green Ribbon Bar */}
          <div className="bg-[#008037] text-white px-4 sm:px-8 lg:px-12 shadow-sm">
            <div className="mx-auto flex max-w-[1440px] items-center justify-between overflow-x-auto no-scrollbar">
              <nav className="flex items-center gap-1 sm:gap-2 py-1.5 text-xs sm:text-[13.5px] font-semibold whitespace-nowrap">
                <Link
                  to="/properties"
                  className={`px-3 py-1 rounded transition-colors ${
                    location.pathname === '/properties' ? 'bg-[#006329] text-white font-bold' : 'text-white/95 hover:bg-[#006e2e]'
                  }`}
                >
                  Homes
                </Link>

                <Link
                  to="/find-rentals"
                  className={`px-3 py-1 rounded transition-colors ${
                    location.pathname.startsWith('/find-rentals') ? 'bg-[#006329] text-white font-bold' : 'text-white/95 hover:bg-[#006e2e]'
                  }`}
                >
                  Find Rentals
                </Link>

                <Link
                  to="/agreements"
                  className={`px-3 py-1 rounded transition-colors ${
                    location.pathname.startsWith('/agreements') ? 'bg-[#006329] text-white font-bold' : 'text-white/95 hover:bg-[#006e2e]'
                  }`}
                >
                  Rentals
                </Link>

                <Link
                  to="/tenants?tab=payments"
                  className="px-3 py-1 rounded transition-colors text-white/95 hover:bg-[#006e2e]"
                >
                  Payments
                </Link>

                <Link
                  to="/tenants?tab=maintenance"
                  className="px-3 py-1 rounded transition-colors text-white/95 hover:bg-[#006e2e]"
                >
                  Support
                </Link>

                <Link
                  to="/tenants?tab=bookings"
                  className="px-3 py-1 rounded transition-colors text-white/95 hover:bg-[#006e2e]"
                >
                  My Bookings
                </Link>
              </nav>

              {/* Right Side Saved Properties Indicator */}
              <div className="flex items-center gap-2 pl-3 py-1">
                <Link
                  to="/tenants"
                  className={`flex items-center gap-1.5 px-3 py-1 rounded transition-colors text-xs font-semibold ${
                    location.pathname.startsWith('/tenants') || location.pathname.startsWith('/profile')
                      ? 'bg-[#006329] text-white font-bold'
                      : 'text-white/95 hover:bg-[#006e2e]'
                  }`}
                >
                  <User className="w-4 h-4 opacity-90" />
                  <span className="hidden md:inline">My Profile</span>
                </Link>

                <Link
                  to="/saved-items"
                  title={`Saved Properties (${savedCount})`}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded hover:bg-[#006e2e] text-white transition-colors text-xs font-semibold"
                >
                  <Heart className={`w-4 h-4 ${savedCount > 0 ? 'fill-rose-300 text-rose-300' : 'text-white/80'}`} />
                  <span className="hidden md:inline">Saved</span>
                  {savedCount > 0 && (
                    <span className="px-1.5 py-0.2 bg-rose-500 text-white font-bold text-[10px] rounded-full leading-none">
                      {savedCount}
                    </span>
                  )}
                </Link>
              </div>
            </div>
          </div>
        </header>
      )}
      {/* Premium Sidebar */}
      {!isTenant && <aside className="w-[280px] bg-slate-950 text-slate-300 flex flex-col border-r border-slate-800 relative z-20">
        <div className="p-8 pb-4">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-[0_0_20px_rgb(99,102,241,0.3)]">
              <Building2 className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-bold tracking-tight text-white">
              RentWise
            </span>
          </div>
          <Link 
            to={['Administrator', 'Admin', 'SystemAdmin'].includes(user?.role) ? "/admin?tab=profile" : "/profile"} 
            title="Click to view/edit profile" 
            className="block px-3 py-2.5 rounded-lg bg-slate-900/70 border border-slate-800/80 mb-2 hover:border-indigo-500/50 hover:bg-slate-900 transition-all duration-200 group"
          >
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Logged in as</p>
              <span className="text-[10px] text-indigo-400 opacity-70 group-hover:opacity-100 transition-opacity">Edit &rarr;</span>
            </div>
            <p className="text-sm font-medium text-slate-200 truncate">{user?.fullName || user?.email}</p>
            {user?.fullName && <p className="text-xs text-slate-400 truncate">{user?.email}</p>}
            <div className="mt-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              {user?.role}
            </div>
          </Link>
        </div>

        <nav className="flex-1 px-4 mt-6 space-y-1.5 overflow-y-auto">
          {navItems.map((item) => {
            let isActive = false;
            if (item.path.includes('?')) {
              const currentTab = new URLSearchParams(location.search).get('tab') || 'properties';
              const targetTab = new URLSearchParams(item.path.split('?')[1]).get('tab');
              isActive = location.pathname === '/admin' && currentTab === targetTab;
            } else {
              isActive = location.pathname.startsWith(item.path);
            }

            return (
              <Link
                key={item.name}
                to={item.path}
                className={`flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                  isActive 
                    ? 'bg-indigo-600 text-white shadow-[0_4px_20px_rgb(79,70,229,0.3)]' 
                    : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                }`}
              >
                {item.icon}
                <span className="font-medium">{item.name}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-800/50">
          <button
            onClick={logout}
            className="flex items-center space-x-3 px-4 py-3 text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 rounded-xl w-full transition-all duration-200 font-medium"
          >
            <LogOut className="w-5 h-5" />
            <span>Sign out</span>
          </button>
        </div>
      </aside>}

      {/* Main Content Area */}
      <main className={`${isTenant ? '' : 'flex-1 overflow-y-auto relative'}`}>
        {/* Subtle background gradient for depth */}
        <div className="absolute top-0 inset-x-0 h-[300px] bg-gradient-to-b from-slate-50 to-[#FDFDFD] pointer-events-none" />
        <div className={`${isTenant ? 'mx-auto max-w-[1440px] px-4 py-0 sm:px-8 lg:px-12' : 'p-8 sm:p-10 lg:p-12 max-w-7xl mx-auto'} relative z-10 animate-in fade-in slide-in-from-bottom-4 duration-500`}>
          <Outlet />
        </div>
      </main>
    </div>
  );
};
