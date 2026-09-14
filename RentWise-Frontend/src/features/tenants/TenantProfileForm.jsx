import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { tenantProfileSchema } from './types';







export function TenantProfileForm({ initialData, onSubmit, isLoading }) {
  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(tenantProfileSchema),
    defaultValues: {
      income: initialData?.income || 0,
      creditScore: initialData?.creditScore || 650,
      employmentStatus: initialData?.employmentStatus || '',
      rentalHistory: initialData?.rentalHistory || '',
      preferences: initialData?.preferences || ''
    }
  });

  useEffect(() => {
    if (initialData) {
      reset(initialData);
    }
  }, [initialData, reset]);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Input label="Monthly Income ($)" type="number" {...register('income', { valueAsNumber: true })} error={errors.income?.message} />
        <Input label="Credit Score" type="number" {...register('creditScore', { valueAsNumber: true })} error={errors.creditScore?.message} />
      </div>

      <Input label="Employment Status" {...register('employmentStatus')} error={errors.employmentStatus?.message} />
      
      <div className="space-y-1">
        <label className="text-sm font-medium text-gray-700 mb-1 block">Rental History</label>
        <textarea
          {...register('rentalHistory')}
          className="flex min-h-[80px] w-full rounded-lg border border-gray-200/60 bg-white/50 backdrop-blur-sm px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20" />
        
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium text-gray-700 mb-1 block">Preferences</label>
        <textarea
          {...register('preferences')}
          className="flex min-h-[80px] w-full rounded-lg border border-gray-200/60 bg-white/50 backdrop-blur-sm px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20" />
        
      </div>

      <div className="pt-4 flex justify-end">
        <Button type="submit" isLoading={isLoading}>
          {initialData ? 'Update Profile' : 'Create Profile'}
        </Button>
      </div>
    </form>);

}