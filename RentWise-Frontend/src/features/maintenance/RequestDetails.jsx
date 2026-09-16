import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useFetch } from '../../hooks/useFetch';
import api from '../../services/api';

import { Button } from '../../components/ui/Button';
import { DataTable } from '../../components/ui/DataTable';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { 
  ArrowLeft, 
  Clock, 
  Home, 
  MapPin, 
  Wrench, 
  CheckCircle2, 
  Image as ImageIcon,
  User,
  Sliders
} from 'lucide-react';

const MAINTENANCE_STATUSES = [
  { value: 'Reported', label: 'Reported', desc: 'Issue reported, awaiting review', variant: 'default' },
  { value: 'Assigned', label: 'Assigned', desc: 'Vendor or technician assigned', variant: 'warning' },
  { value: 'InProgress', label: 'InProgress', desc: 'Repair work is currently underway', variant: 'info' },
  { value: 'Completed', label: 'Completed', desc: 'Repairs completed and verified', variant: 'success' }
];

export const RequestDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState('InProgress');
  const [statusNotes, setStatusNotes] = useState('');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  const { data: request, isLoading, refetch } = useFetch(`/maintenance-requests/${id}`);
  const { data: logs, refetch: refetchLogs } = useFetch(`/maintenance-requests/${id}/logs`);

  const priorityVariants = { Emergency: 'danger', High: 'warning', Medium: 'default', Low: 'info' };
  const statusVariants = { 
    Completed: 'success', 
    InProgress: 'info', 
    Assigned: 'warning', 
    Reported: 'default' 
  };

  const handleOpenStatusModal = (initialStatus) => {
    setSelectedStatus(initialStatus || request?.status || 'InProgress');
    setStatusNotes('');
    setIsStatusModalOpen(true);
  };

  const handleUpdateStatus = async (e) => {
    e?.preventDefault();
    try {
      setIsUpdatingStatus(true);
      await api.put(`/maintenance-requests/${id}/status`, {
        status: selectedStatus,
        notes: statusNotes.trim() || `Status updated to ${selectedStatus}`
      });
      setIsStatusModalOpen(false);
      refetch();
      refetchLogs();
    } catch (err) {
      console.error('Failed to update maintenance status', err);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  if (isLoading) return <div className="p-12 text-center text-gray-500 font-medium">Loading request details...</div>;
  if (!request) return <div className="p-12 text-center text-rose-500 font-bold">Maintenance request not found</div>;

  const priority = request.aiPriority || request.priority || 'Medium';
  const status = request.status || 'Reported';
  const category = request.aiCategory || 'General';
  const description = request.description || request.issueDescription || 'No description provided.';
  const propertyTitle = request.property?.title || `Property #${String(request.propertyId).slice(0, 8)}`;
  const propertyAddress = request.property?.address;

  return (
    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300 max-w-5xl mx-auto pb-12 font-sans">
      <Button variant="ghost" onClick={() => navigate('/maintenance')} className="mb-2">
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Maintenance
      </Button>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-100">
              {category}
            </span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">
            Maintenance Ticket Details
          </h1>
          <p className="text-gray-500 text-xs font-mono mt-1">Ticket ID: {request.id}</p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <Badge variant={priorityVariants[priority] || 'default'} className="text-sm px-3.5 py-1 uppercase font-bold">
            {priority} Priority
          </Badge>

          <Badge variant={statusVariants[status] || 'default'} className="text-sm px-3.5 py-1 uppercase font-bold">
            {status}
          </Badge>

          {/* Update Status Button */}
          <Button 
            onClick={() => handleOpenStatusModal(status)} 
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold ml-2 shadow-sm"
          >
            <Sliders className="w-4 h-4 mr-1.5" />
            Update Status
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="md:col-span-2 space-y-6">
          {/* Issue Description Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Wrench className="w-5 h-5 text-blue-600" />
                <span>Reported Problem</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100 text-gray-800 text-sm leading-relaxed whitespace-pre-wrap">
                {description}
              </div>

              {/* Photo Evidence if available */}
              {request.photoUrl && (
                <div className="pt-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2 flex items-center gap-1.5">
                    <ImageIcon className="w-4 h-4 text-blue-600" />
                    <span>Photo Evidence</span>
                  </p>
                  <a href={request.photoUrl} target="_blank" rel="noreferrer" className="inline-block group">
                    <img 
                      src={request.photoUrl} 
                      alt="Damage preview" 
                      className="max-h-72 w-full object-cover rounded-2xl border border-gray-200 shadow-sm group-hover:opacity-95 transition-opacity"
                    />
                    <span className="text-[11px] text-blue-600 font-semibold mt-1 inline-block hover:underline">
                      View full resolution image &rarr;
                    </span>
                  </a>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Status Updates / Timeline */}
          <div className="bg-white rounded-2xl p-6 border border-gray-200/80 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-gray-900 flex items-center gap-2 text-base">
                <Clock className="w-4 h-4 text-blue-600" />
                <span>Status History</span>
              </h3>
              <Button size="sm" variant="outline" onClick={() => handleOpenStatusModal(status)}>
                + New Status Update
              </Button>
            </div>
            <DataTable
              columns={[
                { 
                  header: 'Transition', 
                  accessor: (l) => (
                    <div className="flex items-center gap-2">
                      <Badge variant={statusVariants[l.oldStatus] || 'default'} className="text-[11px]">
                        {l.oldStatus}
                      </Badge>
                      <span className="text-gray-400 font-bold">&rarr;</span>
                      <Badge variant={statusVariants[l.newStatus] || 'default'} className="text-[11px]">
                        {l.newStatus}
                      </Badge>
                    </div>
                  ) 
                },
                { header: 'Notes', accessor: (l) => l.notes || 'Status updated' },
                { header: 'Timestamp', accessor: (l) => new Date(l.updatedAt || l.createdAt).toLocaleString() }
              ]}
              data={logs || []}
              emptyMessage="Initial status: Reported. No transitions recorded yet."
            />
          </div>
        </div>

        {/* Sidebar: Property & Tenant Information */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Home className="w-4 h-4 text-blue-600" />
                <span>Property Information</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase">Property Title</p>
                <p className="text-sm font-bold text-gray-900 mt-0.5">{propertyTitle}</p>
              </div>

              {propertyAddress && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase">Address</p>
                  <p className="text-xs text-gray-600 flex items-start gap-1 mt-0.5">
                    <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5" />
                    <span>{propertyAddress}</span>
                  </p>
                </div>
              )}

              <div className="pt-2 border-t border-gray-100">
                <p className="text-xs font-semibold text-gray-400 uppercase">Property ID</p>
                <p className="font-mono text-xs text-gray-600 break-all">{request.propertyId}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <User className="w-4 h-4 text-blue-600" />
                <span>Tenant & Assignment</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase">Tenant ID</p>
                <p className="font-mono text-xs text-gray-600 break-all">{request.tenantId}</p>
              </div>

              {request.assignedServiceProviderId && (
                <div className="pt-2 border-t border-gray-100">
                  <p className="text-xs font-semibold text-gray-400 uppercase">Assigned Service Provider</p>
                  <p className="font-mono text-xs text-blue-600 break-all">{request.assignedServiceProviderId}</p>
                </div>
              )}

              <div className="pt-2 border-t border-gray-100 text-xs text-gray-500">
                <span>Submitted on: {new Date(request.createdAt).toLocaleString()}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ========================================================== */}
      {/* MODAL: UPDATE MAINTENANCE STATUS                          */}
      {/* ========================================================== */}
      <Modal 
        isOpen={isStatusModalOpen} 
        onClose={() => setIsStatusModalOpen(false)} 
        title="Update Maintenance Status"
        className="max-w-md"
      >
        <form onSubmit={handleUpdateStatus} className="space-y-5">
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-gray-600 block">
              Select New Status
            </label>
            <div className="grid grid-cols-1 gap-2.5">
              {MAINTENANCE_STATUSES.map((item) => {
                const isSelected = selectedStatus === item.value;
                return (
                  <div
                    key={item.value}
                    onClick={() => setSelectedStatus(item.value)}
                    className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-center justify-between ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50/70 ring-2 ring-blue-500/30'
                        : 'border-gray-200 bg-white hover:bg-gray-50'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge variant={item.variant} className="text-xs font-bold">
                          {item.label}
                        </Badge>
                        {isSelected && (
                          <span className="text-[11px] font-bold text-blue-600">Selected</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">{item.desc}</p>
                    </div>

                    <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                      isSelected ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-300'
                    }`}>
                      {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-gray-600 block">
              Transition Notes / Comments (Optional)
            </label>
            <textarea
              rows={3}
              value={statusNotes}
              onChange={(e) => setStatusNotes(e.target.value)}
              placeholder="e.g. Technician dispatched to site; plumbing parts ordered..."
              className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 shadow-sm"
            />
          </div>

          <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-2.5">
            <Button type="button" variant="outline" onClick={() => setIsStatusModalOpen(false)}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              isLoading={isUpdatingStatus}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-5"
            >
              <CheckCircle2 className="w-4 h-4 mr-1.5" />
              Save Status
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
