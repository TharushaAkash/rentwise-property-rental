import { PageLoading } from '../components/PageLoading';
import React, { lazy, Suspense } from 'react';
import { RouteErrorBoundary } from '../components/RouteErrorBoundary';
import { RouteMessage } from '../components/RouteMessage';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { ProtectedRoute } from './ProtectedRoute';
import { Layout } from '../components/Layout';
const Landing = lazy(() => import('../features/landing/Landing').then(module => ({ default: module.Landing })));
const Login = lazy(() => import('../features/auth/Login').then(module => ({ default: module.Login })));
const ForgotPassword = lazy(() => import('../features/auth/ForgotPassword').then(module => ({ default: module.ForgotPassword })));
const Register = lazy(() => import('../features/auth/Register').then(module => ({ default: module.Register })));
const PropertiesDashboard = lazy(() => import('../features/properties/PropertiesDashboard').then(module => ({ default: module.PropertiesDashboard })));
const PropertyDetails = lazy(() => import('../features/properties/PropertyDetails').then(module => ({ default: module.PropertyDetails })));
const TenantsDashboard = lazy(() => import('../features/tenants/TenantsDashboard').then(module => ({ default: module.TenantsDashboard })));
const TenantDetails = lazy(() => import('../features/tenants/TenantDetails').then(module => ({ default: module.TenantDetails })));
const AgreementsDashboard = lazy(() => import('../features/agreements/AgreementsDashboard').then(module => ({ default: module.AgreementsDashboard })));
const AgreementDetails = lazy(() => import('../features/agreements/AgreementDetails').then(module => ({ default: module.AgreementDetails })));
const MaintenanceDashboard = lazy(() => import('../features/maintenance/MaintenanceDashboard').then(module => ({ default: module.MaintenanceDashboard })));
const RequestDetails = lazy(() => import('../features/maintenance/RequestDetails').then(module => ({ default: module.RequestDetails })));
const TenantPropertyPortal = lazy(() => import('../features/tenants/TenantPropertyPortal').then(module => ({ default: module.TenantPropertyPortal })));
const TenantProfilePortal = lazy(() => import('../features/tenants/TenantProfilePortal').then(module => ({ default: module.TenantProfilePortal })));
const OwnerProfileSection = lazy(() => import('../features/properties/OwnerProfileSection').then(module => ({ default: module.OwnerProfileSection })));
const AdminDashboard = lazy(() => import('../features/admin/AdminDashboard').then(module => ({ default: module.AdminDashboard })));
const FindRentals = lazy(() => import('../features/rentals/FindRentals').then(module => ({ default: module.FindRentals })));
const SavedItems = lazy(() => import('../features/rentals/SavedItems').then(module => ({ default: module.SavedItems })));
const RentalWorkflows = lazy(() => import('../features/workflows/RentalWorkflows').then(module => ({ default: module.RentalWorkflows })));

const RoleRoute = ({ tenant, other, admin }) => {
  const { user } = useAuth();
  const isAdmin = ['Administrator', 'Admin', 'SystemAdmin'].includes(user?.role);
  if (isAdmin && admin) return admin;
  return user?.role === 'Tenant' ? tenant : other;
};

// Component to handle role-based default redirect
const RoleBasedRedirect = () => {
  const { user, isLoading } = useAuth();
  if (isLoading) return <div className="flex h-screen items-center justify-center">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  
  if (user.role === 'Administrator' || user.role === 'Admin' || user.role === 'SystemAdmin') {
    return <Navigate to="/admin" replace />; // Admins direct to Admin Command Center
  }
  if (user.role === 'Tenant') return <Navigate to="/properties" replace />; // Tenants search properties
  if (user.role === 'PropertyOwner') return <Navigate to="/properties" replace />; // Owners manage properties
  return <Navigate to="/properties" replace />;
};

export const AppRouter = () => {
  const location = useLocation();
  return (
    <RouteErrorBoundary resetKey={location.pathname}>
    <Suspense fallback={<PageLoading fullPage />}>
    <Routes>
      {/* Public Routes */}
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/register" element={<Register />} />
      
      {/* Routes wrapped in Dashboard / Portal Layout */}
      <Route element={<Layout />}>
        {/* Detail page accessible to both public visitors and authenticated users */}
        <Route path="/properties/:id" element={<PropertyDetails />} />
        <Route path="/find-rentals" element={<FindRentals />} />
        <Route path="/saved-items" element={<SavedItems />} />

        {/* Protected Dashboard Routes */}
        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<RoleBasedRedirect />} />
          <Route path="/rental-workflows" element={<RentalWorkflows />} />
          <Route path="/admin" element={<ProtectedRoute roles={['Administrator', 'Admin', 'SystemAdmin']}><AdminDashboard /></ProtectedRoute>} />
          <Route path="/properties" element={<RoleRoute tenant={<TenantPropertyPortal />} other={<PropertiesDashboard />} admin={<Navigate to="/admin?tab=properties" replace />} />} />
          <Route path="/profile" element={<RoleRoute tenant={<TenantProfilePortal />} other={<OwnerProfileSection />} />} />
          <Route path="/tenants" element={<RoleRoute tenant={<TenantProfilePortal />} other={<TenantsDashboard />} />} />
          <Route path="/tenants/:id" element={<TenantDetails />} />
          <Route path="/agreements" element={<AgreementsDashboard />} />
          <Route path="/agreements/:id" element={<AgreementDetails />} />
          <Route path="/maintenance" element={<MaintenanceDashboard />} />
          <Route path="/maintenance/:id" element={<RequestDetails />} />
        </Route>
      </Route>
      
      {/* Fallback */}
      <Route path="*" element={<RouteMessage title="Page not found" message="Check the address or return to the home page." />} />
    </Routes>
    </Suspense>
    </RouteErrorBoundary>
  );
};
