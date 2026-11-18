/**
 * Manual Google Apps Script Web App Deployment URL configuration.
 *
 * After deploying code.js in Google Apps Script as a Web App:
 * 1. Replace the placeholder URL below with your deployed Web App URL
 *    (it looks like: https://script.google.com/macros/s/AKfycb.../exec).
 * 2. Save this file and rebuild/reload the application.
 */
export const GAS_WEB_APP_URL =
  'https://script.google.com/macros/s/AKfycbzi0H1iahy8AmmHGp_jgjnP_CX6ORCWAbllFpmZ639uyP0T5RihI090IlZXpadC-Xdf2w/exec';

const STORAGE_OVERRIDE_KEY = 'master_data_gas_url_override';

export function isValidGasUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return false;
  if (trimmed.includes('YOUR_DEPLOYMENT_ID')) return false;
  try {
    const parsed = new URL(trimmed);
    return (
      parsed.protocol === 'https:' &&
      (parsed.hostname === 'script.google.com' ||
        parsed.hostname === 'script.googleusercontent.com')
    );
  } catch {
    return false;
  }
}

export function getEffectiveGasUrl(): string {
  if (typeof window !== 'undefined') {
    const override = window.localStorage.getItem(STORAGE_OVERRIDE_KEY);
    if (override && isValidGasUrl(override)) {
      return override.trim();
    }
  }
  return GAS_WEB_APP_URL;
}

export function setGasUrlOverride(url: string): void {
  if (typeof window === 'undefined') return;
  const trimmed = url.trim();
  if (!trimmed) {
    window.localStorage.removeItem(STORAGE_OVERRIDE_KEY);
  } else {
    window.localStorage.setItem(STORAGE_OVERRIDE_KEY, trimmed);
  }
}

export function getGasUrlOverride(): string {
  if (typeof window === 'undefined') return '';
  return window.localStorage.getItem(STORAGE_OVERRIDE_KEY) || '';
}
