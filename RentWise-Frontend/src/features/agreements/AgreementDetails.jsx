import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useFetch } from '../../hooks/useFetch';

import { Button } from '../../components/ui/Button';
import { DataTable } from '../../components/ui/DataTable';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { ArrowLeft, CreditCard, Bell } from 'lucide-react';

export const AgreementDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('payments');

  const { data: agreement, isLoading } = useFetch(`/agreements/${id}`);
  const { data: payments } = useFetch(`/agreements/${id}/payments`);
  const { data: reminders } = useFetch(`/agreements/${id}/reminders`);

  if (isLoading) return <div className="p-8 text-center text-gray-500">Loading agreement...</div>;
  if (!agreement) return <div className="p-8 text-center text-rose-500">Agreement not found</div>;

  return (
    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
      <Button variant="ghost" onClick={() => navigate('/agreements')} className="mb-4">
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Agreements
      </Button>

      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-gray-900">Lease Details</h2>
          <p className="text-gray-500 mt-1 font-mono text-sm">Agreement ID: {agreement.id}</p>
        </div>
        <Badge variant={agreement.status === 'Active' ? 'success' : agreement.status === 'Pending' ? 'warning' : 'danger'} className="text-lg px-4 py-1">
          {agreement.status}
        </Badge>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <Card className="col-span-2">
          <CardHeader>
            <CardTitle>Financials & Terms</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-gray-50/50 rounded-xl border border-gray-100">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Monthly Rent</p>
                <p className="text-xl font-medium text-emerald-600">${agreement.monthlyRent}</p>
              </div>
              <div className="p-4 bg-gray-50/50 rounded-xl border border-gray-100">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Security Deposit</p>
                <p className="text-xl font-medium text-gray-900">${agreement.securityDeposit}</p>
              </div>
            </div>
            <div className="p-4 bg-gray-50/50 rounded-xl border border-gray-100">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Terms</p>
              <p className="text-sm text-gray-600">{agreement.terms}</p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Duration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Start Date</p>
              <p className="font-medium">{new Date(agreement.startDate).toLocaleDateString()}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">End Date</p>
              <p className="font-medium">{new Date(agreement.endDate).toLocaleDateString()}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {['payments', 'reminders'].map((tab) =>
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`${
            activeTab === tab ?
            'border-indigo-500 text-indigo-600' :
            'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm capitalize transition-colors flex items-center`
            }>
            
              {tab === 'payments' ? <CreditCard className="w-4 h-4 mr-2" /> : <Bell className="w-4 h-4 mr-2" />}
              {tab}
            </button>
          )}
        </nav>
      </div>

      <div className="bg-white/50 backdrop-blur-md rounded-2xl p-6 border border-white/20 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
        {activeTab === 'payments' &&
        <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold text-gray-800">Payment History</h3>
              <Button size="sm" variant="outline">Record Payment</Button>
            </div>
            <DataTable
            columns={[
            { header: 'Amount', accessor: (p) => <span className="font-medium text-emerald-600">${p.amount}</span> },
            { header: 'Date', accessor: (p) => new Date(p.paymentDate).toLocaleDateString() },
            { header: 'Method', accessor: 'paymentMethod' },
            { header: 'Status', accessor: (p) => <Badge variant={p.status === 'Completed' ? 'success' : 'warning'}>{p.status}</Badge> }]
            }
            data={payments || []} />
          
          </div>
        }

        {activeTab === 'reminders' &&
        <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold text-gray-800">Rent Reminders</h3>
              <Button size="sm" variant="outline">Schedule Reminder</Button>
            </div>
            <DataTable
            columns={[
            { header: 'Date', accessor: (r) => new Date(r.reminderDate).toLocaleDateString() },
            { header: 'Message', accessor: 'message' },
            { header: 'Status', accessor: (r) => r.isSent ? <Badge variant="success">Sent</Badge> : <Badge variant="default">Scheduled</Badge> }]
            }
            data={reminders || []} />
          
          </div>
        }
      </div>
    </div>);

};