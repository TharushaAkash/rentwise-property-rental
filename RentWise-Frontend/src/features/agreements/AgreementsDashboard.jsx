import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFetch } from '../../hooks/useFetch';
import { useMutation } from '../../hooks/useMutation';

import { DataTable } from '../../components/ui/DataTable';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { AgreementForm } from './AgreementForm';
import { Plus } from 'lucide-react';

export const AgreementsDashboard = () => {
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { data: agreements, isLoading, error, refetch } = useFetch('/agreements');
  const { mutateAsync: createAgreement, isLoading: isCreating } = useMutation('/agreements', 'POST');

  const handleCreate = async (data) => {
    try {
      await createAgreement(data);
      setIsModalOpen(false);
      refetch();
    } catch (err) {
      console.error('Failed to create agreement', err);
    }
  };

  const columns = [
  { header: 'Property ID', accessor: (a) => <span className="font-mono text-xs">{a.propertyId.substring(0, 8)}...</span> },
  { header: 'Tenant ID', accessor: (a) => <span className="font-mono text-xs">{a.tenantId.substring(0, 8)}...</span> },
  { header: 'Rent', accessor: (a) => <span className="font-medium text-emerald-600">${a.monthlyRent}/mo</span> },
  { header: 'Ends On', accessor: (a) => new Date(a.endDate).toLocaleDateString() },
  {
    header: 'Status',
    accessor: (a) => {
      const variants = { Active: 'success', Pending: 'warning', Terminated: 'danger' };
      return <Badge variant={variants[a.status]}>{a.status}</Badge>;
    }
  }];


  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-gray-900">Rental Agreements</h2>
          <p className="text-gray-500 mt-1">Manage leases, contracts, and tenant payments.</p>
        </div>
        <Button onClick={() => setIsModalOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Agreement
        </Button>
      </div>

      {error &&
      <div className="p-4 bg-rose-50 text-rose-600 rounded-lg border border-rose-100">
          Failed to load agreements: {error}
        </div>
      }

      <DataTable
        data={agreements}
        columns={columns}
        isLoading={isLoading}
        onRowClick={(a) => navigate(`/agreements/${a.id}`)} />
      

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Create Rental Agreement">
        <AgreementForm onSubmit={handleCreate} isLoading={isCreating} />
      </Modal>
    </div>);

};