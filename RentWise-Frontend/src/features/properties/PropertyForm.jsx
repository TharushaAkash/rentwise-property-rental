import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { propertySchema } from './types';

export function PropertyForm({ initialData, onSubmit, isLoading }) {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [previews, setPreviews] = useState([]);

  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(propertySchema),
    defaultValues: {
      title: initialData?.title || '',
      description: initialData?.description || '',
      address: initialData?.address || '',
      monthlyRent: initialData?.monthlyRent || 0,
      bedrooms: initialData?.bedrooms || 0,
      bathrooms: initialData?.bathrooms || 0,
      facilities: initialData?.facilities || '',
      status: initialData?.status || 'PendingVerification'
    }
  });

  useEffect(() => {
    if (initialData) {
      reset({
        title: initialData.title,
        description: initialData.description,
        address: initialData.address,
        monthlyRent: initialData.monthlyRent,
        bedrooms: initialData.bedrooms,
        bathrooms: initialData.bathrooms,
        facilities: initialData.facilities,
        status: initialData.status
      });
    }
  }, [initialData, reset]);

  useEffect(() => {
    const objectUrls = selectedFiles.map(file => URL.createObjectURL(file));
    setPreviews(objectUrls);

    return () => {
      objectUrls.forEach(url => URL.revokeObjectURL(url));
    };
  }, [selectedFiles]);


  const removeFile = (indexToRemove) => {
    setSelectedFiles(prev => prev.filter((_, index) => index !== indexToRemove));
  };

  const handleFormSubmit = (data) => {
    onSubmit(data, selectedFiles);
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
      <Input label="Title" {...register('title')} error={errors.title?.message} />
      
      <div className="space-y-1">
        <label className="text-sm font-medium text-gray-700 mb-1 block">Description</label>
        <textarea
          {...register('description')}
          className="flex min-h-[80px] w-full rounded-lg border border-gray-200/60 bg-white/50 backdrop-blur-sm px-3 py-2 text-sm text-gray-900 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20" />
        
        {errors.description && <p className="text-sm text-rose-500">{errors.description.message}</p>}
      </div>

      <Input label="Address" {...register('address')} error={errors.address?.message} />
      
      <div className="grid grid-cols-2 gap-4">
        <Input label="Monthly Rent ($)" type="number" {...register('monthlyRent', { valueAsNumber: true })} error={errors.monthlyRent?.message} />
        <Input label="Facilities" {...register('facilities')} error={errors.facilities?.message} placeholder="e.g. Pool, Gym" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Input label="Bedrooms" type="number" {...register('bedrooms', { valueAsNumber: true })} error={errors.bedrooms?.message} />
        <Input label="Bathrooms" type="number" {...register('bathrooms', { valueAsNumber: true })} error={errors.bathrooms?.message} />
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium text-gray-700 mb-1 block">Images</label>
        <input 
          type="file" 
          multiple 
          accept="image/*"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              const filesArray = Array.from(e.target.files);
              setSelectedFiles(prev => [...prev, ...filesArray]);
            }
          }}
          className="flex w-full rounded-lg border border-gray-200/60 bg-white/50 backdrop-blur-sm px-3 py-2 text-sm text-gray-900 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
        />
        
        {selectedFiles.length > 0 && (
          <p className="text-xs text-indigo-600 mt-1 font-medium">{selectedFiles.length} file(s) ready to upload</p>
        )}

        {previews.length > 0 && (
          <div className="mt-3 grid grid-cols-3 sm:grid-cols-4 gap-3">
            {previews.map((preview, index) => (
              <div key={index} className="relative aspect-square rounded-lg overflow-hidden border border-gray-200 group">
                <img src={preview} alt={`preview-${index}`} className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeFile(index)}
                  className="absolute top-1 right-1 bg-red-500/90 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 shadow-sm"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium text-gray-700 mb-1 block">Status</label>
        <select {...register('status')} className="flex h-11 w-full rounded-lg border border-gray-200/60 bg-white/50 backdrop-blur-sm px-3 py-2 text-sm text-gray-900 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20">
          <option value="PendingVerification">Pending Verification</option>
          <option value="Active">Active</option>
          <option value="Suspended">Suspended</option>
        </select>
        {errors.status && <p className="text-sm text-rose-500">{errors.status.message}</p>}
      </div>

      <div className="pt-4 flex justify-end">
        <Button type="submit" isLoading={isLoading}>
          {initialData ? 'Update Property' : 'Create Property'}
        </Button>
      </div>
    </form>);
}