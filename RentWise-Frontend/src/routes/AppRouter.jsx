import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Layout } from '../components/Layout';
import { Landing } from '../features/landing/Landing';
import { Login } from '../features/auth/Login';
import { Register } from '../features/auth/Register';
import { PropertiesDashboard } from '../features/properties/PropertiesDashboard';
import { PropertyDetails } from '../features/properties/PropertyDetails';
import { TenantsDashboard } from '../features/tenants/TenantsDashboard';
import { TenantDetails } from '../features/tenants/TenantDetails';
import { AgreementsDashboard } from '../features/agreements/AgreementsDashboard';
import { AgreementDetails } from '../features/agreements/AgreementDetails';
import { MaintenanceDashboard } from '../features/maintenance/MaintenanceDashboard';
import { RequestDetails } from '../features/maintenance/RequestDetails';
import { TenantPropertyPortal, TenantProfilePortal } from '../features/tenants/TenantPortal';
import { OwnerProfileSection } from '../features/properties/OwnerProfileSection';

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <div className="flex h-screen items-center justify-center">Loading...</div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

const RoleRoute = ({ tenant, other }) => {
  const { user } = useAuth();
  return user?.role === 'Tenant' ? tenant : other;
};

// Component to handle role-based default redirect
const RoleBasedRedirect = () => {
  const { user, isLoading } = useAuth();
  if (isLoading) return <div className="flex h-screen items-center justify-center">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  
  if (user.role === 'Tenant') return <Navigate to="/properties" replace />; // Tenants search properties
  if (user.role === 'PropertyOwner') return <Navigate to="/properties" replace />; // Owners manage properties
  return <Navigate to="/tenants" replace />; // Admins
};

export const AppRouter = () => {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      
      {/* Protected Routes wrapped in Dashboard Layout */}
      <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route path="/dashboard" element={<RoleBasedRedirect />} />
        <Route path="/properties" element={<RoleRoute tenant={<TenantPropertyPortal />} other={<PropertiesDashboard />} />} />
        <Route path="/properties/:id" element={<PropertyDetails />} />
        <Route path="/profile" element={<RoleRoute tenant={<TenantProfilePortal />} other={<OwnerProfileSection />} />} />
        <Route path="/tenants" element={<RoleRoute tenant={<TenantProfilePortal />} other={<TenantsDashboard />} />} />
        <Route path="/tenants/:id" element={<TenantDetails />} />
        <Route path="/agreements" element={<AgreementsDashboard />} />
        <Route path="/agreements/:id" element={<AgreementDetails />} />
        <Route path="/maintenance" element={<MaintenanceDashboard />} />
        <Route path="/maintenance/:id" element={<RequestDetails />} />
      </Route>
      
      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};
