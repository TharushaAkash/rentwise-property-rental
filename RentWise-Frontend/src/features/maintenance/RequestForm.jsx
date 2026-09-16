import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '../../components/ui/Button';
import { requestSchema } from './types';
import { useAuth } from '../../hooks/useAuth';
import { 
  Home, 
  MapPin, 
  Wrench, 
  AlertTriangle, 
  Image as ImageIcon, 
  CheckCircle2, 
  Sparkles,
  Info
} from 'lucide-react';

const CATEGORIES = [
  { value: 'Plumbing', label: 'Plumbing (Leaks, Pipes, Faucets)' },
  { value: 'Electrical', label: 'Electrical (Lights, Wiring, Sockets)' },
  { value: 'Appliances', label: 'Appliances (AC, Heater, Fridge)' },
  { value: 'HVAC', label: 'HVAC & Air Conditioning' },
  { value: 'Structural', label: 'Structural (Doors, Locks, Windows)' },
  { value: 'Carpentry', label: 'Carpentry & Furniture' },
  { value: 'General', label: 'General Maintenance' }
];

const PRIORITIES = [
  { value: 'Low', label: 'Low', color: 'bg-slate-100 text-slate-700 border-slate-200' },
  { value: 'Medium', label: 'Medium', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  { value: 'High', label: 'High', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  { value: 'Emergency', label: 'Emergency', color: 'bg-rose-50 text-rose-700 border-rose-200' }
];

export function RequestForm({ 
  initialData, 
  properties = [], 
  selectedProperty = null, 
  onSubmit, 
  onCancel,
  isLoading 
}) {
  const { user } = useAuth();
  const [photoPreview, setPhotoPreview] = useState(initialData?.photoUrl || '');

  const defaultPropId = selectedProperty?.id || selectedProperty?.propertyId || initialData?.propertyId || (properties.length > 0 ? (properties[0].id || properties[0].propertyId) : '');

  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm({
    resolver: zodResolver(requestSchema),
    defaultValues: {
      propertyId: defaultPropId || '',
      tenantId: initialData?.tenantId || user?.id || '',
      description: initialData?.description || initialData?.issueDescription || '',
      photoUrl: initialData?.photoUrl || '',
      aiCategory: initialData?.aiCategory || 'General',
      aiPriority: initialData?.aiPriority || initialData?.priority || 'Medium',
      status: initialData?.status || 'Reported'
    }
  });

  const currentPropId = watch('propertyId');
  const currentPriority = watch('aiPriority');
  const currentPhotoUrl = watch('photoUrl');

  // Keep photo preview in sync
  useEffect(() => {
    if (currentPhotoUrl && (currentPhotoUrl.startsWith('http://') || currentPhotoUrl.startsWith('https://'))) {
      setPhotoPreview(currentPhotoUrl);
    } else if (!currentPhotoUrl) {
      setPhotoPreview('');
    }
  }, [currentPhotoUrl]);

  // Synchronize when selectedProperty or initialData updates
  useEffect(() => {
    if (selectedProperty) {
      const propId = selectedProperty.id || selectedProperty.propertyId;
      setValue('propertyId', propId);
    }
    if (user?.id) {
      setValue('tenantId', user.id);
    }
  }, [selectedProperty, user, setValue]);

  const activeProp = selectedProperty || properties.find((p) => (p.id || p.propertyId) === currentPropId);

  const handleFormSubmit = (data) => {
    const payload = {
      ...data,
      tenantId: user?.id || data.tenantId,
      status: data.status || 'Reported'
    };
    onSubmit(payload);
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-5 text-gray-800">
      
      {/* 1. Property Context */}
      <div className="space-y-2">
        <label className="text-xs font-bold uppercase tracking-wider text-gray-600 block flex items-center justify-between">
          <span>Target Property</span>
          {activeProp && (
            <span className="text-[11px] font-semibold text-emerald-600 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Booked Home
            </span>
          )}
        </label>

        {selectedProperty ? (
          // Fixed card view when pre-selected from a booked property card
          <div className="p-3.5 rounded-2xl bg-blue-50/60 border border-blue-100 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold shrink-0 shadow-sm">
              <Home className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-gray-900 truncate">
                {selectedProperty.title || selectedProperty.propertyTitle || 'Selected Property'}
              </p>
              <p className="text-xs text-gray-500 truncate flex items-center gap-1 mt-0.5">
                <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                {selectedProperty.address || selectedProperty.propertyAddress || 'Address on file'}
              </p>
            </div>
            <input type="hidden" {...register('propertyId')} value={selectedProperty.id || selectedProperty.propertyId} />
          </div>
        ) : (
          // Dropdown selector if multiple booked properties
          <div>
            {properties.length > 0 ? (
              <select
                {...register('propertyId')}
                className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm font-medium text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 shadow-sm"
              >
                <option value="">-- Choose your booked property --</option>
                {properties.map((p) => {
                  const pId = p.id || p.propertyId;
                  const pTitle = p.title || p.propertyTitle || `Property #${String(pId).slice(0, 8)}`;
                  const pAddress = p.address || p.propertyAddress ? ` (${p.address || p.propertyAddress})` : '';
                  return (
                    <option key={pId} value={pId}>
                      {pTitle}{pAddress}
                    </option>
                  );
                })}
              </select>
            ) : (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center gap-2">
                <Info className="w-4 h-4 text-amber-600 shrink-0" />
                <span>You don't have an active booked property yet. Please book a property first to request maintenance.</span>
              </div>
            )}
            {errors.propertyId && (
              <p className="text-xs text-rose-500 mt-1">{errors.propertyId.message}</p>
            )}
          </div>
        )}
      </div>

      {/* 2. Category & Priority */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Category */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold uppercase tracking-wider text-gray-600 block">
            Category
          </label>
          <select
            {...register('aiCategory')}
            className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 shadow-sm"
          >
            {CATEGORIES.map((cat) => (
              <option key={cat.value} value={cat.value}>
                {cat.label}
              </option>
            ))}
          </select>
          {errors.aiCategory && (
            <p className="text-xs text-rose-500">{errors.aiCategory.message}</p>
          )}
        </div>

        {/* Priority */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold uppercase tracking-wider text-gray-600 block">
            Urgency / Priority
          </label>
          <div className="grid grid-cols-4 gap-1.5">
            {PRIORITIES.map((p) => {
              const isSelected = currentPriority === p.value;
              return (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setValue('aiPriority', p.value)}
                  className={`py-2 px-1 text-center text-xs font-bold rounded-xl border transition-all ${
                    isSelected
                      ? `${p.color} ring-2 ring-blue-500 font-extrabold shadow-sm`
                      : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 3. Issue Description */}
      <div className="space-y-1.5">
        <label className="text-xs font-bold uppercase tracking-wider text-gray-600 block">
          Issue Description <span className="text-rose-500">*</span>
        </label>
        <textarea
          {...register('description')}
          rows={3}
          placeholder="Please describe the issue clearly (e.g., Water is dripping continuously from the bathroom sink pipe onto the cabinet floor)..."
          className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 shadow-sm resize-y"
        />
        {errors.description && (
          <p className="text-xs text-rose-500">{errors.description.message}</p>
        )}
      </div>

      {/* 4. Photo URL / Evidence (Optional) */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold uppercase tracking-wider text-gray-600 flex items-center gap-1.5">
            <ImageIcon className="w-3.5 h-3.5 text-gray-400" />
            <span>Photo Proof (Optional URL)</span>
          </label>
          {/* Quick preset for easy test */}
          <button
            type="button"
            onClick={() => setValue('photoUrl', 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=800&q=80')}
            className="text-[11px] text-blue-600 hover:underline font-medium"
          >
            Insert sample photo
          </button>
        </div>

        <input
          type="url"
          {...register('photoUrl')}
          placeholder="https://example.com/damage-photo.jpg"
          className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 shadow-sm"
        />

        {photoPreview && (
          <div className="relative mt-2 p-2 rounded-xl bg-gray-50 border border-gray-200 inline-block">
            <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Image Preview</p>
            <img 
              src={photoPreview} 
              alt="Maintenance proof" 
              className="w-32 h-20 object-cover rounded-lg border border-gray-200 shadow-sm"
              onError={() => setPhotoPreview('')}
            />
          </div>
        )}
      </div>

      {/* 5. Actions */}
      <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-2.5">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button 
          type="submit" 
          isLoading={isLoading}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-2.5 rounded-xl shadow-md shadow-blue-600/20"
        >
          <Wrench className="w-4 h-4 mr-2" />
          {initialData ? 'Update Request' : 'Submit Request'}
        </Button>
      </div>
    </form>
  );
}