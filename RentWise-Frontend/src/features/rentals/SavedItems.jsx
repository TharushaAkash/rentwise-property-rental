import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, MapPin, Home, Trash2, ArrowRight, Search, Building2, Sparkles, Bed, Bath, Maximize, Clock, Lock, Eye } from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import { BookingModal } from '../tenants/BookingModal';
import { PropertyInspectModal } from '../properties/PropertyInspectModal';
import { PROPERTY_PLACEHOLDER_IMAGE, handleImageError } from '../../utils/imagePlaceholder';
import { getActiveBookingForProperty, BOOKINGS_UPDATED_EVENT } from '../../utils/bookingStatus';

export const SavedItems = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [savedProperties, setSavedProperties] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [bookingProperty, setBookingProperty] = useState(null);
  const [inspectingProperty, setInspectingProperty] = useState(null);
  const [toastMessage, setToastMessage] = useState('');
  const [bookingVersion, setBookingVersion] = useState(0);

  // Load saved properties from localStorage & backend
  const loadSaved = async () => {
    setIsLoading(true);
    try {
      let stored = JSON.parse(localStorage.getItem('rentwise_saved_properties') || '[]');
      let allProps = [];
      try {
        const res = await api.get('/properties');
        allProps = res.data || [];
      } catch (err) {
        console.warn('Could not fetch properties for enrichment', err);
      }

      // If logged in, fetch from backend and merge
      if (user?.id) {
        try {
          const dbSavedRes = await api.get(`/saved-properties/${user.id}`);
          if (dbSavedRes.data && Array.isArray(dbSavedRes.data)) {
            const dbIds = dbSavedRes.data.map(sp => sp.propertyId);
            
            // Merge local and db IDs, unique them
            const localIds = stored.map(p => typeof p === 'string' ? p : p.id).filter(id => id);
            const combinedIds = [...new Set([...localIds, ...dbIds])];
            
            // Update stored array
            stored = combinedIds;
            localStorage.setItem('rentwise_saved_properties', JSON.stringify(stored));
            window.dispatchEvent(new Event('rentwise_saved_updated'));
          }
        } catch (err) {
          console.warn('Could not fetch saved properties from DB', err);
        }
      }

      if (Array.isArray(stored)) {
        // Enrich strings (IDs) with full property objects if possible
        const enriched = stored.map(p => {
          if (typeof p === 'string') {
            const matched = allProps.find(ap => ap.id === p);
            return matched || p;
          }
          return p;
        });

        // Filter out mock samples
        const realProperties = enriched.filter((p) => {
          const id = typeof p === 'string' ? p : p?.id;
          return id && !id.toString().startsWith('sample-');
        });

        setSavedProperties(realProperties);
      }
    } catch {
      setSavedProperties([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSaved();

    const handleStorage = () => loadSaved();
    const handleBookingUpdate = () => setBookingVersion((v) => v + 1);

    window.addEventListener('storage', handleStorage);
    window.addEventListener('rentwise_saved_updated', handleStorage);
    window.addEventListener(BOOKINGS_UPDATED_EVENT, handleBookingUpdate);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('rentwise_saved_updated', handleStorage);
      window.removeEventListener(BOOKINGS_UPDATED_EVENT, handleBookingUpdate);
    };
  }, []);

  // Remove a single property from saved
  const handleRemove = (propertyId, e) => {
    if (e) e.stopPropagation();
    try {
      const updated = savedProperties.filter((p) => (typeof p === 'string' ? p !== propertyId : p.id !== propertyId));
      localStorage.setItem('rentwise_saved_properties', JSON.stringify(updated));
      setSavedProperties(updated);
      window.dispatchEvent(new Event('rentwise_saved_updated'));
      setToastMessage('Item removed from your saved list.');
      setTimeout(() => setToastMessage(''), 2500);

      // Background API sync
      if (user?.id && !propertyId.toString().startsWith('sample-')) {
        api.delete(`/saved-properties/${user.id}/${propertyId}`).catch(() => {});
      }
    } catch (err) {
      console.error('Failed to remove saved property', err);
    }
  };

  // Clear all saved items
  const handleClearAll = () => {
    if (!window.confirm('Are you sure you want to clear all your saved properties?')) return;
    localStorage.removeItem('rentwise_saved_properties');
    setSavedProperties([]);
    window.dispatchEvent(new Event('rentwise_saved_updated'));
    setToastMessage('All saved items cleared.');
    setTimeout(() => setToastMessage(''), 2500);
  };

  return (
    <div className="font-sans space-y-8 pb-16 animate-in fade-in duration-300 max-w-7xl mx-auto px-2 sm:px-4">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white text-xs font-semibold px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <Heart className="w-4 h-4 text-rose-500 fill-rose-500" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2 border-b border-gray-100 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
              <Heart className="w-4 h-4 fill-rose-500 text-rose-500" />
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-rose-600 bg-rose-50 px-2.5 py-0.5 rounded-full border border-rose-100">
              Wishlist & Favourites
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-gray-900 tracking-tight">
            Saved Properties
          </h1>
          <p className="text-gray-500 text-sm font-normal mt-1">
            Review your bookmarked rental homes, compare options, and submit lease inquiries.
          </p>
        </div>

        {savedProperties.length > 0 && (
          <div className="flex items-center gap-3 self-start sm:self-auto">
            <span className="text-xs font-bold text-gray-500 bg-gray-100 px-3 py-1.5 rounded-lg">
              {savedProperties.length} {savedProperties.length === 1 ? 'saved item' : 'saved items'}
            </span>
            <button
              onClick={handleClearAll}
              className="text-xs font-semibold text-rose-600 hover:text-rose-800 hover:underline px-2 py-1 cursor-pointer"
            >
              Clear All
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="py-24 text-center text-gray-400 font-medium">
          Loading your saved homes...
        </div>
      ) : savedProperties.length === 0 ? (
        /* Empty State */
        <div className="py-20 text-center bg-white rounded-3xl border border-dashed border-gray-300 p-8 max-w-xl mx-auto shadow-2xs">
          <div className="w-16 h-16 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center mx-auto mb-4">
            <Heart className="w-8 h-8 fill-rose-100 text-rose-400" />
          </div>
          <h3 className="text-xl font-bold text-gray-900">No saved properties yet</h3>
          <p className="text-sm text-gray-500 mt-2 max-w-sm mx-auto leading-relaxed">
            Click the heart icon on any property in <span className="font-semibold text-gray-700">Find Rentals</span> to save homes you love and review them here.
          </p>
          <div className="mt-6">
            <button
              onClick={() => navigate('/find-rentals')}
              className="inline-flex items-center gap-2 bg-[#1a2e35] hover:bg-[#132329] text-white text-sm font-bold px-6 py-3 rounded-xl shadow-sm transition-all active:scale-95 cursor-pointer"
            >
              <Search className="w-4 h-4" />
              <span>Explore Find Rentals</span>
              <ArrowRight className="w-4 h-4 ml-1" />
            </button>
          </div>
        </div>
      ) : (
        /* Grid of Saved Properties */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {savedProperties.map((property) => {
            const propId = property.id || property;
            const title = property.title || `Property #${String(propId).slice(0, 8)}`;
            const photoUrl = property.photoUrl || property.PhotoUrl || PROPERTY_PLACEHOLDER_IMAGE;
            const rent = Number(property.monthlyRent || 0);
            const bookingInfo = getActiveBookingForProperty(propId);
            const isPending = bookingInfo.isBooked;
            const rawStatus = property.status ?? property.Status;
            const statusStr = typeof rawStatus === 'number' 
              ? ['PendingVerification', 'Active', 'Suspended'][rawStatus] 
              : (rawStatus || 'Active');
            const isActiveByAdmin = statusStr === 'Active';

            return (
              <div
                key={propId}
                onClick={() => setInspectingProperty(property)}
                className="group bg-white rounded-2xl overflow-hidden border border-gray-200/90 shadow-xs hover:shadow-xl transition-all duration-300 flex flex-col cursor-pointer"
              >
                {/* Image */}
                <div className="relative aspect-[4/3] w-full overflow-hidden bg-gray-100">
                  <img
                    src={photoUrl}
                    alt={title}
                    onError={handleImageError}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />

                  {/* Badge */}
                  <div className="absolute top-3 left-3 flex items-center gap-1.5 flex-wrap">
                    {property.propertyType && (
                      <span className="inline-block bg-white/95 text-gray-900 text-[11px] font-bold px-3 py-1 rounded-md shadow-xs backdrop-blur-xs">
                        {property.propertyType}
                      </span>
                    )}
                    {!isActiveByAdmin && (
                      <span className="inline-flex items-center gap-1 bg-amber-500 text-white text-[10.5px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md shadow-sm">
                        <Clock className="w-3 h-3" />
                        <span>Not Active by Admin</span>
                      </span>
                    )}
                    {isPending && (
                      <span className="inline-flex items-center gap-1 bg-amber-500 text-white text-[10.5px] font-black uppercase tracking-wider px-2.5 py-1 rounded-md shadow-sm animate-in fade-in">
                        <Clock className="w-3 h-3" />
                        <span>{bookingInfo.isLeased ? 'Leased' : 'Pending'}</span>
                      </span>
                    )}
                  </div>

                  {/* Remove Button (Heart with filled rose) */}
                  <button
                    type="button"
                    onClick={(e) => handleRemove(propId, e)}
                    title="Remove from saved items"
                    className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white/95 hover:bg-white text-rose-500 shadow-md flex items-center justify-center transition-transform active:scale-90 hover:scale-110 cursor-pointer"
                  >
                    <Heart className="w-4 h-4 fill-rose-500 text-rose-500" />
                  </button>
                </div>

                {/* Details */}
                <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                  <div>
                    {/* Price */}
                    <div className="text-xl font-black text-gray-900 tracking-tight">
                      LKR {rent.toLocaleString()}
                      <span className="text-xs font-normal text-gray-500 ml-1">/ month</span>
                    </div>

                    {/* Title */}
                    <h3 className="font-bold text-gray-900 text-base mt-1 line-clamp-1 group-hover:text-emerald-700 transition-colors">
                      {title}
                    </h3>

                    {/* Address */}
                    {property.address && (
                      <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
                        <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        <span className="truncate">{property.address}</span>
                      </div>
                    )}

                    {/* Specs */}
                    {(property.bedrooms || property.bathrooms || property.sqft || isPending || !isActiveByAdmin) && (
                      <div className="flex items-center justify-between text-xs text-gray-600 font-medium mt-3 pt-3 border-t border-gray-100 flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          {property.bedrooms && <span>{property.bedrooms} Beds</span>}
                          {property.bathrooms && (
                            <>
                              <span>•</span>
                              <span>{property.bathrooms} Baths</span>
                            </>
                          )}
                          {property.sqft && (
                            <>
                              <span>•</span>
                              <span>{Number(property.sqft).toLocaleString()} sqft</span>
                            </>
                          )}
                        </div>
                        {!isActiveByAdmin && (
                          <span className="text-amber-800 font-bold bg-amber-50 border border-amber-300 px-2 py-0.5 rounded text-[10px] flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5 text-amber-600" />
                            <span>Awaiting Admin Approval</span>
                          </span>
                        )}
                        {isPending && (
                          <span className="text-amber-800 font-bold bg-amber-50 border border-amber-200 px-2 py-0.5 rounded text-[10px]">
                            {bookingInfo.isLeased ? 'Leased' : 'Pending Review'}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="pt-2 flex items-center gap-2">
                    {isPending ? (
                      <button
                        type="button"
                        disabled
                        title="This property currently has a pending booking and cannot be booked by another applicant."
                        className="flex-1 bg-amber-100 border border-amber-300 text-amber-900 text-xs font-bold py-2.5 rounded-lg cursor-not-allowed text-center flex items-center justify-center gap-1 shadow-xs"
                      >
                        <Lock className="w-3.5 h-3.5 text-amber-700" />
                        <span>{bookingInfo.isLeased ? 'Leased' : 'Booking Pending'}</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setBookingProperty(property);
                        }}
                        className="flex-1 bg-[#1a2e35] hover:bg-[#132329] text-white text-xs font-bold py-2.5 rounded-lg shadow-xs transition-colors cursor-pointer text-center"
                      >
                        Book / Apply
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setInspectingProperty(property);
                      }}
                      className="px-3.5 py-2.5 rounded-lg border border-indigo-200 text-xs font-bold text-indigo-700 bg-indigo-50/70 hover:bg-indigo-100 transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
                      title="Inspect Property Details"
                    >
                      <Eye className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Details</span>
                    </button>

                    <button
                      type="button"
                      onClick={(e) => handleRemove(propId, e)}
                      className="px-3 py-2.5 rounded-lg border border-gray-200 text-gray-400 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50 transition-colors cursor-pointer"
                      title="Remove from saved"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Booking Modal */}
      {bookingProperty && (
        <BookingModal
          isOpen={Boolean(bookingProperty)}
          onClose={() => setBookingProperty(null)}
          property={bookingProperty}
          onSuccess={() => {
            setBookingProperty(null);
            setToastMessage('Booking request sent successfully!');
            setTimeout(() => setToastMessage(''), 3000);
          }}
        />
      )}

      {/* Property Inspection Modal */}
      <PropertyInspectModal
        isOpen={Boolean(inspectingProperty)}
        onClose={() => setInspectingProperty(null)}
        property={inspectingProperty}
        user={user}
        onApply={(prop) => {
          setBookingProperty(prop);
        }}
      />
    </div>
  );
};
export default SavedItems;

