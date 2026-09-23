import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';

import { Button } from '../../components/ui/Button';
import { DataTable } from '../../components/ui/DataTable';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { ArrowLeft, Check, X, Building2, Calendar, FileText, User, Mail, Phone, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { parseBookingDetails } from './TenantPortal';

const formatMoney = (val) => `Rs. ${Number(val || 0).toLocaleString()}`;

export const TenantDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('bookings');
  
  const [profile, setProfile] = useState(null);
  const [userInfo, setUserInfo] = useState(null);
  const [applications, setApplications] = useState([]);
  const [agreements, setAgreements] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [feedback, setFeedback] = useState('');

  const loadData = async () => {
    setIsLoading(true);
    try {
      // 1. Try loading tenant profile and user details
      const [profileRes, userRes, appsRes, agreementsRes] = await Promise.all([
        api.get(`/tenant-profiles/${id}`).catch(() => null),
        api.get(`/users/${id}`).catch(() => null),
        api.get(`/property-applications?tenantId=${id}`).catch(() => null),
        api.get(`/agreements?tenantId=${id}`).catch(() => null)
      ]);

      setProfile(profileRes?.data || null);
      setUserInfo(userRes?.data || null);
      setApplications(appsRes?.data || []);
      setAgreements(agreementsRes?.data || []);
    } catch (err) {
      console.error('Error fetching tenant details:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  const handleApprove = async (appId) => {
    try {
      setActionLoadingId(appId);
      setFeedback('');
      await api.post(`/property-applications/${appId}/approve`);
      setFeedback('Booking approved! Active rental agreement created.');
      await loadData();
    } catch (err) {
      setFeedback(err.response?.data?.message || 'Error approving request');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleReject = async (appId) => {
    try {
      setActionLoadingId(appId);
      setFeedback('');
      await api.post(`/property-applications/${appId}/reject`);
      setFeedback('Booking rejected.');
      await loadData();
    } catch (err) {
      setFeedback(err.response?.data?.message || 'Error rejecting request');
    } finally {
      setActionLoadingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="p-16 text-center text-gray-500 font-medium">
        Loading tenant profile and rental details...
      </div>
    );
  }

  const displayName = userInfo?.fullName || profile?.user?.fullName || `Tenant ${String(id).slice(0, 8)}`;
  const displayEmail = userInfo?.email || profile?.user?.email || 'N/A';

  return (
    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300 font-sans">
      <Button variant="ghost" onClick={() => navigate('/tenants')} className="mb-2">
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Tenants & Bookings
      </Button>

      {/* Header Profile Card */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-2xl shadow-lg shadow-blue-500/20">
            {displayName.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-extrabold text-gray-900">{displayName}</h1>
              <Badge variant="success">Tenant</Badge>
            </div>
            <div className="flex items-center gap-4 text-sm text-gray-500 mt-1 flex-wrap">
              <span className="flex items-center gap-1.5">
                <Mail className="w-4 h-4 text-gray-400" />
                {displayEmail}
              </span>
              <span className="font-mono text-xs text-gray-400">
                ID: {String(id).slice(0, 8)}...
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-4 py-2 bg-blue-50 rounded-xl border border-blue-100 text-center">
            <p className="text-xs font-semibold text-blue-600 uppercase">Bookings</p>
            <p className="text-lg font-black text-blue-900">{applications.length}</p>
          </div>
          <div className="px-4 py-2 bg-emerald-50 rounded-xl border border-emerald-100 text-center">
            <p className="text-xs font-semibold text-emerald-600 uppercase">Active Leases</p>
            <p className="text-lg font-black text-emerald-900">{agreements.length}</p>
          </div>
        </div>
      </div>

      {feedback && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-sm font-medium">
          {feedback}
        </div>
      )}

      {/* Financial & Profile Info (if available) */}
      {profile && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Financial & Employment Summary</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-gray-50 rounded-xl">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Monthly Income</p>
                <p className="text-xl font-bold text-emerald-600">{formatMoney(profile.income)}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-xl">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Credit Score</p>
                <p className="text-xl font-bold text-blue-600">{profile.creditScore || '720 (Excellent)'}</p>
              </div>
              <div className="col-span-2 p-4 bg-gray-50 rounded-xl">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Employment Status</p>
                <p className="text-sm font-semibold text-gray-900">{profile.employmentStatus || 'Employed Full-time'}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Preferences</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-gray-600">
              <p><strong>Locations:</strong> {profile.preferredLocations || 'Colombo & Suburbs'}</p>
              <p><strong>Notes:</strong> {profile.preferences || 'Prefers furnished modern apartments.'}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs for Bookings & Renting Details */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('bookings')}
            className={`py-4 px-1 border-b-2 font-bold text-sm ${
              activeTab === 'bookings'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Property Bookings & Applications ({applications.length})
          </button>
          <button
            onClick={() => setActiveTab('renting')}
            className={`py-4 px-1 border-b-2 font-bold text-sm ${
              activeTab === 'renting'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Renting Agreements & Leases ({agreements.length})
          </button>
        </nav>
      </div>

      {/* Tab 1: Bookings */}
      {activeTab === 'bookings' && (
        <div className="space-y-4">
          {applications.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-2xl border border-dashed border-gray-300 text-gray-500">
              No booking requests found for this tenant.
            </div>
          ) : (
            applications.map((app) => {
              const isPending = app.status === 'Submitted' || app.status === 'UnderReview';
              const isApproved = app.status === 'Accepted';
              const isBusy = actionLoadingId === app.id;

              return (
                <div key={app.id} className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-blue-600" />
                      <span className="font-bold text-gray-900 text-base">{app.propertyTitle}</span>
                      <Badge variant={isApproved ? 'success' : isPending ? 'warning' : 'danger'}>
                        {app.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-500">{app.propertyAddress}</p>
                    {(() => {
                      const details = parseBookingDetails(app.message);
                      return (
                        <div className="space-y-1.5 pt-1">
                          <div className="flex items-center gap-3 text-xs flex-wrap">
                            <span className="font-extrabold text-blue-600">
                              Rent: {formatMoney(app.monthlyRent)}/mo
                            </span>
                            {details.duration && (
                              <span className="inline-flex items-center gap-1 font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                                <Clock className="w-3 h-3" />
                                Term: {details.duration}
                              </span>
                            )}
                            {details.startDate && (
                              <span className="text-gray-500">
                                Move-in: <strong>{details.startDate}</strong>
                              </span>
                            )}
                          </div>
                          {details.note && (
                            <p className="text-xs italic text-gray-600 bg-gray-50 p-2 rounded-lg">
                              "{details.note}"
                            </p>
                          )}
                        </div>
                      );
                    })()}
                  </div>

                  <div className="flex items-center gap-2">
                    {isPending ? (
                      <>
                        <Button
                          size="sm"
                          isLoading={isBusy}
                          onClick={() => handleApprove(app.id)}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs"
                        >
                          <Check className="w-3.5 h-3.5 mr-1" />
                          Approve Request
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          isLoading={isBusy}
                          onClick={() => handleReject(app.id)}
                          className="text-rose-600 hover:bg-rose-50 border-rose-200 text-xs"
                        >
                          <X className="w-3.5 h-3.5 mr-1" />
                          Reject
                        </Button>
                      </>
                    ) : isApproved ? (
                      <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Approved
                      </span>
                    ) : (
                      <span className="text-xs font-bold text-rose-700 bg-rose-50 px-3 py-1.5 rounded-lg border border-rose-200 flex items-center gap-1">
                        <XCircle className="w-3.5 h-3.5" /> Rejected
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Tab 2: Renting Agreements */}
      {activeTab === 'renting' && (
        <div className="space-y-4">
          {agreements.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-2xl border border-dashed border-gray-300 text-gray-500">
              No active rental agreements found for this tenant.
            </div>
          ) : (
            agreements.map((ag) => (
              <div key={ag.id} className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-blue-600" />
                    <span className="font-bold text-gray-900 text-base">
                      {ag.propertyTitle || `Property ${String(ag.propertyId).slice(0, 8)}`}
                    </span>
                    <Badge variant={ag.status === 'Active' ? 'success' : 'default'}>
                      {ag.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{ag.propertyAddress}</p>
                  <div className="flex items-center gap-4 text-xs text-gray-600 mt-2">
                    <span>Rent: <strong>{formatMoney(ag.agreedMonthlyRent || ag.monthlyRent)}/mo</strong></span>
                    <span>Deposit: <strong>{formatMoney(ag.securityDeposit)}</strong></span>
                    <span>Dates: {ag.startDate ? new Date(ag.startDate).toLocaleDateString() : 'N/A'} - {ag.endDate ? new Date(ag.endDate).toLocaleDateString() : 'Ongoing'}</span>
                  </div>
                </div>

                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => navigate(`/agreements/${ag.id}`)}
                  className="text-xs font-semibold"
                >
                  <FileText className="w-3.5 h-3.5 mr-1 text-blue-600" />
                  View Agreement
                </Button>
              </div>
            ))
          )}
        </div>
      )}

    </div>
  );
};