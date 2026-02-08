/**
 * Shared test configuration and helpers.
 *
 * Keep credentials / URLs here so they are easy to swap
 * when running against different environments.
 */
export const config = {
  /** Default admin credentials seeded on first run */
  admin: {
    username: 'admin',
    password: 'admin',
  },

  /** localStorage keys used by the frontend auth layer */
  storageKeys: {
    accessToken: 'mc_access_token',
    refreshToken: 'mc_refresh_token',
    user: 'mc_user',
  },

  /** Well-known routes */
  routes: {
    login: '/login',
    home: '/',
    dashboard: '/dashboard',
    apps: '/apps',
    settings: '/settings',
  },
} as const;
