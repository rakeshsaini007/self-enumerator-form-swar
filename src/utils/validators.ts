import { CreateRecordPayload, EditableFields } from '../types/masterData';

export interface SanitizeResult {
  value: string;
  hadInvalidChars: boolean;
}

/**
 * Enforces UPPERCASE English alphabet (A-Z), spaces, and periods only.
 */
export function sanitizeUppercaseEnglishAlpha(raw: string): SanitizeResult {
  const upper = raw.toUpperCase();
  const cleaned = upper.replace(/[^A-Z.\s]/g, '');
  return {
    value: cleaned,
    hadInvalidChars: upper !== cleaned,
  };
}

/**
 * Enforces UPPERCASE English alphanumeric (A-Z, 0-9, hyphen) for EHRMS CODE.
 */
export function sanitizeUppercaseAlphanumeric(raw: string): SanitizeResult {
  const upper = raw.toUpperCase();
  const cleaned = upper.replace(/[^A-Z0-9-]/g, '');
  return {
    value: cleaned,
    hadInvalidChars: upper !== cleaned,
  };
}

/**
 * Enforces UPPERCASE English alphabet + numbers + basic punctuation for village names.
 */
export function sanitizeUppercasePlace(raw: string): SanitizeResult {
  const upper = raw.toUpperCase();
  const cleaned = upper.replace(/[^A-Z0-9.,\s-]/g, '');
  return {
    value: cleaned,
    hadInvalidChars: upper !== cleaned,
  };
}

/**
 * Enforces UPPERCASE English characters + office/designation punctuation (A-Z, 0-9, space, ., /, (, ), -).
 */
export function sanitizeUppercaseGeneral(raw: string): SanitizeResult {
  const upper = raw.toUpperCase();
  const cleaned = upper.replace(/[^A-Z0-9.,/()\s-]/g, '');
  return {
    value: cleaned,
    hadInvalidChars: upper !== cleaned,
  };
}

/**
 * Enforces SE ID format: must start with "P" followed by up to 11 digits (e.g. P12345678945).
 */
export function sanitizeSeIdInput(raw: string): SanitizeResult {
  const upper = raw.toUpperCase().replace(/\s+/g, '');
  if (!upper) {
    return { value: '', hadInvalidChars: false };
  }

  let hadInvalidChars = false;
  let result = '';

  // First character must be 'P'
  if (upper[0] === 'P') {
    result = 'P';
    const rest = upper.slice(1);
    const digitsOnly = rest.replace(/\D/g, '');
    if (digitsOnly !== rest) {
      hadInvalidChars = true;
    }
    if (digitsOnly.length > 11) {
      hadInvalidChars = true;
    }
    result += digitsOnly.slice(0, 11);
  } else if (/^\d/.test(upper[0])) {
    // If user starts typing digits directly, prefix with P and keep up to 11 digits
    const digitsOnly = upper.replace(/\D/g, '');
    result = 'P' + digitsOnly.slice(0, 11);
    hadInvalidChars = digitsOnly.length > 11;
  } else {
    // Non-P leading alphabet is invalid
    hadInvalidChars = true;
    const digitsAfter = upper.slice(1).replace(/\D/g, '');
    result = digitsAfter ? 'P' + digitsAfter.slice(0, 11) : '';
  }

  return { value: result, hadInvalidChars };
}

export function isValidMobile(mobile: string): boolean {
  return /^\d{10}$/.test(mobile.trim());
}

export function isValidSeId(seId: string): boolean {
  return /^P\d{11}$/.test(seId.trim());
}

export function isUppercaseEnglishText(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length > 0 && /^[A-Z.\s]+$/.test(trimmed);
}

export function isUppercasePlaceText(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length > 0 && /^[A-Z0-9.,\s-]+$/.test(trimmed);
}

export function isUppercaseGeneralText(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length > 0 && /^[A-Z0-9.,/()\s-]+$/.test(trimmed);
}

export function isUppercaseAlphanumericText(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length > 0 && /^[A-Z0-9-]+$/.test(trimmed);
}

export type FieldErrors = Partial<Record<keyof EditableFields, string>>;
export type CreateFieldErrors = Partial<Record<keyof CreateRecordPayload, string>>;

export const NO_EHRMS_MESSAGE = 'मानव संपदा id (EHRMS ID) नहीं बनी है';

export function resolveEhrmsCodeForSave(value: string): string {
  const trimmed = value.trim();
  if (!trimmed || trimmed.toLowerCase() === NO_EHRMS_MESSAGE.toLowerCase()) {
    return NO_EHRMS_MESSAGE;
  }
  return trimmed.toUpperCase();
}

export function validateEditableFields(fields: EditableFields): FieldErrors {
  const errors: FieldErrors = {};

  if (!isUppercaseEnglishText(fields.fatherHusbandName)) {
    errors.fatherHusbandName =
      'पिता/पति का नाम must contain only UPPERCASE English letters (A-Z).';
  }

  const ehrmsTrimmed = fields.ehrmsCode.trim();
  if (
    ehrmsTrimmed.length > 0 &&
    ehrmsTrimmed.toLowerCase() !== NO_EHRMS_MESSAGE.toLowerCase() &&
    !isUppercaseAlphanumericText(ehrmsTrimmed)
  ) {
    errors.ehrmsCode =
      'EHRMS CODE must contain only UPPERCASE English letters or digits.';
  }

  if (!isUppercasePlaceText(fields.village)) {
    errors.village =
      'स्व गणना स्थल/ ग्राम must be entered in UPPERCASE English alphabet.';
  }

  if (!isValidSeId(fields.seId)) {
    errors.seId =
      'स्व गणना आइडी(SE ID) must start with "P" followed by exactly 11 digits (e.g. P12345678945).';
  }

  if (!fields.seDate.trim()) {
    errors.seDate = 'स्व गणना दिनांक is required.';
  }

  if (!isUppercaseEnglishText(fields.doneBy)) {
    errors.doneBy =
      'स्व गणना किसके द्वारा की गई must contain only UPPERCASE English letters (A-Z).';
  }

  return errors;
}

export function validateCreateRecord(fields: CreateRecordPayload): CreateFieldErrors {
  const errors: CreateFieldErrors = {
    ...validateEditableFields(fields),
  };

  if (!isValidMobile(fields.mobile)) {
    errors.mobile = 'मोबाइल नंबर must be a valid 10-digit number.';
  }

  if (!isUppercaseEnglishText(fields.employeeName)) {
    errors.employeeName =
      'कार्मिक का नाम must contain only UPPERCASE English letters (A-Z).';
  }

  if (!isUppercaseEnglishText(fields.gender)) {
    errors.gender = 'लिंग must be selected in UPPERCASE English.';
  }

  if (!isUppercaseGeneralText(fields.designation)) {
    errors.designation = 'पदनाम must be entered in UPPERCASE English alphabet.';
  }

  if (!isUppercaseGeneralText(fields.officeName)) {
    errors.officeName =
      'कार्यालय का नाम must be entered in UPPERCASE English alphabet.';
  }

  if (!isUppercaseGeneralText(fields.departmentName)) {
    errors.departmentName =
      'विभाग का नाम must be entered in UPPERCASE English alphabet.';
  }

  return errors;
}
