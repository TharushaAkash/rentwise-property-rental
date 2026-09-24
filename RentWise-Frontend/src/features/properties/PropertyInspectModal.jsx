import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { 
  Building2, 
  MapPin, 
  Eye, 
  Pencil, 
  FileText, 
  ShieldCheck, 
  Check, 
  ArrowRight, 
  Clock, 
  Lock, 
  ExternalLink,
  DollarSign,
  AlertCircle,
  CheckCheck,
  Zap
} from 'lucide-react';
import { PROPERTY_PLACEHOLDER_IMAGE, handleImageError } from '../../utils/imagePlaceholder';
import { getActiveBookingForProperty } from '../../utils/bookingStatus';
import { evaluatePropertyVerification } from '../../utils/addressVerification';

const formatMoney = (val) => `LKR ${Number(val || 0).toLocaleString()}`;

export function PropertyInspectModal({
  property,
  isOpen,
  onClose,
  onEdit = null,
  onApply = null,
  user = null
}) {
  const navigate = useNavigate();
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);

  useEffect(() => {
    setActivePhotoIndex(0);
  }, [property]);

  if (!property) return null;

  const propId = property.id || property.Id;
  const propTitle = property.title || property.Title || 'Untitled Property';
  const propAddress = property.address || property.Address || property.city || 'Sri Lanka';
  const propRent = property.monthlyRent ?? property.MonthlyRent ?? 0;
  const propBedrooms = property.bedrooms ?? property.Bedrooms ?? 0;
  const propBathrooms = property.bathrooms ?? property.Bathrooms ?? 0;
  const propSqft = property.sqft ?? property.Sqft;
  const propType = property.propertyType || property.PropertyType || 'House';
  const propDesc = property.description || property.Description || 'No description provided.';
  
  // Facilities
  const rawFacilities = property.facilities || property.Facilities || [];
  const facList = Array.isArray(rawFacilities) 
    ? rawFacilities 
    : (typeof rawFacilities === 'string' ? rawFacilities.split(',').map(s => s.trim()).filter(Boolean) : []);

  // Feature Tags
  const featureTags = Array.isArray(property.featureTags || property.FeatureTags)
    ? (property.featureTags || property.FeatureTags)
    : [];

  // Status computation
  const rawStatus = property.status ?? property.Status;
  let statusStr = typeof rawStatus === 'number'
    ? ['PendingVerification', 'Active', 'Suspended'][rawStatus]
    : (rawStatus || 'Active');

  const bookingInfo = getActiveBookingForProperty(propId);
  const isLeased = bookingInfo?.isLeased || statusStr === 'Leased';
  const isPendingBooking = bookingInfo?.isBooked && !isLeased;

  // Photos
  let photos = [];
  if (Array.isArray(property.photos) && property.photos.length > 0) {
    photos = property.photos.map(ph => typeof ph === 'string' ? ph : (ph?.photoUrl || ph?.PhotoUrl || ph?.url)).filter(Boolean);
  } else if (property.photoUrl || property.PhotoUrl) {
    photos = [property.photoUrl || property.PhotoUrl];
  } else {
    photos = [PROPERTY_PLACEHOLDER_IMAGE];
  }

  // Utility Bill Document & Verification
  const docs = Array.isArray(property.documents) ? property.documents : [];
  const utilityDoc = docs.find(d => d?.documentType === 'UtilityBill' || d?.documentType === 'OwnershipProof') || 
                    (property.utilityBillUrl ? { documentType: 'UtilityBill', documentUrl: property.utilityBillUrl } : null);
  const verification = evaluatePropertyVerification(property);

  const canEdit = Boolean(onEdit) || (user?.role === 'PropertyOwner' && (!property.ownerId || property.ownerId === user?.id)) || user?.role === 'Administrator';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Property Inspection: ${propTitle}`}
      className="max-w-4xl"
    >
      <div className="space-y-6 text-sm text-gray-700 p-1">
        {/* Top Bar: Verification / Status & Controls */}
        <div className="bg-slate-900 text-white p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm border border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 flex items-center justify-center shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">
                  Listing Inspection
                </span>
                <span className={`px-2.5 py-0.5 rounded-full text-[10.5px] font-extrabold ${
                  isLeased
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    : isPendingBooking
                    ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                    : statusStr === 'Active'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : statusStr === 'Suspended'
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse'
                }`}>
                  {isLeased ? 'Leased' : isPendingBooking ? 'Booking Pending' : statusStr === 'Active' ? 'Live on Marketplace' : statusStr}
                </span>
              </div>
              <span className="text-xs text-slate-300 font-mono">ID: {propId}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {canEdit && (
              <Button
                size="sm"
                onClick={() => {
                  if (onEdit) {
                    onClose();
                    onEdit(property);
                  } else {
                    onClose();
                    navigate('/properties');
                  }
                }}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Pencil className="w-3.5 h-3.5" />
                <span>Edit Listing</span>
              </Button>
            )}
          </div>
        </div>

        {/* Photo Gallery with Hero View & Thumbnails */}
        {photos.length > 0 ? (
          <div className="space-y-2">
            <div className="relative h-64 sm:h-72 rounded-2xl overflow-hidden border border-gray-200 bg-gray-100 shadow-2xs">
              <img
                src={photos[activePhotoIndex] || photos[0]}
                alt={propTitle}
                onError={handleImageError}
                className="w-full h-full object-cover"
              />
              <div className="absolute top-3 left-3 px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur-xs text-white text-xs font-bold flex items-center gap-1">
                <Eye className="w-3.5 h-3.5" />
                <span>Photo {activePhotoIndex + 1} of {photos.length}</span>
              </div>
            </div>

            {photos.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {photos.map((url, idx) => (
                  <img
                    key={idx}
                    src={url}
                    alt={`Photo thumbnail ${idx + 1}`}
                    onClick={() => setActivePhotoIndex(idx)}
                    onError={handleImageError}
                    className={`w-20 h-14 object-cover rounded-lg border-2 cursor-pointer transition-all shrink-0 ${
                      activePhotoIndex === idx 
                        ? 'border-indigo-600 ring-2 ring-indigo-400' 
                        : 'border-gray-200 opacity-70 hover:opacity-100'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="h-40 rounded-2xl bg-gray-50 border border-dashed border-gray-200 flex flex-col items-center justify-center text-gray-400 gap-1">
            <Building2 className="w-8 h-8" />
            <span className="text-xs">No photos attached to this property</span>
          </div>
        )}

        {/* Pricing & Key Specs Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-200">
            <span className="text-[11px] font-semibold text-gray-500 block">Monthly Rent</span>
            <span className="text-base font-black text-gray-900">{formatMoney(propRent)}</span>
          </div>
          <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-200">
            <span className="text-[11px] font-semibold text-gray-500 block">Floor Area</span>
            <span className="text-sm font-bold text-gray-900">
              {propSqft ? `${Number(propSqft).toLocaleString()} sqft` : '1,200 sqft'}
            </span>
          </div>
          <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-200">
            <span className="text-[11px] font-semibold text-gray-500 block">Bedrooms / Baths</span>
            <span className="text-sm font-bold text-gray-900">
              {propBedrooms} Bed • {propBathrooms} Bath
            </span>
          </div>
          <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-200">
            <span className="text-[11px] font-semibold text-gray-500 block">Property Type</span>
            <span className="text-sm font-bold text-indigo-700">{propType}</span>
          </div>
        </div>

        {/* Feature Tags (if any) */}
        {featureTags.length > 0 && (
          <div className="p-3.5 bg-indigo-50/50 rounded-xl border border-indigo-100 flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-indigo-900 mr-1">Highlights:</span>
            {featureTags.map((tag, tIdx) => (
              <span key={tIdx} className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-white text-indigo-800 border border-indigo-200 shadow-2xs">
                ✓ {typeof tag === 'string' ? tag : tag.name || JSON.stringify(tag)}
              </span>
            ))}
          </div>
        )}

        {/* Utility Bill section removed as requested */}

        {/* Address & Description */}
        <div className="p-4 bg-white rounded-2xl border border-gray-200 space-y-2">
          <div className="flex items-center gap-1.5 text-xs text-gray-600 font-semibold">
            <MapPin className="w-4 h-4 text-gray-400 shrink-0" />
            <span>{propAddress}</span>
          </div>
          <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-line">
            {propDesc}
          </p>
          {facList.length > 0 && (
            <div className="pt-2 border-t border-gray-100">
              <span className="text-[11px] font-bold text-gray-500 block mb-1">Facilities & Amenities:</span>
              <div className="flex flex-wrap gap-1.5">
                {facList.map((f, i) => (
                  <span key={i} className="px-2.5 py-1 rounded-lg bg-gray-100 text-gray-700 text-xs font-medium">
                    {typeof f === 'string' ? f.trim() : JSON.stringify(f)}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Action Buttons */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-gray-100">
          <button
            type="button"
            onClick={() => {
              onClose();
              navigate(`/properties/${propId}`);
            }}
            className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
          >
            <span>View Full Public Listing Page</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </button>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            {onApply && !isLeased && (
              <Button
                size="sm"
                onClick={() => {
                  onClose();
                  onApply(property);
                }}
                className="bg-[#1a2e35] hover:bg-[#132329] text-white font-bold text-xs"
              >
                Book / Apply
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
            >
              Close
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

