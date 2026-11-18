import { getEffectiveGasUrl, isValidGasUrl } from '../config';
import {
  CreateRecordPayload,
  HealthResponse,
  ListResponse,
  LookupResponse,
  UpdateRecordPayload,
  UpdateResponse,
} from '../types/masterData';

async function parseGasJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(
      'Received non-JSON response from Google Apps Script. Ensure Web App access is set to "Anyone" and the deployed /exec URL is correct.'
    );
  }
}

export async function checkGasHealth(customUrl?: string): Promise<HealthResponse> {
  const baseUrl = (customUrl || getEffectiveGasUrl()).trim();
  if (!isValidGasUrl(baseUrl)) {
    throw new Error('Google Apps Script Web App URL is not configured.');
  }

  const url = new URL(baseUrl);
  url.searchParams.set('action', 'health');

  const response = await fetch(url.toString(), {
    method: 'GET',
    redirect: 'follow',
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} from Google Apps Script.`);
  }

  return parseGasJson<HealthResponse>(response);
}

export async function lookupByMobile(
  mobile: string,
  customUrl?: string
): Promise<LookupResponse> {
  const baseUrl = (customUrl || getEffectiveGasUrl()).trim();
  if (!isValidGasUrl(baseUrl)) {
    throw new Error('Google Apps Script Web App URL is not configured.');
  }

  const url = new URL(baseUrl);
  url.searchParams.set('action', 'lookup');
  url.searchParams.set('mobile', mobile.trim());

  const response = await fetch(url.toString(), {
    method: 'GET',
    redirect: 'follow',
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} while fetching mobile record.`);
  }

  return parseGasJson<LookupResponse>(response);
}

export async function listMasterRecords(
  query = '',
  limit = 250,
  customUrl?: string
): Promise<ListResponse> {
  const baseUrl = (customUrl || getEffectiveGasUrl()).trim();
  if (!isValidGasUrl(baseUrl)) {
    throw new Error('Google Apps Script Web App URL is not configured.');
  }

  const url = new URL(baseUrl);
  url.searchParams.set('action', 'list');
  url.searchParams.set('limit', String(limit));
  if (query.trim()) {
    url.searchParams.set('q', query.trim());
  }

  const response = await fetch(url.toString(), {
    method: 'GET',
    redirect: 'follow',
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} while loading MASTER DATA records.`);
  }

  return parseGasJson<ListResponse>(response);
}

export async function updateMasterRecord(
  payload: UpdateRecordPayload,
  customUrl?: string
): Promise<UpdateResponse> {
  const baseUrl = (customUrl || getEffectiveGasUrl()).trim();
  if (!isValidGasUrl(baseUrl)) {
    throw new Error('Google Apps Script Web App URL is not configured.');
  }

  // Use text/plain to prevent CORS preflight OPTIONS requests in Google Apps Script
  const response = await fetch(baseUrl, {
    method: 'POST',
    redirect: 'follow',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8',
    },
    body: JSON.stringify({
      action: 'update',
      ...payload,
    }),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} while saving record to Google Sheet.`);
  }

  return parseGasJson<UpdateResponse>(response);
}

export async function createMasterRecord(
  payload: CreateRecordPayload,
  customUrl?: string
): Promise<UpdateResponse> {
  const baseUrl = (customUrl || getEffectiveGasUrl()).trim();
  if (!isValidGasUrl(baseUrl)) {
    throw new Error('Google Apps Script Web App URL is not configured.');
  }

  // Use text/plain to prevent CORS preflight OPTIONS requests in Google Apps Script
  const response = await fetch(baseUrl, {
    method: 'POST',
    redirect: 'follow',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8',
    },
    body: JSON.stringify({
      action: 'create',
      ...payload,
    }),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} while adding new record to Google Sheet.`);
  }

  return parseGasJson<UpdateResponse>(response);
}
