import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { propertySchema } from './types';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useAuth } from '../../hooks/useAuth';
import { evaluatePropertyVerification } from '../../utils/addressVerification';
import { Tag, Plus, X, Sparkles, Building, Home, Check, FileText, ShieldCheck, Upload, Camera, AlertCircle, Zap, Image as ImageIcon, CheckCircle2 } from 'lucide-react';


const PROPERTY_TYPES = [
  'House',
  'Apartment',
  'Villa',
  'Bungalow',
  'Studio',
  'Commercial',
  'Annex'
];

const SUGGESTED_TAGS = [
  'Luxury',
  'Furnished',
  'Semi-Furnished',
  'Unfurnished',
  'Sea View',
  'Garden',
  'Swimming Pool',
  'Gym Access',
  'Parking Space',
  'Newly Built',
  'Air Conditioned',
  'Pet Friendly',
  '24/7 Security'
];

const SAMPLE_PROPERTY_PHOTOS = [
  { label: '🏡 Modern Exterior', url: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1200&q=80' },
  { label: '🛋️ Living Room', url: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80' },
  { label: '🛏️ Master Bedroom', url: 'https://images.unsplash.com/photo-1600566753376-12c8ab7fb75b?auto=format&fit=crop&w=1200&q=80' },
  { label: '🍳 Kitchen & Dining', url: 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=1200&q=80' }
];

const SAMPLE_UTILITY_BILLS = [
  { label: '⚡ CEB Electricity Bill Sample', url: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=800&q=80' },
  { label: '💧 NWSDB Water Bill Sample', url: 'https://images.unsplash.com/photo-1586769852044-692d6e3703f0?auto=format&fit=crop&w=800&q=80' }
];

export function PropertyForm({ initialData, onSubmit, onCancel, isLoading }) {
  const { user } = useAuth();
  const isAdmin = ['Administrator', 'Admin', 'SystemAdmin'].includes(user?.role);
  
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [urlPhotos, setUrlPhotos] = useState([]);
  const [photoUrlInput, setPhotoUrlInput] = useState('');
  
  // Utility Bill / Ownership Document state (for Agentic AI OCR verification)
  const initialUtilityBill = evaluatePropertyVerification(initialData).billUrl || '';
  const [utilityBillFile, setUtilityBillFile] = useState(null);
  const [utilityBillPreview, setUtilityBillPreview] = useState(initialUtilityBill);

  // Feature Tags state
  const initialTags = Array.isArray(initialData?.featureTags || initialData?.FeatureTags)
    ? (initialData?.featureTags || initialData?.FeatureTags)
    : [];
  const [selectedTags, setSelectedTags] = useState(initialTags);
  const [customTagInput, setCustomTagInput] = useState('');

  // Normalize status if passed as number or string
  const getInitialStatus = (s) => {
    if (typeof s === 'number') {
      return ['PendingVerification', 'Active', 'Suspended'][s] || 'Active';
    }
    return s || 'Active';
  };

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm({
    resolver: zodResolver(propertySchema),
    defaultValues: {
      title: initialData?.title || initialData?.Title || '',
      description: initialData?.description || initialData?.Description || '',
      address: initialData?.address || initialData?.Address || '',
      monthlyRent: Number(initialData?.monthlyRent || initialData?.MonthlyRent || 0),
      bedrooms: Number(initialData?.bedrooms ?? initialData?.Bedrooms ?? 1),
      bathrooms: Number(initialData?.bathrooms ?? initialData?.Bathrooms ?? 1),
      facilities: initialData?.facilities || initialData?.Facilities || '',
      sqft: Number(initialData?.sqft ?? initialData?.Sqft ?? 1200),
      propertyType: initialData?.propertyType || initialData?.PropertyType || 'House',
      featureTags: initialTags,
      photoCount: Number(initialData?.photoCount ?? initialData?.PhotoCount ?? 0),
      status: getInitialStatus(initialData?.status || initialData?.Status)
    }
  });

  const watchedAddress = watch('address');

  useEffect(() => {
    if (initialData) {
      const tags = Array.isArray(initialData.featureTags || initialData.FeatureTags)
        ? (initialData.featureTags || initialData.FeatureTags)
        : [];
      setSelectedTags(tags);

      reset({
        title: initialData.title || initialData.Title || '',
        description: initialData.description || initialData.Description || '',
        address: initialData.address || initialData.Address || '',
        monthlyRent: Number(initialData.monthlyRent || initialData.MonthlyRent || 0),
        bedrooms: Number(initialData.bedrooms ?? initialData.Bedrooms ?? 1),
        bathrooms: Number(initialData.bathrooms ?? initialData.Bathrooms ?? 1),
        facilities: initialData.facilities || initialData.Facilities || '',
        sqft: Number(initialData.sqft ?? initialData.Sqft ?? 1200),
        propertyType: initialData.propertyType || initialData.PropertyType || 'House',
        featureTags: tags,
        photoCount: Number(initialData.photoCount ?? initialData.PhotoCount ?? (initialData.photos?.length || 0)),
        utilityBillUrl: initialUtilityBill,
        status: getInitialStatus(initialData.status || initialData.Status)
      });
      setUtilityBillPreview(initialUtilityBill);
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

  const handleUtilityBillFile = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setUtilityBillFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setUtilityBillPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const toggleTag = (tag) => {
    let nextTags;
    if (selectedTags.includes(tag)) {
      nextTags = selectedTags.filter(t => t !== tag);
    } else {
      nextTags = [...selectedTags, tag];
    }
    setSelectedTags(nextTags);
    setValue('featureTags', nextTags);
  };

  const handleAddCustomTag = (e) => {
    e.preventDefault();
    const trimmed = customTagInput.trim();
    if (!trimmed) return;
    if (!selectedTags.includes(trimmed)) {
      const nextTags = [...selectedTags, trimmed];
      setSelectedTags(nextTags);
      setValue('featureTags', nextTags);
    }
    setCustomTagInput('');
  };

  const existingPhotos = initialData?.photos || initialData?.Photos || [];

  const handleAddPhotoUrl = () => {
    const trimmed = photoUrlInput.trim();
    if (!trimmed) return;
    if (!urlPhotos.includes(trimmed)) {
      setUrlPhotos(prev => [...prev, trimmed]);
    }
    setPhotoUrlInput('');
  };

  const handleAddSamplePhoto = (sampleUrl) => {
    if (!urlPhotos.includes(sampleUrl)) {
      setUrlPhotos(prev => [...prev, sampleUrl]);
    }
  };

  const removeUrlPhoto = (indexToRemove) => {
    setUrlPhotos(prev => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleFormSubmit = (data) => {
    const existingPhotoUrls = existingPhotos.map(p => typeof p === 'string' ? p : (p.photoUrl || p.PhotoUrl || p.url)).filter(Boolean);
    const allAddedUrls = [...existingPhotoUrls, ...urlPhotos];
    const totalPhotos = allAddedUrls.length + (selectedFiles.length || 0);
    const parsedSqft = isNaN(Number(data.sqft)) ? 0 : Number(data.sqft);
    const primaryUrl = allAddedUrls[0] || '';

    const billUrl = utilityBillPreview || data.utilityBillUrl || '';

    const payload = {
      ...data,
      sqft: parsedSqft,
      propertyType: data.propertyType || 'House',
      featureTags: selectedTags,
      photoCount: totalPhotos > 0 ? totalPhotos : 1,
      photoUrl: primaryUrl,
      photos: allAddedUrls.map((url, idx) => ({ id: `p_${idx}`, photoUrl: url, isPrimary: idx === 0 })),
      utilityBillUrl: billUrl
    };

    onSubmit(payload, selectedFiles, utilityBillFile);
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
      {/* Title */}
      <Input 
        label="Property Title" 
        {...register('title')} 
        error={errors.title?.message} 
        placeholder="e.g. Modern 3-Bedroom Villa in Colombo 07" 
      />
      
      {/* Description */}
      <div className="space-y-1">
        <label className="text-sm font-medium text-gray-700 mb-1 block">Description</label>
        <textarea
          {...register('description')}
          placeholder="Describe your property layout, neighborhood, lease terms, and special highlights..."
          className="flex min-h-[90px] w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20" 
        />
        {errors.description && <p className="text-sm text-rose-500">{errors.description.message}</p>}
      </div>

      {/* Address */}
      <Input 
        label="Address & City" 
        {...register('address')} 
        error={errors.address?.message} 
        placeholder="e.g. 45 Ward Place, Colombo 07" 
      />
      
      {/* Property Type & Monthly Rent */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700 mb-1 block">Property Type</label>
          <select 
            {...register('propertyType')}
            className="flex h-11 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
          >
            {PROPERTY_TYPES.map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
          {errors.propertyType && <p className="text-sm text-rose-500">{errors.propertyType.message}</p>}
        </div>

        <Input 
          label="Monthly Rent (Rs.)" 
          type="number" 
          {...register('monthlyRent', { valueAsNumber: true })} 
          error={errors.monthlyRent?.message} 
          placeholder="e.g. 150000" 
        />
      </div>

      {/* Bedrooms, Bathrooms, and Sqft */}
      <div className="grid grid-cols-3 gap-3">
        <Input 
          label="Bedrooms" 
          type="number" 
          min="0" 
          {...register('bedrooms', { valueAsNumber: true })} 
          error={errors.bedrooms?.message} 
        />
        <Input 
          label="Bathrooms" 
          type="number" 
          min="0" 
          {...register('bathrooms', { valueAsNumber: true })} 
          error={errors.bathrooms?.message} 
        />
        <Input 
          label="Floor Area (Sqft)" 
          type="number" 
          min="0" 
          {...register('sqft', { valueAsNumber: true })} 
          error={errors.sqft?.message} 
          placeholder="e.g. 1500" 
        />
      </div>

      {/* Facilities & Amenities */}
      <Input 
        label="Facilities & Amenities (comma-separated)" 
        {...register('facilities')} 
        error={errors.facilities?.message} 
        placeholder="e.g. Air Conditioning, Swimming Pool, Parking, Gym, Solar Power" 
      />

      {/* Feature Tags Selector (New backend feature) */}
      <div className="space-y-2 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold uppercase tracking-wider text-gray-700 flex items-center gap-1.5">
            <Tag className="w-3.5 h-3.5 text-indigo-600" />
            <span>Feature Tags & Highlights</span>
          </label>
          <span className="text-[11px] text-gray-500">
            {selectedTags.length} tag(s) selected
          </span>
        </div>

        {/* Selected Tags Pills */}
        {selectedTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {selectedTags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-600 text-white shadow-2xs animate-in fade-in"
              >
                <span>{tag}</span>
                <button
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className="hover:bg-indigo-700 rounded-full p-0.5 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Suggested Quick Pick Tags */}
        <div className="pt-1.5">
          <p className="text-[11px] text-gray-500 mb-1.5 font-medium">Quick select popular highlights:</p>
          <div className="flex flex-wrap gap-1.5">
            {SUGGESTED_TAGS.map((tag) => {
              const isSelected = selectedTags.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-all ${
                    isSelected
                      ? 'bg-indigo-100 border-indigo-300 text-indigo-800 font-semibold shadow-2xs'
                      : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-100 hover:border-gray-300'
                  }`}
                >
                  {isSelected ? `✓ ${tag}` : `+ ${tag}`}
                </button>
              );
            })}
          </div>
        </div>

        {/* Custom Tag Input */}
        <div className="flex items-center gap-2 pt-1.5">
          <input
            type="text"
            value={customTagInput}
            onChange={(e) => setCustomTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddCustomTag(e);
              }
            }}
            placeholder="Add a custom feature tag (e.g. Solar Backup, Near Railway)..."
            className="flex-1 text-xs px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <button
            type="button"
            onClick={handleAddCustomTag}
            className="px-3 py-1.5 bg-gray-800 hover:bg-gray-900 text-white rounded-lg text-xs font-semibold flex items-center gap-1 shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Tag</span>
          </button>
        </div>
      </div>

      {/* Existing Photos Display (When Editing) */}
      {existingPhotos.length > 0 && (
        <div className="space-y-1.5 p-3 rounded-xl bg-slate-50 border border-slate-200/80">
          <label className="text-xs font-bold uppercase tracking-wider text-gray-600 block">
            Current Listed Photos ({existingPhotos.length})
          </label>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 pt-1">
            {existingPhotos.map((photo, idx) => {
              const url = typeof photo === 'string' ? photo : (photo.photoUrl || photo.PhotoUrl || photo.url);
              return (
                <div key={idx} className="relative aspect-square rounded-lg overflow-hidden border border-gray-200 bg-white">
                  <img src={url} alt={`Current ${idx}`} className="w-full h-full object-cover" />
                  {idx === 0 && (
                    <span className="absolute bottom-1 left-1 bg-black/70 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded">
                      Cover
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          <p className="text-[11px] text-gray-500 mt-1">
            You can upload additional photos below to append to your gallery.
          </p>
        </div>
      )}

      {/* Property Photos (File Upload, URL Input, and Quick Samples) */}
      <div className="space-y-2.5 p-4 rounded-2xl bg-indigo-50/40 border border-indigo-100">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold uppercase tracking-wider text-gray-700 flex items-center gap-1.5">
            <Camera className="w-4 h-4 text-indigo-600" />
            <span>Property Photos</span>
            {(selectedFiles.length + urlPhotos.length + existingPhotos.length) > 0 && (
              <span className="bg-indigo-100 text-indigo-800 text-[10px] px-2 py-0.5 rounded-full font-bold">
                {selectedFiles.length + urlPhotos.length + existingPhotos.length} Total Photo(s)
              </span>
            )}
          </label>
          <span className="text-[11px] text-gray-500 font-medium">Upload files or paste URLs</span>
        </div>

        {/* 1. File Upload Dropzone */}
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
          className="flex w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer shadow-2xs"
        />

        {/* 2. Direct Photo URL Input */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Or paste property image URL (https://...)"
            value={photoUrlInput}
            onChange={(e) => setPhotoUrlInput(e.target.value)}
            className="flex-1 rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-2xs"
          />
          <button
            type="button"
            onClick={handleAddPhotoUrl}
            className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shrink-0 cursor-pointer shadow-2xs"
          >
            + Add URL
          </button>
        </div>

        {/* 3. Quick Sample Property Photos */}
        <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
          <span className="text-[11px] font-bold text-gray-500 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-indigo-500" /> Samples:
          </span>
          {SAMPLE_PROPERTY_PHOTOS.map((sample, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleAddSamplePhoto(sample.url)}
              className="text-[11px] px-2.5 py-1 bg-white hover:bg-indigo-50 hover:text-indigo-700 border border-gray-200 rounded-lg text-gray-700 font-medium transition-all cursor-pointer shadow-2xs"
            >
              {sample.label}
            </button>
          ))}
        </div>

        {/* Previews of Uploaded & URL Photos */}
        {(previews.length > 0 || urlPhotos.length > 0) && (
          <div className="mt-2 space-y-1.5">
            <span className="text-[11px] font-bold text-gray-600 uppercase tracking-wider block">
              Newly Attached Photos:
            </span>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
              {previews.map((preview, index) => (
                <div key={`file-${index}`} className="relative aspect-square rounded-xl overflow-hidden border-2 border-indigo-400 group shadow-xs">
                  <img src={preview} alt={`preview-${index}`} className="w-full h-full object-cover" />
                  <span className="absolute bottom-1 left-1 bg-black/70 text-white text-[9px] px-1.5 py-0.5 rounded font-bold">
                    File #{index + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeFile(index)}
                    className="absolute top-1 right-1 bg-rose-600 text-white rounded-full p-1 opacity-90 hover:opacity-100 transition-opacity hover:bg-rose-700 shadow-sm cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              {urlPhotos.map((url, index) => (
                <div key={`url-${index}`} className="relative aspect-square rounded-xl overflow-hidden border-2 border-emerald-400 group shadow-xs">
                  <img src={url} alt={`url-photo-${index}`} className="w-full h-full object-cover" />
                  <span className="absolute bottom-1 left-1 bg-black/70 text-white text-[9px] px-1.5 py-0.5 rounded font-bold">
                    Web URL
                  </span>
                  <button
                    type="button"
                    onClick={() => removeUrlPhoto(index)}
                    className="absolute top-1 right-1 bg-rose-600 text-white rounded-full p-1 opacity-90 hover:opacity-100 transition-opacity hover:bg-rose-700 shadow-sm cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Utility Bill / Proof of Ownership (For Agentic AI OCR Verification) */}
      <div className="space-y-2.5 p-4 rounded-2xl bg-amber-50/70 border border-amber-200">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
            <Zap className="w-4 h-4 text-amber-600" />
            <span>Electricity / Utility Bill Proof</span>
            <span className="bg-amber-200/80 text-amber-900 text-[10px] px-2 py-0.5 rounded-full font-bold border border-amber-300">
              Agentic AI OCR
            </span>
          </label>
          <span className="text-[11px] text-amber-700 font-semibold">Address Verification</span>
        </div>

        <p className="text-xs text-amber-800/85 leading-relaxed">
          Upload a clear photo of your latest electricity (CEB/LECO) or water bill showing the property address for automated OCR verification.
        </p>

        {utilityBillPreview ? (
          <div className="space-y-2.5">
            <div className="relative rounded-2xl overflow-hidden border-2 border-amber-300 bg-white p-3 flex items-center gap-3 shadow-xs">
              <img 
                src={utilityBillPreview} 
                alt="Utility Bill Proof" 
                className="w-20 h-20 object-cover rounded-xl border border-amber-200 shadow-2xs shrink-0" 
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Utility Bill Attached & Ready</span>
                </div>
                <p className="text-[11px] text-gray-500 truncate mt-0.5 font-medium">
                  {utilityBillFile ? utilityBillFile.name : (utilityBillPreview.startsWith('data:') ? 'Document ready for verification' : utilityBillPreview)}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <label className="text-xs font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer">
                    <span>Change File</span>
                    <input type="file" accept="image/*" className="hidden" onChange={handleUtilityBillFile} />
                  </label>
                  <span className="text-gray-300">|</span>
                  <button
                    type="button"
                    onClick={() => {
                      setUtilityBillFile(null);
                      setUtilityBillPreview('');
                    }}
                    className="text-xs font-bold text-rose-600 hover:text-rose-800 cursor-pointer"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>

            {/* Awaiting Backend Agent Verification Status */}
            <div className="p-3.5 rounded-xl border transition-all bg-amber-50/90 border-amber-300 text-amber-950">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-amber-600" />
                  <span className="text-xs font-bold">Document Attached</span>
                </div>
              </div>
              <p className="text-[11px] mt-1 text-amber-800">
                Awaiting Agentic AI backend verification upon submission.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {/* File upload input */}
            <label className="border-2 border-dashed border-amber-300 hover:border-amber-500 hover:bg-amber-100/50 rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer transition-all bg-white">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center mb-1.5 shadow-2xs">
                <FileText className="w-5 h-5" />
              </div>
              <p className="text-xs font-bold text-gray-800">
                Click to upload electricity/water bill photo
              </p>
              <p className="text-[11px] text-gray-500 mt-0.5">
                PNG, JPG, JPEG or WEBP (Max 10MB)
              </p>
              <input type="file" accept="image/*" className="hidden" onChange={handleUtilityBillFile} />
            </label>

            {/* Quick Test Demo Samples */}
            <div className="flex items-center gap-2 pt-0.5">
              <span className="text-[11px] text-amber-800 font-bold shrink-0">Demo Samples:</span>
              <div className="flex flex-wrap gap-1.5">
                {SAMPLE_UTILITY_BILLS.map((sample, sIdx) => (
                  <button
                    key={sIdx}
                    type="button"
                    onClick={() => {
                      setUtilityBillFile(null);
                      setUtilityBillPreview(sample.url);
                    }}
                    className="text-[11px] px-2.5 py-1 bg-white hover:bg-amber-100 border border-amber-200 rounded-lg text-amber-900 font-bold transition-all flex items-center gap-1 shadow-2xs cursor-pointer"
                  >
                    <span>{sample.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Listing Status (Admin Only) */}
      {isAdmin && (
        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700 mb-1 block">Listing Status</label>
          <select 
            {...register('status')} 
            className="flex h-11 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
          >
            <option value="Active">Active (Available for Rent)</option>
            <option value="PendingVerification">Pending Verification</option>
            <option value="Suspended">Suspended / Paused</option>
          </select>
          {errors.status && <p className="text-sm text-rose-500">{errors.status.message}</p>}
        </div>
      )}

      {/* Action Buttons */}
      <div className="pt-4 flex items-center justify-end gap-2 border-t border-gray-100">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
            Cancel
          </Button>
        )}
        <Button type="submit" isLoading={isLoading} className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold">
          {initialData ? 'Save & Update Details' : 'Create Property Listing'}
        </Button>
      </div>
    </form>
  );
}
