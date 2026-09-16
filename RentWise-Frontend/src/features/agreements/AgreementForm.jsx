import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { agreementSchema } from './types';







export function AgreementForm({ initialData, onSubmit, isLoading }) {
  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(agreementSchema),
    defaultValues: {
      propertyId: initialData?.propertyId || '',
      tenantId: initialData?.tenantId || '',
      startDate: initialData?.startDate ? new Date(initialData.startDate).toISOString().split('T')[0] : '',
      endDate: initialData?.endDate ? new Date(initialData.endDate).toISOString().split('T')[0] : '',
      monthlyRent: initialData?.monthlyRent || 0,
      securityDeposit: initialData?.securityDeposit || 0,
      terms: initialData?.terms || '',
      status: initialData?.status || 'Pending'
    }
  });

  useEffect(() => {
    if (initialData) {
      reset({
        ...initialData,
        startDate: new Date(initialData.startDate).toISOString().split('T')[0],
        endDate: new Date(initialData.endDate).toISOString().split('T')[0]
      });
    }
  }, [initialData, reset]);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Input label="Property ID (UUID)" {...register('propertyId')} error={errors.propertyId?.message} />
      <Input label="Tenant ID (UUID)" {...register('tenantId')} error={errors.tenantId?.message} />
      
      <div className="grid grid-cols-2 gap-4">
        <Input label="Start Date" type="date" {...register('startDate')} error={errors.startDate?.message} />
        <Input label="End Date" type="date" {...register('endDate')} error={errors.endDate?.message} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Input label="Monthly Rent ($)" type="number" {...register('monthlyRent', { valueAsNumber: true })} error={errors.monthlyRent?.message} />
        <Input label="Security Deposit ($)" type="number" {...register('securityDeposit', { valueAsNumber: true })} error={errors.securityDeposit?.message} />
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium text-gray-700 mb-1 block">Terms & Conditions</label>
        <textarea
          {...register('terms')}
          className="flex min-h-[80px] w-full rounded-lg border border-gray-200/60 bg-white/50 backdrop-blur-sm px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20" />
        
        {errors.terms && <p className="text-sm text-rose-500">{errors.terms.message}</p>}
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium text-gray-700 mb-1 block">Status</label>
        <select {...register('status')} className="flex h-11 w-full rounded-lg border border-gray-200/60 bg-white/50 backdrop-blur-sm px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20">
          <option value="Pending">Pending</option>
          <option value="Active">Active</option>
          <option value="Terminated">Terminated</option>
        </select>
        {errors.status && <p className="text-sm text-rose-500">{errors.status.message}</p>}
      </div>

      <div className="pt-4 flex justify-end">
        <Button type="submit" isLoading={isLoading}>
          {initialData ? 'Update Agreement' : 'Create Agreement'}
        </Button>
      </div>
    </form>);

}