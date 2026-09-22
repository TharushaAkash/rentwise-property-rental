import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '../../components/ui/Button';
import { requestSchema } from './types';
import { useAuth } from '../../hooks/useAuth';
import api from '../../services/api';
import { Home, MapPin, Wrench, AlertTriangle, Image as ImageIcon, CheckCircle2, Sparkles, Info, Upload, Camera, X, Check, Phone, User } from 'lucide-react';
import { handleImageError } from '../../utils/imagePlaceholder';

const CATEGORIES = [
  { value: 'Plumbing', label: 'Plumbing (Leaks, Pipes, Faucets)' },
  { value: 'Electrical', label: 'Electrical (Lights, Wiring, Sockets)' },
  { value: 'HVAC', label: 'HVAC & Air Conditioning' },
  { value: 'Appliance', label: 'Appliances (AC, Heater, Fridge, Washing)' },
  { value: 'Structural', label: 'Structural (Doors, Locks, Windows, Roof)' },
  { value: 'Carpentry', label: 'Carpentry & Furniture' },
  { value: 'Painting', label: 'Painting & Finishing' },
  { value: 'Pest', label: 'Pest Control (Termites, Insects, Rodents)' },
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

  const [providers, setProviders] = useState([]);
  const [ownerDbProviders, setOwnerDbProviders] = useState([]);
  const [providerSource, setProviderSource] = useState(null); // 'owner_db' | 'platform_auto'
  const [aiTicket, setAiTicket] = useState(null);
  const [isTriaging, setIsTriaging] = useState(false);
  const [assignedProvider, setAssignedProvider] = useState(initialData?.assignedServiceProvider || null);

  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm({
    resolver: zodResolver(requestSchema),
    defaultValues: {
      propertyId: defaultPropId || '',
      tenantId: initialData?.tenantId || user?.id || '',
      description: initialData?.description || initialData?.issueDescription || '',
      photoUrl: initialData?.photoUrl || '',
      aiCategory: initialData?.aiCategory || 'General',
      aiPriority: initialData?.aiPriority || initialData?.priority || 'Medium',
      assignedServiceProviderId: initialData?.assignedServiceProviderId || '',
      assignedProviderName: initialData?.assignedProviderName || '',
      status: initialData?.status || 'Reported'
    }
  });

  const currentPropId = watch('propertyId');
  const currentPriority = watch('aiPriority');
  const currentPhotoUrl = watch('photoUrl');

  // Load Service Providers from Database (Owner-added contractors ONLY)
  useEffect(() => {
    const loadProviders = async () => {
      let dbList = [];
      try {
        const res = await api.get('/service-providers');
        if (Array.isArray(res.data) && res.data.length > 0) {
          dbList = res.data;
        }
      } catch (err) {}

      try {
        const local = JSON.parse(localStorage.getItem('rentwise_client_service_providers') || '[]');
        // Filter out any mock ones
        const genuineLocal = local.filter(s => s && s.id && !String(s.id).startsWith('sp-'));
        if (genuineLocal.length > 0) {
          const map = new Map();
          dbList.forEach(p => map.set(String(p.id), p));
          genuineLocal.forEach(p => { if (!map.has(String(p.id))) map.set(String(p.id), p); });
          dbList = Array.from(map.values());
        }
      } catch (e) {}

      setOwnerDbProviders(dbList);
      setProviders(dbList);
    };
    loadProviders();
  }, []);

  // Keep photo preview in sync
  useEffect(() => {
    if (currentPhotoUrl && (currentPhotoUrl.startsWith('http://') || currentPhotoUrl.startsWith('https://') || currentPhotoUrl.startsWith('data:image/'))) {
      setPhotoPreview(currentPhotoUrl);
    } else if (!currentPhotoUrl) {
      setPhotoPreview('');
    }
  }, [currentPhotoUrl]);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result;
        setValue('photoUrl', base64);
        setPhotoPreview(base64);
      };
      reader.readAsDataURL(file);
    }
  };

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
  const currentDescription = watch('description');
  const currentCategory = watch('aiCategory');

  // Match service provider in database strictly by Category (with Location & Platform Fallback)
  const matchProviderByCategory = (cat, targetAddress = '') => {
    if (!cat) return { provider: null, source: 'none', dbMatches: [] };
    const cleanCat = cat.trim().toLowerCase();

    // 1. Check in database service providers (ownerDbProviders)
    if (ownerDbProviders && ownerDbProviders.length > 0) {
      const dbMatchingCategory = ownerDbProviders.filter(p => {
        const pCat = (p.category || '').trim().toLowerCase();
        const pCats = Array.isArray(p.categories) && p.categories.length > 0
          ? p.categories.map(c => c.trim().toLowerCase())
          : pCat.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);

        return pCats.includes(cleanCat) || 
               pCats.some(c => c.includes(cleanCat) || cleanCat.includes(c)) ||
               pCat === cleanCat || 
               pCat.includes(cleanCat) || 
               cleanCat.includes(pCat) ||
               (cleanCat.startsWith('applian') && (pCat.startsWith('applian') || pCats.some(c => c.startsWith('applian'))));
      });

      if (dbMatchingCategory.length > 0) {
        // Location-specific match within the same category
        const areaMatch = targetAddress ? dbMatchingCategory.find(p => {
          const sArea = (p.serviceArea || '').toLowerCase();
          const tAddr = targetAddress.toLowerCase();
          return sArea && (sArea.includes(tAddr) || tAddr.includes(sArea));
        }) : null;

        const chosen = areaMatch || dbMatchingCategory[0];
        return { provider: chosen, source: 'owner_db', dbMatches: dbMatchingCategory };
      }
    }

    // Owner database has no provider for this category
    return { provider: null, source: 'none', dbMatches: [] };
  };

  // Re-sync assigned technician whenever Category is selected or updated
  useEffect(() => {
    if (!currentCategory) return;
    const propAddress = activeProp?.address || activeProp?.propertyAddress || '';
    const { provider, source } = matchProviderByCategory(currentCategory, propAddress);
    if (provider) {
      setAssignedProvider(provider);
      setProviderSource(source);
      setValue('assignedServiceProviderId', provider.id);
      setValue('assignedProviderName', provider.name);
      setValue('status', 'Assigned');
    } else {
      setAssignedProvider(null);
      setProviderSource('none');
      setValue('assignedServiceProviderId', null);
      setValue('assignedProviderName', null);
      setValue('status', 'Reported');
    }
  }, [currentCategory, ownerDbProviders, currentPropId]);

  // Agent AI Auto-Triage & Provider Assignment (matching RentWise-AgenticService)
  const runAiTriage = async (descOverride, isSilent = false) => {
    const desc = (typeof descOverride === 'string' ? descOverride : watch('description')) || '';
    if (!desc.trim()) {
      if (!isSilent) alert('Please enter a brief issue description first to run Agent AI triage.');
      return null;
    }

    setIsTriaging(true);
    try {
      const propAddress = activeProp?.address || activeProp?.propertyAddress || '';

      // 1. Determine Category & Urgency from message
      const descLower = desc.toLowerCase();
      let cat = 'General';
      let prio = 'Medium';

      if (['pipe', 'water', 'leak', 'plumbing', 'flood', 'faucet', 'sink', 'toilet', 'drain', 'burst'].some(w => descLower.includes(w))) {
        cat = 'Plumbing';
        prio = (descLower.includes('flood') || descLower.includes('burst')) ? 'Emergency' : 'High';
      } else if (['power', 'wire', 'electrical', 'spark', 'shock', 'breaker', 'socket', 'switch'].some(w => descLower.includes(w))) {
        cat = 'Electrical';
        prio = (descLower.includes('spark') || descLower.includes('shock') || descLower.includes('fire')) ? 'Emergency' : 'High';
      } else if (['ac', 'heater', 'hvac', 'air conditioning', 'cooling', 'fan'].some(w => descLower.includes(w))) {
        cat = 'HVAC';
        prio = 'Medium';
      } else if (['fridge', 'refrigerator', 'washing', 'machine', 'oven', 'microwave'].some(w => descLower.includes(w))) {
        cat = 'Appliance';
        prio = 'Medium';
      } else if (['paint', 'peel', 'stain', 'color', 'plaster'].some(w => descLower.includes(w))) {
        cat = 'Painting';
        prio = 'Low';
      } else if (['door', 'lock', 'window', 'roof', 'wall', 'crack', 'ceiling', 'carpentry'].some(w => descLower.includes(w))) {
        cat = 'Structural';
        prio = (descLower.includes('lock') || descLower.includes('roof')) ? 'High' : 'Low';
      } else if (['rat', 'mouse', 'cockroach', 'pest', 'termite', 'bug', 'ant'].some(w => descLower.includes(w))) {
        cat = 'Pest';
        prio = 'Medium';
      }

      // Try Agentic AI service if online for fine-grained LLM classification
      try {
        const res = await api.post('/agentic/workflow/maintenance-triage', {
          objective: desc,
          property_id: currentPropId || 'property'
        });
        if (res.data?.ticket && res.data.ticket.category) {
          cat = res.data.ticket.category;
          prio = res.data.ticket.priority;
        }
      } catch (agentErr) {
        console.warn('Agentic AI endpoint note, local triage active:', agentErr);
      }

      // 2. ASSIGN TECHNICIAN BY OWNER DATABASE CATEGORY ONLY:
      const { provider: matchedProviderObj, source } = matchProviderByCategory(cat, propAddress);

      setProviderSource(source);

      if (matchedProviderObj) {
        const ticketResult = {
          category: cat,
          priority: prio,
          assigned_provider: `${matchedProviderObj.name} (${matchedProviderObj.contactNumber || 'Contact on file'})`,
          description: desc
        };

        setAssignedProvider(matchedProviderObj);
        setValue('assignedServiceProviderId', matchedProviderObj.id);
        setValue('assignedProviderName', matchedProviderObj.name);

        setAiTicket(ticketResult);
        setValue('aiCategory', cat);
        setValue('aiPriority', prio);
        setValue('status', 'Assigned');

        return { ticket: ticketResult, provider: matchedProviderObj, source };
      } else {
        // No owner-assigned service provider in database for this category
        const ticketResult = {
          category: cat,
          priority: prio,
          assigned_provider: null,
          description: desc
        };

        setAssignedProvider(null);
        setValue('assignedServiceProviderId', null);
        setValue('assignedProviderName', null);

        setAiTicket(ticketResult);
        setValue('aiCategory', cat);
        setValue('aiPriority', prio);
        setValue('status', 'Reported');

        return { ticket: ticketResult, provider: null, source: 'none' };
      }

    } catch (err) {
      console.error('AI Triage error:', err);
      return null;
    } finally {
      setIsTriaging(false);
    }
  };

  // Real-time automatic technician assignment as customer types their message
  useEffect(() => {
    if (!currentDescription || currentDescription.trim().length < 8) return;

    const timer = setTimeout(() => {
      runAiTriage(currentDescription.trim(), true);
    }, 700);

    return () => clearTimeout(timer);
  }, [currentDescription, currentPropId]);

  const handleFormSubmit = async (data) => {
    let finalAssignedProvider = assignedProvider;
    let finalAiTicket = aiTicket;

    // If customer clicked submit immediately before debounced triage finished, run triage now
    if (!finalAssignedProvider && data.description?.trim()) {
      const triageRes = await runAiTriage(data.description.trim(), true);
      if (triageRes?.provider) finalAssignedProvider = triageRes.provider;
      if (triageRes?.ticket) finalAiTicket = triageRes.ticket;
    }

    const payload = {
      ...data,
      aiCategory: finalAiTicket?.category || data.aiCategory,
      aiPriority: finalAiTicket?.priority || data.aiPriority,
      tenantId: user?.id || data.tenantId,
      assignedServiceProviderId: data.assignedServiceProviderId || finalAssignedProvider?.id,
      assignedProviderName: data.assignedProviderName || finalAiTicket?.assigned_provider || finalAssignedProvider?.name,
      status: (finalAssignedProvider || (finalAiTicket?.assigned_provider && finalAiTicket.assigned_provider !== 'Unassigned')) ? 'Assigned' : (data.status || 'Reported')
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
            {selectedProperty.photoUrl ? (
              <img
                src={selectedProperty.photoUrl}
                alt={selectedProperty.title}
                onError={handleImageError}
                className="w-12 h-12 rounded-xl object-cover border border-blue-200 shrink-0 shadow-xs"
              />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold shrink-0 shadow-sm">
                <Home className="w-5 h-5" />
              </div>
            )}
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
          <label className="text-xs font-bold uppercase tracking-wider text-gray-600 block flex items-center justify-between">
            <span>Category</span>
            {(() => {
              const matches = (ownerDbProviders || []).filter(p => {
                const pCat = (p.category || '').trim().toLowerCase();
                const cCat = (currentCategory || '').trim().toLowerCase();
                return pCat === cCat || pCat.includes(cCat) || cCat.includes(pCat) || (cCat.startsWith('applian') && pCat.startsWith('applian'));
              });
              if (matches.length > 0) {
                return (
                  <span className="text-[10.5px] font-bold text-blue-600 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> {matches.length} in Database
                  </span>
                );
              }
              return (
                <span className="text-[10.5px] font-bold text-emerald-600 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> Platform Network
                </span>
              );
            })()}
          </label>
          <select
            {...register('aiCategory')}
            onChange={(e) => {
              const newCat = e.target.value;
              setValue('aiCategory', newCat);
              const propAddress = activeProp?.address || activeProp?.propertyAddress || '';
              const { provider, source } = matchProviderByCategory(newCat, propAddress);
              if (provider) {
                setAssignedProvider(provider);
                setProviderSource(source);
                setValue('assignedServiceProviderId', provider.id);
                setValue('assignedProviderName', provider.name);
                setValue('status', 'Assigned');
              }
            }}
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

      {/* 3. Issue Description & Agent AI Auto-Triage */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold uppercase tracking-wider text-gray-600 block flex items-center gap-1.5">
            <span>Issue Description</span>
            <span className="text-rose-500">*</span>
          </label>
          <button
            type="button"
            onClick={() => runAiTriage(watch('description'), false)}
            disabled={isTriaging}
            className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#008037] hover:bg-[#006e2e] text-white rounded-xl text-xs font-black shadow-md shadow-emerald-700/20 transition-all cursor-pointer hover:scale-102 disabled:opacity-50"
          >
            <Sparkles className={`w-3.5 h-3.5 ${isTriaging ? 'animate-spin' : ''}`} />
            <span>{isTriaging ? 'Assigning Technician...' : 'Assign Service Provider Automatically'}</span>
          </button>
        </div>
        <textarea
          {...register('description')}
          rows={3}
          onChange={(e) => {
            setValue('description', e.target.value);
            if (e.target.value.trim().length >= 8) {
              runAiTriage(e.target.value.trim(), true);
            }
          }}
          onBlur={() => {
            const val = watch('description');
            if (val && val.trim().length >= 5) {
              runAiTriage(val.trim(), true);
            }
          }}
          placeholder="Please describe the issue clearly (e.g., Water is dripping continuously from the bathroom sink pipe onto the cabinet floor in Battaramulla)..."
          className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 shadow-sm resize-y"
        />
        {errors.description && (
          <p className="text-xs text-rose-500">{errors.description.message}</p>
        )}

        {/* Quick sample scenario pills for 1-click test */}
        <div className="flex items-center gap-1.5 flex-wrap pt-1">
          <span className="text-[11px] font-bold text-gray-500 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-emerald-600" /> Quick Test:
          </span>
          {[
            { label: '🚰 Water Pipe Leak', text: 'Water pipe burst and leaking under bathroom sink onto floor' },
            { label: '⚡ Electrical Spark', text: 'Main power circuit breaker tripping and wall socket sparking' },
            { label: '❄️ AC Warm Air', text: 'Master bedroom air conditioning unit blowing warm air and humming' },
            { label: '🐜 Pest Infestation', text: 'Termites and pest infestation damaging wooden cabinets' },
            { label: '🚪 Broken Door Lock', text: 'Front entrance main door lock is jammed and latch broken' }
          ].map((sample) => (
            <button
              key={sample.label}
              type="button"
              onClick={() => {
                setValue('description', sample.text, { shouldValidate: true, shouldDirty: true });
                runAiTriage(sample.text, false);
              }}
              className="text-[11px] px-2.5 py-1 rounded-lg bg-gray-100 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 border border-gray-200 text-gray-700 font-medium transition-colors cursor-pointer"
            >
              {sample.label}
            </button>
          ))}
        </div>

        {/* Real-time Agent AI Status Indicator */}
        {isTriaging && (
          <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold flex items-center gap-2 animate-pulse">
            <Sparkles className="w-4 h-4 text-blue-600 animate-spin shrink-0" />
            <span>AI is analyzing the issue and matching the best technician from the database...</span>
          </div>
        )}

        {!isTriaging && assignedProvider && (
          <div className="p-4 rounded-2xl bg-linear-to-r from-emerald-50/80 to-teal-50/80 border border-emerald-200/80 shadow-xs space-y-3 animate-in fade-in">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shrink-0 shadow-xs">
                  <Wrench className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                      AI Matched Technician
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-100 text-blue-800 border border-blue-200">
                      ✓ Owner Database Provider
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-gray-900 truncate mt-0.5">
                    {assignedProvider.name}
                  </h4>
                </div>
              </div>

              {assignedProvider.contactNumber && (
                <a
                  href={`tel:${assignedProvider.contactNumber}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-emerald-200 text-emerald-700 text-xs font-bold hover:bg-emerald-50 transition-colors shadow-2xs"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>{assignedProvider.contactNumber}</span>
                </a>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-emerald-100 text-xs text-emerald-900">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-100/60 font-semibold">
                Trade: {assignedProvider.category || 'General'}
              </span>
              {assignedProvider.serviceArea && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-100/60 font-semibold">
                  <MapPin className="w-3 h-3 text-emerald-700" />
                  Area: {assignedProvider.serviceArea}
                </span>
              )}
            </div>

            {/* If multiple database technicians match this category, allow choosing */}
            {(() => {
              const matches = (ownerDbProviders || []).filter(p => {
                const pCat = (p.category || '').trim().toLowerCase();
                const cCat = (currentCategory || '').trim().toLowerCase();
                return pCat === cCat || pCat.includes(cCat) || cCat.includes(pCat) || (cCat.startsWith('applian') && pCat.startsWith('applian'));
              });
              if (matches.length > 1) {
                return (
                  <div className="pt-2.5 border-t border-emerald-100 flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-[11px] font-bold text-emerald-900">
                      Other Database Technicians for {currentCategory}:
                    </span>
                    <select
                      value={assignedProvider?.id || ''}
                      onChange={(e) => {
                        const chosen = matches.find(p => String(p.id) === e.target.value);
                        if (chosen) {
                          setAssignedProvider(chosen);
                          setValue('assignedServiceProviderId', chosen.id);
                          setValue('assignedProviderName', chosen.name);
                        }
                      }}
                      className="text-xs font-bold rounded-lg border border-emerald-300 bg-white px-2 py-1 text-emerald-900 shadow-2xs cursor-pointer"
                    >
                      {matches.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.serviceArea || 'General'})
                        </option>
                      ))}
                    </select>
                  </div>
                );
              }
              return null;
            })()}
          </div>
        )}

        {/* Unassigned Informational Notice when owner has not registered a provider in DB */}
        {!isTriaging && !assignedProvider && (
          <div className="p-3.5 rounded-2xl bg-amber-50/90 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5 animate-in fade-in">
            <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">No registered {currentCategory} service provider in owner's database.</p>
              <p className="text-[11px] text-amber-800 mt-0.5">
                The ticket will be submitted as <strong>Reported</strong> so the property owner can review the issue and assign a contractor manually.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* 4. Photo Upload & Evidence */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold uppercase tracking-wider text-gray-600 flex items-center gap-1.5">
            <Camera className="w-3.5 h-3.5 text-gray-500" />
            <span>Photo / Image Proof</span>
          </label>
          <span className="text-[11px] text-gray-400 font-medium">Upload file from device</span>
        </div>

        {/* Upload Dropzone / Camera selector */}
        <div className="space-y-2.5">
          {photoPreview ? (
            <div className="relative rounded-2xl overflow-hidden border border-gray-200 bg-gray-50 h-44 group shadow-xs">
              <img 
                src={photoPreview} 
                alt="Maintenance proof preview" 
                className="w-full h-full object-cover" 
                onError={() => setPhotoPreview('')}
              />
              <div className="absolute top-2.5 right-2.5 flex items-center gap-2">
                <label className="px-3 py-1.5 rounded-xl bg-black/70 hover:bg-black/85 text-white text-xs font-bold backdrop-blur-md cursor-pointer flex items-center gap-1.5 transition-all shadow-sm">
                  <Camera className="w-3.5 h-3.5" />
                  <span>Change</span>
                  <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setValue('photoUrl', '');
                    setPhotoPreview('');
                  }}
                  className="p-1.5 rounded-xl bg-rose-600/90 hover:bg-rose-700 text-white text-xs font-bold shadow-sm cursor-pointer"
                  title="Remove Photo"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <label className="border-2 border-dashed border-gray-300 hover:border-blue-500 hover:bg-blue-50/30 rounded-2xl p-5 flex flex-col items-center justify-center cursor-pointer transition-all group">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white flex items-center justify-center transition-all mb-2 shadow-2xs">
                <Upload className="w-6 h-6" />
              </div>
              <p className="text-sm font-bold text-gray-800">
                Click to upload photo or take picture
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                Supports PNG, JPG, JPEG, WEBP from your phone or computer
              </p>
              <input 
                type="file" 
                accept="image/*" 
                className="hidden" 
                onChange={handleFileChange} 
              />
            </label>
          )}

          {/* Hidden input to ensure photoUrl is registered with react-hook-form */}
          <input type="hidden" {...register('photoUrl')} />
        </div>
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