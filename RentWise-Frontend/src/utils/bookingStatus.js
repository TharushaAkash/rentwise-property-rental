import { useState, useEffect } from 'react';

export const BOOKINGS_UPDATED_EVENT = 'rentwise_bookings_updated';

/**
 * Dispatches a custom event to notify all listening components
 * across the application that a booking was added, updated, confirmed, or rejected.
 */
export const dispatchBookingsUpdated = () => {
  try {
    window.dispatchEvent(new CustomEvent(BOOKINGS_UPDATED_EVENT));
  } catch (e) {
    console.warn('Could not dispatch bookings updated event:', e);
  }
};

/**
 * Checks if a property currently has an active booking or lease.
 *
 * An active booking is any booking with status:
 * - 'Submitted'
 * - 'Pending'
 * - 'Accepted' / 'Confirmed'
 * 
 * If a booking was 'Rejected', 'Cancelled', or 'Expired', the property is available again.
 * If an active lease agreement exists (not 'Terminated' or 'Cancelled'), it is also considered booked/leased.
 *
 * @param {string|number} propertyId 
 * @param {Array} serverApplications - optional server-provided applications
 * @returns {{ isBooked: boolean, isPending: boolean, isLeased: boolean, booking: object | null, label: string }}
 */
export const getActiveBookingForProperty = (propertyId, serverApplications = []) => {
  if (!propertyId) {
    return { isBooked: false, isPending: false, isLeased: false, booking: null, label: 'Available' };
  }

  const pidStr = String(propertyId);

  // 1. Read local storage bookings
  let localBookings = [];
  try {
    localBookings = JSON.parse(localStorage.getItem('rentwise_client_bookings') || '[]');
  } catch (e) {
    localBookings = [];
  }

  // Combine server applications and local bookings (local takes priority for immediate feedback)
  const combinedBookings = [...localBookings, ...(Array.isArray(serverApplications) ? serverApplications : [])];

  // Find latest active booking for this property
  const activeBooking = combinedBookings.find((b) => {
    if (!b || String(b.propertyId) !== pidStr) return false;
    const status = (b.status || '').toLowerCase();
    return (
      status === 'submitted' ||
      status === 'pending' ||
      status === 'accepted' ||
      status === 'confirmed' ||
      status === 'approved'
    );
  });

  if (activeBooking) {
    const rawStatus = (activeBooking.status || '').toLowerCase();
    const isLeased = rawStatus === 'accepted' || rawStatus === 'confirmed' || rawStatus === 'approved';
    return {
      isBooked: true,
      isPending: !isLeased,
      isLeased: isLeased,
      booking: activeBooking,
      label: isLeased ? 'Leased / Booked' : 'Booking Pending'
    };
  }

  // 2. Check local storage agreements (active lease)
  try {
    const localAgreements = JSON.parse(localStorage.getItem('rentwise_client_agreements') || '[]');
    const activeAgreement = localAgreements.find((a) => {
      if (!a || String(a.propertyId) !== pidStr) return false;
      const status = (a.status || '').toLowerCase();
      return status !== 'terminated' && status !== 'cancelled' && status !== 'expired';
    });

    if (activeAgreement) {
      const isDraft = (activeAgreement.status || '').toLowerCase() === 'drafted';
      return {
        isBooked: true,
        isPending: isDraft,
        isLeased: !isDraft,
        booking: activeAgreement,
        label: isDraft ? 'Booking Pending' : 'Leased'
      };
    }
  } catch (e) {
    // Ignore storage parse error
  }

  return {
    isBooked: false,
    isPending: false,
    isLeased: false,
    booking: null,
    label: 'Available'
  };
};

/**
 * React hook that returns live booking status for a given propertyId
 * and automatically updates when bookings are created, confirmed, or rejected.
 */
export const usePropertyBookingStatus = (propertyId, serverApplications = []) => {
  const [statusInfo, setStatusInfo] = useState(() =>
    getActiveBookingForProperty(propertyId, serverApplications)
  );

  useEffect(() => {
    const update = () => {
      setStatusInfo(getActiveBookingForProperty(propertyId, serverApplications));
    };

    update();

    window.addEventListener(BOOKINGS_UPDATED_EVENT, update);
    window.addEventListener('storage', update);

    return () => {
      window.removeEventListener(BOOKINGS_UPDATED_EVENT, update);
      window.removeEventListener('storage', update);
    };
  }, [propertyId, serverApplications]);

  return statusInfo;
};

