/**
 * Session & Authentication Middleware
 * Enforces admin-only access across web dashboard pages and administrative REST endpoints.
 */
import { validateSession, hasAdminAccount } from './authService.js';

export const COOKIE_NAME = 'gymstack_session';

/**
 * Helper to parse cookies from incoming request headers
 */
export function parseCookies(cookieHeader = '') {
  const list = {};
  if (!cookieHeader) return list;

  cookieHeader.split(';').forEach(cookie => {
    let [name, ...rest] = cookie.split('=');
    name = name?.trim();
    if (!name) return;
    const value = rest.join('=').trim();
    list[name] = decodeURIComponent(value);
  });

  return list;
}

/**
 * Express middleware to enforce admin authentication
 */
export function requireAdminAuth(req, res, next) {
  // Public bypass paths
  const publicPaths = [
    '/login',
    '/api/auth/login',
    '/api/auth/setup',
    '/api/auth/status',
    '/health',
    '/favicon.ico'
  ];

  if (publicPaths.some(p => req.path === p || req.path.startsWith('/public/'))) {
    return next();
  }

  const cookies = parseCookies(req.headers.cookie || '');
  const token = cookies[COOKIE_NAME] || req.headers['authorization']?.replace(/^Bearer\s+/i, '');

  if (!token) {
    if (req.path.startsWith('/api/')) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized. Administrator session required.',
        requiresLogin: true
      });
    }
    return res.redirect('/login');
  }

  const session = validateSession(token);

  if (!session) {
    // Clear invalid cookie
    res.setHeader('Set-Cookie', `${COOKIE_NAME}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax`);
    if (req.path.startsWith('/api/')) {
      return res.status(401).json({
        success: false,
        error: 'Session expired or invalid. Please log in again.',
        requiresLogin: true
      });
    }
    return res.redirect('/login');
  }

  // Attach session user to request object
  req.user = session;
  next();
}
