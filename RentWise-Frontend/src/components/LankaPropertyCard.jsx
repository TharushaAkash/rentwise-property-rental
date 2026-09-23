import React from 'react';
import { Camera, MapPin, Star, Clock, Lock } from 'lucide-react';
import { formatLankaPrice } from '../data/lankaProperties';
import { PROPERTY_PLACEHOLDER_IMAGE, handleImageError } from '../utils/imagePlaceholder';
import { getActiveBookingForProperty } from '../utils/bookingStatus';

export const LankaPropertyCard = ({
  property,
  isSaved = false,
  onToggleSave,
  onSelect,
  onBook,
  actionButtonText = 'View & Book',
  isPending: propIsPending
}) => {
  const bookingInfo = getActiveBookingForProperty(property?.id);
  const isPending = propIsPending !== undefined ? propIsPending : bookingInfo.isBooked;
  const primaryFromList = property.photos && Array.isArray(property.photos) && property.photos.length > 0
    ? (property.photos.find((p) => p.isPrimary || p.IsPrimary)?.photoUrl || 
       property.photos.find((p) => p.isPrimary || p.IsPrimary)?.PhotoUrl || 
       property.photos[0]?.photoUrl || 
       property.photos[0]?.PhotoUrl || 
       property.photos[0]?.url)
    : null;

  const photoSrc = property.photoUrl || property.PhotoUrl || primaryFromList || PROPERTY_PLACEHOLDER_IMAGE;
  const count = property.photoCount ?? property.PhotoCount ?? property.photosCount ?? property.photos?.length ?? (primaryFromList || property.photoUrl ? 1 : 0);

  const sqftVal = property.sqft ?? property.Sqft;
  const sqftFormatted = sqftVal
    ? `${Number(sqftVal).toLocaleString()} sqft`
    : `${(property.bedrooms || 3) * 800} sqft`;

  const handleCardClick = () => {
    if (onSelect) onSelect(property);
  };

  const handleActionClick = (e) => {
    e.stopPropagation();
    if (onBook) {
      onBook(property);
    } else if (onSelect) {
      onSelect(property);
    }
  };

  return (
    <div 
      onClick={handleCardClick}
      className="rounded-lg bg-white border border-gray-200 overflow-hidden shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between group cursor-pointer"
    >
      <div>
        {/* Photo Container */}
        <div className="relative h-52 sm:h-56 bg-gray-100 overflow-hidden">
          <img
            src={photoSrc}
            alt={property.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 cursor-pointer"
            onClick={() => onSelect && onSelect(property)}
            onError={handleImageError}
          />

          {/* Top-Left: Photos Count Badge */}
          <div className="absolute top-2.5 left-2.5 bg-black/65 backdrop-blur-xs text-white text-[11px] font-bold px-2 py-0.5 rounded flex items-center gap-1 shadow-xs">
            <Camera className="w-3 h-3" />
            <span>{count > 0 ? count : 1}</span>
          </div>

          {/* Top-Right: Pending Badge, AI Match Badge, or Urgent Badge */}
          {isPending ? (
            <div className="absolute top-2.5 right-2.5 bg-amber-500 text-white text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded shadow-sm flex items-center gap-1 z-10 animate-in fade-in">
              <Clock className="w-3 h-3" />
              <span>{bookingInfo.isLeased ? 'Leased' : 'Pending'}</span>
            </div>
          ) : property.aiMatchPercentage ? (
            <div className="absolute top-2.5 right-2.5 bg-gradient-to-r from-violet-600 via-indigo-600 to-blue-600 text-white text-[10.5px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full shadow-md flex items-center gap-1 border border-white/20 animate-in fade-in">
              <span className="text-amber-300">✨</span>
              <span>{property.aiMatchPercentage}% Match</span>
            </div>
          ) : property.isUrgent ? (
            <div className="absolute top-2.5 right-2.5 bg-[#b91c1c] text-white text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded shadow-sm animate-pulse">
              URGENT
            </div>
          ) : null}

          {/* Bottom-Right: City / Area Location Chip */}
          <div className="absolute bottom-2.5 right-2.5 bg-black/75 backdrop-blur-xs text-white text-xs font-bold px-2.5 py-0.5 rounded shadow-xs">
            {property.city || property.address?.split(',').pop()?.trim() || 'Colombo'}
          </div>
        </div>

        {/* Specs Row: Beds, Sqft, Type, Star */}
        <div className="flex items-center justify-between px-3.5 pt-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-gray-700">
            <span className="flex items-center gap-1">
              <span>🛏️</span>
              <span>{property.bedrooms || 3}</span>
            </span>
            <span className="text-gray-300">•</span>
            <span className="flex items-center gap-1">
              <span>📐</span>
              <span>{sqftFormatted}</span>
            </span>
            <span className="ml-1 inline-block border border-[#008037] text-[#008037] text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50/40">
              {property.propertyType || 'House'}
            </span>
          </div>

          {/* Star Favorite Toggle */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleSave && onToggleSave(property.id, e);
            }}
            title={isSaved ? 'Remove from saved' : 'Save this property'}
            className="p-1 text-gray-400 hover:text-amber-500 transition-colors"
          >
            <Star
              className={`w-4 h-4 ${
                isSaved ? 'fill-amber-400 text-amber-400' : 'text-gray-400 hover:text-amber-400'
              }`}
            />
          </button>
        </div>

        {/* Price Row (Bold Emerald Green) */}
        <div className="px-3.5 pt-1.5 flex items-baseline gap-1">
          <span className="text-xl sm:text-2xl font-black text-[#008037] tracking-tight">
            {formatLankaPrice(property.monthlyRent)}
          </span>
          <span className="text-xs text-gray-500 font-medium">Per Month</span>
        </div>

        {/* Title (Blue, Clickable) */}
        <div className="px-3.5 pt-1">
          <h3
            onClick={() => onSelect && onSelect(property)}
            className="text-sm font-bold text-[#0066cc] hover:underline cursor-pointer line-clamp-2 leading-snug"
          >
            {property.title}
          </h3>
        </div>

        {/* Address with Pin Icon */}
        <div className="px-3.5 pt-1 flex items-center gap-1 text-xs text-gray-800 font-semibold truncate">
          <MapPin className="w-3.5 h-3.5 text-gray-900 shrink-0" />
          <span className="truncate">{property.address}</span>
        </div>

        {/* Description Snippet */}
        <div className="px-3.5 pt-1 text-[11px] text-gray-500 line-clamp-2 leading-relaxed">
          {property.description}
          <span
            onClick={() => onSelect && onSelect(property)}
            className="text-[#0066cc] font-bold hover:underline cursor-pointer ml-1"
          >
            more &gt;
          </span>
        </div>
      </div>

      {/* Card Footer */}
      <div className="px-3.5 py-2.5 mt-3 border-t border-gray-100 flex items-center justify-between text-xs bg-gray-50/50">
        <div className="text-[11px] font-bold text-emerald-700 flex items-center gap-1 truncate max-w-[160px]">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 inline-block shrink-0" />
          <span className="truncate" title={(property.featureTags && property.featureTags.length > 0 ? property.featureTags[0] : null) || property.aiReasons?.[0] || property.featureTag || 'Verified Listing'}>
            {(property.featureTags && property.featureTags.length > 0 ? property.featureTags[0] : null) || property.aiReasons?.[0] || property.featureTag || 'Luxury Specs'}
          </span>
        </div>

        {isPending ? (
          <button
            type="button"
            disabled
            title="This property currently has a pending booking and cannot be booked by another applicant."
            className="bg-amber-100 border border-amber-300 text-amber-900 text-xs font-bold px-3 py-1.5 rounded cursor-not-allowed flex items-center gap-1 shadow-xs"
          >
            <Lock className="w-3.5 h-3.5 text-amber-700" />
            <span>{bookingInfo.isLeased ? 'Leased' : 'Booking Pending'}</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={handleActionClick}
            className="bg-[#ff5a00] hover:bg-[#e04f00] text-white text-xs font-bold px-3 py-1.5 rounded shadow-xs transition-all active:scale-95 cursor-pointer"
          >
            {actionButtonText}
          </button>
        )}
      </div>
    </div>
  );
};

