import { apiRequest, ApiError } from './api';

export type GardenVisitAccess = 'allowed' | 'denied' | 'unavailable';
// Permission metadata only; never fetch Garden contents to determine access.
export async function gardenVisitAccess(ownerId: string): Promise<GardenVisitAccess> {
  try {
    const access = await apiRequest<{ canVisit: boolean }>(`/users/${encodeURIComponent(ownerId)}/garden-access`);
    return access.canVisit === true ? 'allowed' : access.canVisit === false ? 'denied' : 'unavailable';
  } catch (error) {
    if (error instanceof ApiError && [403, 404].includes(error.status)) return 'denied';
    return 'unavailable';
  }
}
export interface GardenPrivacy { allowGardenVisits: boolean }
export const loadGardenPrivacy = () => apiRequest<GardenPrivacy>('/users/me/garden-privacy');
export const saveGardenPrivacy = (allowGardenVisits: boolean) =>
  apiRequest<GardenPrivacy>('/users/me/garden-privacy', 'PATCH', { allowGardenVisits });
export const startGardenVisit = (hostUserId: string) => apiRequest('/visit', 'POST', { hostUserId });
export const leaveGardenVisit = (hostUserId: string) => apiRequest('/leave', 'POST', { hostUserId });
