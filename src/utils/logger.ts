/**
 * Development logging utility
 * Only logs in development mode to keep production logs clean
 */
export const devLog = (...args: any[]) => {
  if (process.env.NODE_ENV === 'development') {
    console.log('[DEV]', ...args);
  }
};

/**
 * Error logging - always logs
 */
export const errorLog = (...args: any[]) => {
  console.error('[ERROR]', ...args);
};