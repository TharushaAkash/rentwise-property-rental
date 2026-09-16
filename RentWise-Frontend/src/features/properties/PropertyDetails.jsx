import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useFetch } from '../../hooks/useFetch';
import { useMutation } from '../../hooks/useMutation';
import { useAuth } from '../../hooks/useAuth';

import { Button } from '../../components/ui/Button';
import { DataTable } from '../../components/ui/DataTable';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { ArrowLeft, Plus, Calendar } from 'lucide-react';
import { BookingModal } from '../tenants/BookingModal';

export const PropertyDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('photos');
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);

  const { data: property, isLoading } = useFetch(`/properties/${id}`);
  const { data: photos } = useFetch(`/properties/${id}/photos`);
  const { data: documents } = useFetch(`/properties/${id}/documents`);
  const { data: verifications } = useFetch(`/properties/${id}/verifications`);

  const { mutateAsync: deleteProperty } = useMutation(`/properties/${id}`, 'DELETE');

  const handleDelete = async () => {
    if (confirm('Are you sure you want to delete this property?')) {
      await deleteProperty({});
      navigate('/properties');
    }
  };

  if (isLoading) return <div className="p-8 text-center text-gray-500">Loading property details...</div>;
  if (!property) return <div className="p-8 text-center text-rose-500">Property not found</div>;

  const isTenant = user?.role === 'Tenant';

  return (
    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
      <Button variant="ghost" onClick={() => navigate('/properties')} className="mb-4">
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Properties
      </Button>

      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-gray-900">{property.title}</h2>
          <p className="text-gray-500 mt-1">{property.address}</p>
        </div>
        <div className="space-x-3 flex items-center flex-wrap gap-2">
          {isTenant ? (
            <Button 
              onClick={() => setIsBookingModalOpen(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-2.5 shadow-md shadow-blue-500/20 text-sm"
            >
              <Calendar className="w-4 h-4 mr-2" />
              Book This Property
            </Button>
          ) : (
            <>
              <Button variant="outline">Edit</Button>
              <Button variant="danger" onClick={handleDelete}>Delete</Button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <Card className="col-span-2">
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-gray-600">
            <p>{property.description}</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-gray-50/50 rounded-xl border border-gray-100">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Monthly Rent</p>
                <p className="text-xl font-medium text-emerald-600">${property.monthlyRent}</p>
              </div>
              <div className="p-4 bg-gray-50/50 rounded-xl border border-gray-100">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Specs</p>
                <p className="text-xl font-medium text-gray-900">{property.bedrooms} Bed • {property.bathrooms} Bath</p>
              </div>
            </div>
            {property.facilities && (
              <div className="p-4 bg-gray-50/50 rounded-xl border border-gray-100">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Facilities</p>
                <p className="text-sm text-gray-600">{property.facilities}</p>
              </div>
            )}
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Status</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant="success" className="text-sm px-3 py-1">{property.status}</Badge>
            <div className="mt-6">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Square Feet</p>
              <p className="font-medium">{property.squareFeet} sqft</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {['photos', 'documents', 'verifications'].map((tab) =>
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`${
            activeTab === tab ?
            'border-indigo-500 text-indigo-600' :
            'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm capitalize transition-colors`
            }>
            
              {tab}
            </button>
          )}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="bg-white/50 backdrop-blur-md rounded-2xl p-6 border border-white/20">
        {activeTab === 'photos' &&
        <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold text-gray-800">Photos</h3>
              <Button size="sm" variant="outline"><Plus className="w-4 h-4 mr-2" /> Upload Photo</Button>
            </div>
            <DataTable
            columns={[
            { header: 'Image', accessor: (p) => <img src={p.photoUrl} className="h-10 w-10 object-cover rounded" alt="Property" /> },
            { header: 'Primary', accessor: (p) => p.isPrimary ? <Badge variant="info">Primary</Badge> : null }]
            }
            data={photos || []} />
          
          </div>
        }

        {activeTab === 'documents' &&
        <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold text-gray-800">Documents</h3>
              <Button size="sm" variant="outline"><Plus className="w-4 h-4 mr-2" /> Add Document</Button>
            </div>
            <DataTable
            columns={[
            { header: 'Type', accessor: 'documentType' },
            { header: 'Uploaded', accessor: (d) => new Date(d.uploadedAt).toLocaleDateString() }]
            }
            data={documents || []} />
          
          </div>
        }

        {activeTab === 'verifications' &&
        <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold text-gray-800">Verifications</h3>
              <Button size="sm" variant="outline"><Plus className="w-4 h-4 mr-2" /> Add Record</Button>
            </div>
            <DataTable
            columns={[
            { header: 'Status', accessor: (v) => <Badge>{v.verificationStatus}</Badge> },
            { header: 'Comments', accessor: 'comments' },
            { header: 'Date', accessor: (v) => new Date(v.verifiedAt).toLocaleDateString() }]
            }
            data={verifications || []} />
          
          </div>
        }
      </div>

      {/* Booking Modal */}
      <BookingModal
        isOpen={isBookingModalOpen}
        onClose={() => setIsBookingModalOpen(false)}
        property={property}
        onSuccess={() => {
          navigate(user?.role === 'PropertyOwner' ? '/properties' : '/tenants');
        }}
      />
    </div>
  );
};