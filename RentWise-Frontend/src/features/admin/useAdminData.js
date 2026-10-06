import { useQueryClient } from '@tanstack/react-query';
import { useFetch } from '../../hooks/useFetch';

const EMPTY = [];
export function useAdminData() {
  const client = useQueryClient();
  const properties = useFetch('/properties');
  const users = useFetch('/auth/users');
  const agreements = useFetch('/agreements');
  const applications = useFetch('/property-applications');
  const list = query => Array.isArray(query.data) ? query.data : EMPTY;
  const update = url => updater => client.setQueryData(['api', url], current =>
    typeof updater === 'function' ? updater(Array.isArray(current) ? current : []) : updater);
  return {
    properties: list(properties), setProperties: update('/properties'),
    usersList: list(users), setUsersList: update('/auth/users'),
    agreements: list(agreements), applications: list(applications), setApplications: update('/property-applications'),
    isLoadingProps: properties.isLoading, isLoadingUsers: users.isLoading,
    isLoadingAgreements: agreements.isLoading || applications.isLoading,
    fetchAllProperties: properties.refetch, fetchAllUsers: users.refetch,
    fetchAgreementsAndApplications: () => Promise.all([agreements.refetch(), applications.refetch()]),
    error: [properties.error, users.error, agreements.error, applications.error].filter(Boolean).join(' '),
  };
}
