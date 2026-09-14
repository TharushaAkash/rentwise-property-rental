import React, { useMemo } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { Home, Users, FileText, Wrench, LogOut, Building2, User } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

export const Layout = () => {
  const { logout, user } = useAuth();
  const location = useLocation();
  const isTenant = user?.role === 'Tenant';

  const navItems = useMemo(() => {
    const role = user?.role;
    if (role === 'Tenant') {
      return [
        { name: 'Properties', path: '/properties', icon: <Home className="w-5 h-5" /> },
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
      { name: 'All Properties', path: '/properties', icon: <Home className="w-5 h-5" /> },
      { name: 'My Profile', path: '/profile', icon: <User className="w-5 h-5" /> },
      { name: 'All Users', path: '/tenants', icon: <Users className="w-5 h-5" /> },
      { name: 'Agreements', path: '/agreements', icon: <FileText className="w-5 h-5" /> },
      { name: 'Maintenance', path: '/maintenance', icon: <Wrench className="w-5 h-5" /> }
    ];
  }, [user]);

  return (
    <div className={`${isTenant ? 'min-h-screen' : 'flex h-screen'} bg-white selection:bg-orange-100 selection:text-indigo-900 font-sans`}>
      {isTenant && <header className="sticky top-0 z-30 border-b border-gray-100 bg-white/95 px-6 py-4 backdrop-blur md:px-12"><div className="mx-auto flex max-w-[1440px] items-center justify-between"><Link to="/properties" className="flex items-center gap-2"><div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#26356f] text-lg font-black text-white">R</div><span className="text-xl font-extrabold tracking-tight text-[#26356f]">RENT<span className="text-[#f47721]">WISE</span></span></Link><nav className="hidden items-center gap-8 text-sm font-semibold uppercase tracking-wider text-gray-700 lg:flex"><Link to="/properties" className="hover:text-[#f47721]">Homes</Link><Link to="/tenants" className="hover:text-[#f47721]">My profile</Link><Link to="/agreements" className="hover:text-[#f47721]">Rentals</Link><Link to="/maintenance" className="hover:text-[#f47721]">Support</Link></nav><div className="flex items-center gap-3"><span className="hidden text-sm text-gray-500 sm:inline">{user?.email}</span><button onClick={logout} className="rounded-full bg-[#26356f] px-4 py-2 text-sm font-bold text-white hover:bg-[#1e2b5b]">Sign out</button></div></div></header>}
      {isTenant && <header className="sticky top-0 z-30 border-b border-gray-100 bg-white/95 px-6 py-4 backdrop-blur md:px-12"><div className="mx-auto flex max-w-[1440px] items-center justify-between"><Link to="/properties" className="flex items-center gap-2"><div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#26356f] text-lg font-black text-white">R</div><span className="text-xl font-extrabold tracking-tight text-[#26356f]">RENT<span className="text-[#f47721]">WISE</span></span></Link><nav className="hidden items-center gap-8 text-sm font-semibold uppercase tracking-wider text-gray-700 lg:flex"><Link to="/properties" className="hover:text-[#f47721]">Homes</Link><Link to="/tenants" className="hover:text-[#f47721]">My profile</Link><Link to="/agreements" className="hover:text-[#f47721]">Rentals</Link><Link to="/tenants#payments-section" className="hover:text-[#f47721]">Payments</Link><Link to="/maintenance" className="hover:text-[#f47721]">Support</Link></nav><div className="flex items-center gap-3"><span className="hidden text-sm text-gray-500 sm:inline">{user?.email}</span><button onClick={logout} className="rounded-full bg-[#26356f] px-4 py-2 text-sm font-bold text-white hover:bg-[#1e2b5b]">Sign out</button></div></div></header>}
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
          <Link to="/profile" title="Click to view/edit profile" className="block px-3 py-2.5 rounded-lg bg-slate-900/70 border border-slate-800/80 mb-2 hover:border-indigo-500/50 hover:bg-slate-900 transition-all duration-200 group">
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
            const isActive = location.pathname.startsWith(item.path);
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
