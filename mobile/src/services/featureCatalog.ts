export type FeatureStatus = 'REAL' | 'PREVIEW' | 'COMING SOON';
export const GARDEN_FEATURES = [
  { id: 'garden', label: 'Garden', status: 'REAL', route: '/', backend: 'GET /users/:id/garden', icon: { ios: 'leaf.fill', android: 'local_florist', web: 'local_florist' } },
  { id: 'events', label: 'Events / Flowers', status: 'REAL', route: '/journal', backend: 'POST /events; GET /events/:id; Garden', icon: { ios: 'book.fill', android: 'menu_book', web: 'menu_book' } },
  { id: 'daily', label: 'Daily', status: 'COMING SOON', route: '/feature/daily', backend: 'Not connected', icon: { ios: 'sun.max.fill', android: 'wb_sunny', web: 'wb_sunny' } },
  { id: 'friends', label: 'Friends', status: 'REAL', route: '/feature/friends', backend: 'Existing friend search, lists, requests and removal APIs', icon: { ios: 'person.2.fill', android: 'group', web: 'group' } },
  { id: 'visit', label: 'Visit', status: 'COMING SOON', route: '/feature/visit', backend: 'Not connected', icon: { ios: 'house.fill', android: 'home', web: 'home' } },
  { id: 'fairy', label: 'Fairy', status: 'COMING SOON', route: '/feature/fairy', backend: 'Not connected', icon: { ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' } },
  { id: 'profile', label: 'Profile', status: 'PREVIEW', route: '/feature/profile', backend: 'Hydrated GET /session (read only)', icon: { ios: 'person.crop.circle.fill', android: 'account_circle', web: 'account_circle' } },
  { id: 'weekly', label: 'Weekly', status: 'COMING SOON', route: '/feature/weekly', backend: 'Not connected', icon: { ios: 'calendar', android: 'date_range', web: 'date_range' } },
  { id: 'monthly', label: 'Monthly', status: 'COMING SOON', route: '/feature/monthly', backend: 'Not connected', icon: { ios: 'calendar.circle.fill', android: 'calendar_month', web: 'calendar_month' } },
  { id: 'settings', label: 'Settings', status: 'PREVIEW', route: '/feature/settings', backend: 'Hydrated GET /session; real Firebase logout', icon: { ios: 'gearshape.fill', android: 'settings', web: 'settings' } },
] as const;
export function gardenFeature(id: string | undefined) { return GARDEN_FEATURES.find(feature => feature.id === id); }
