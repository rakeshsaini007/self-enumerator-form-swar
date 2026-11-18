import { useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Phone,
  Plus,
  Save,
  Search,
  UserCheck,
  UserPlus,
} from 'lucide-react';
import {
  CreateRecordPayload,
  EditableFields,
  MasterRecord,
} from '../types/masterData';
import {
  CreateFieldErrors,
  FieldErrors,
  NO_EHRMS_MESSAGE,
  isUppercaseAlphanumericText,
  isValidMobile,
  isValidSeId,
  resolveEhrmsCodeForSave,
  sanitizeSeIdInput,
  sanitizeUppercaseAlphanumeric,
  sanitizeUppercaseEnglishAlpha,
  sanitizeUppercaseGeneral,
  sanitizeUppercasePlace,
  validateCreateRecord,
  validateEditableFields,
} from '../utils/validators';
import {
  createMasterRecord,
  lookupByMobile,
  updateMasterRecord,
} from '../services/gasService';

interface EntryFormViewProps {
  isLiveConnected: boolean;
  isPreviewMode: boolean;
  previewRows: MasterRecord[];
  onUpdatePreviewRow: (updated: MasterRecord) => void;
  onAddPreviewRow: (created: Omit<MasterRecord, 'rowIndex'>) => MasterRecord;
  onGoToSetup: () => void;
  onEnablePreviewMode: () => void;
  preselectedRecord: MasterRecord | null;
  resetSignal: number;
  createSignal: number;
}

function getTodayIsoDate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatLocalTimestamp(): string {
  const now = new Date();
  const d = String(now.getDate()).padStart(2, '0');
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const y = now.getFullYear();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  return `${d}-${m}-${y} ${hh}:${mm}:${ss}`;
}

const EHRMS_MANDATORY_DESIGNATIONS = new Set([
  'AT PS',
  'AT UPS',
  'HT PS',
  'HT UPS',
  'SM',
]);

function createEmptyFields(): EditableFields {
  return {
    fatherHusbandName: '',
    ehrmsCode: '',
    village: '',
    seId: '',
    seDate: getTodayIsoDate(),
    doneBy: '',
  };
}

function createEmptyNewRecord(prefillMobile = ''): CreateRecordPayload {
  return {
    employeeName: '',
    mobile: prefillMobile,
    gender: '',
    designation: '',
    officeName: '',
    departmentName: '',
    fatherHusbandName: '',
    ehrmsCode: '',
    village: '',
    seId: '',
    seDate: getTodayIsoDate(),
    doneBy: '',
  };
}

export function EntryFormView({
  isLiveConnected,
  isPreviewMode,
  previewRows,
  onUpdatePreviewRow,
  onAddPreviewRow,
  onGoToSetup,
  onEnablePreviewMode,
  preselectedRecord,
  resetSignal,
  createSignal,
}: EntryFormViewProps) {
  const [mode, setMode] = useState<'lookup' | 'create'>('lookup');

  const [mobileInput, setMobileInput] = useState('');
  const [lookingUp, setLookingUp] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [notFoundMobile, setNotFoundMobile] = useState<string | null>(null);
  const [matches, setMatches] = useState<MasterRecord[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<MasterRecord | null>(null);

  const [form, setForm] = useState<EditableFields>(createEmptyFields);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [fieldNotices, setFieldNotices] = useState<
    Partial<Record<keyof EditableFields, string>>
  >({});

  const [createForm, setCreateForm] = useState<CreateRecordPayload>(() =>
    createEmptyNewRecord()
  );
  const [customDesignation, setCustomDesignation] = useState('');
  const [customDesignationNotice, setCustomDesignationNotice] = useState<
    string | undefined
  >(undefined);
  const [customDepartment, setCustomDepartment] = useState('');
  const [customDepartmentNotice, setCustomDepartmentNotice] = useState<
    string | undefined
  >(undefined);
  const [createErrors, setCreateErrors] = useState<CreateFieldErrors>({});
  const [createNotices, setCreateNotices] = useState<
    Partial<Record<keyof CreateRecordPayload, string>>
  >({});
  const [checkingCreateMobile, setCheckingCreateMobile] = useState(false);
  const [duplicateCreateMobileError, setDuplicateCreateMobileError] = useState<
    string | null
  >(null);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  function populateFromRecord(rec: MasterRecord) {
    setMode('lookup');
    setSelectedRecord(rec);
    const rawEhrms = (rec.ehrmsCode || '').trim();
    const initialEhrms =
      rawEhrms.toLowerCase() === NO_EHRMS_MESSAGE.toLowerCase()
        ? ''
        : rawEhrms.toUpperCase();
    setForm({
      fatherHusbandName: (rec.fatherHusbandName || '').toUpperCase(),
      ehrmsCode: initialEhrms,
      village: (rec.village || '').toUpperCase(),
      seId: (rec.seId || '').toUpperCase(),
      seDate: rec.seDate || getTodayIsoDate(),
      doneBy: (rec.doneBy || '').toUpperCase(),
    });
    setFieldErrors({});
    setFieldNotices({});
    setSaveError(null);
    setSaveSuccess(null);
  }

  function enterCreateMode(prefillMobile = '') {
    setMode('create');
    setCreateForm(createEmptyNewRecord(prefillMobile));
    setCustomDesignation('');
    setCustomDesignationNotice(undefined);
    setCustomDepartment('');
    setCustomDepartmentNotice(undefined);
    setCreateErrors({});
    setCreateNotices({});
    setDuplicateCreateMobileError(null);
    setCheckingCreateMobile(false);
    setSaveError(null);
    setSaveSuccess(null);
  }

  // Handle preselected record from Master Sheet view
  useEffect(() => {
    if (preselectedRecord) {
      setMode('lookup');
      setMobileInput(preselectedRecord.mobile);
      setMatches([preselectedRecord]);
      setLookupError(null);
      setNotFoundMobile(null);
      populateFromRecord(preselectedRecord);
    }
  }, [preselectedRecord]);

  // Handle reset button from TopBar
  useEffect(() => {
    if (resetSignal > 0) {
      setMode('lookup');
      setMobileInput('');
      setMatches([]);
      setSelectedRecord(null);
      setLookupError(null);
      setNotFoundMobile(null);
      setForm(createEmptyFields());
      setFieldErrors({});
      setFieldNotices({});
      setCreateForm(createEmptyNewRecord());
      setCustomDesignation('');
      setCustomDesignationNotice(undefined);
      setCustomDepartment('');
      setCustomDepartmentNotice(undefined);
      setCreateErrors({});
      setCreateNotices({});
      setDuplicateCreateMobileError(null);
      setCheckingCreateMobile(false);
      setSaveError(null);
      setSaveSuccess(null);
    }
  }, [resetSignal]);

  // Handle Create New Entry trigger from Master Sheet view
  useEffect(() => {
    if (createSignal > 0) {
      enterCreateMode('');
    }
  }, [createSignal]);

  const canQuery = isLiveConnected || isPreviewMode;

  // Check if mobile entered in Create mode already exists in MASTER DATA
  useEffect(() => {
    if (mode !== 'create' || !isValidMobile(createForm.mobile)) {
      setDuplicateCreateMobileError(null);
      setCheckingCreateMobile(false);
      return;
    }

    const targetMobile = createForm.mobile;

    if (isLiveConnected) {
      let cancelled = false;
      setCheckingCreateMobile(true);
      void lookupByMobile(targetMobile)
        .then((res) => {
          if (cancelled) return;
          if (res.ok && res.matches && res.matches.length > 0) {
            const msg = `Mobile number ${targetMobile} is already present in MASTER DATA (Row ${res.matches[0].rowIndex}).`;
            setDuplicateCreateMobileError(msg);
            setCreateErrors((prev) => ({ ...prev, mobile: msg }));
          } else {
            setDuplicateCreateMobileError(null);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setDuplicateCreateMobileError(null);
          }
        })
        .finally(() => {
          if (!cancelled) {
            setCheckingCreateMobile(false);
          }
        });

      return () => {
        cancelled = true;
      };
    }

    if (isPreviewMode) {
      const existing = previewRows.find((row) => row.mobile === targetMobile);
      if (existing) {
        const msg = `Mobile number ${targetMobile} is already present in MASTER DATA (Row ${existing.rowIndex}).`;
        setDuplicateCreateMobileError(msg);
        setCreateErrors((prev) => ({ ...prev, mobile: msg }));
      } else {
        setDuplicateCreateMobileError(null);
      }
      setCheckingCreateMobile(false);
    }
  }, [mode, createForm.mobile, isLiveConnected, isPreviewMode, previewRows]);

  async function runLookup(targetMobile: string) {
    const cleanMobile = targetMobile.replace(/\D/g, '').slice(0, 10);
    if (!isValidMobile(cleanMobile)) {
      setLookupError('Please enter a valid 10-digit mobile number.');
      setNotFoundMobile(null);
      return;
    }

    if (!canQuery) {
      setLookupError(
        'Connect your Google Apps Script URL first, or enable Local Preview Sheet to test.'
      );
      setNotFoundMobile(null);
      return;
    }

    setLookingUp(true);
    setLookupError(null);
    setNotFoundMobile(null);
    setSaveError(null);
    setSaveSuccess(null);
    setMatches([]);
    setSelectedRecord(null);

    try {
      if (isLiveConnected) {
        const res = await lookupByMobile(cleanMobile);
        if (!res.ok) {
          setLookupError(res.error || 'Failed to look up mobile number.');
          return;
        }
        const found = res.matches || [];
        if (found.length === 0) {
          setNotFoundMobile(cleanMobile);
          setLookupError(
            `No employee record found in "MASTER DATA" for mobile number ${cleanMobile}.`
          );
          return;
        }
        setMatches(found);
        populateFromRecord(found[0]);
      } else {
        const found = previewRows.filter((row) => row.mobile === cleanMobile);
        if (found.length === 0) {
          setNotFoundMobile(cleanMobile);
          setLookupError(
            `Mobile ${cleanMobile} not found in Local Preview rows.`
          );
          return;
        }
        setMatches(found);
        populateFromRecord(found[0]);
      }
    } catch (err) {
      setLookupError(
        err instanceof Error
          ? err.message
          : 'Network error while fetching from Google Apps Script.'
      );
    } finally {
      setLookingUp(false);
    }
  }

  function handleMobileChange(rawValue: string) {
    const digitsOnly = rawValue.replace(/\D/g, '').slice(0, 10);
    setMobileInput(digitsOnly);
    setLookupError(null);
    setNotFoundMobile(null);

    if (digitsOnly.length === 10 && canQuery) {
      void runLookup(digitsOnly);
    } else if (digitsOnly.length < 10) {
      setMatches([]);
      setSelectedRecord(null);
      setSaveSuccess(null);
      setSaveError(null);
    }
  }

  function handleLookupSubmit(e: React.FormEvent) {
    e.preventDefault();
    void runLookup(mobileInput);
  }

  function handleUppercaseFieldChange(
    field: 'fatherHusbandName' | 'ehrmsCode' | 'village' | 'seId' | 'doneBy',
    raw: string
  ) {
    let result: { value: string; hadInvalidChars: boolean };
    let noticeMsg = '';

    if (field === 'ehrmsCode') {
      result = sanitizeUppercaseAlphanumeric(raw);
      noticeMsg =
        'Only UPPERCASE English letters (A-Z) and digits (0-9) are allowed.';
    } else if (field === 'village') {
      result = sanitizeUppercasePlace(raw);
      noticeMsg = 'Only UPPERCASE English characters are allowed.';
    } else if (field === 'seId') {
      result = sanitizeSeIdInput(raw);
      noticeMsg =
        'Must start with "P" followed by up to 11 digits (e.g. P12345678945).';
    } else {
      result = sanitizeUppercaseEnglishAlpha(raw);
      noticeMsg = 'Only UPPERCASE English alphabet (A-Z) is allowed.';
    }

    setForm((prev) => ({ ...prev, [field]: result.value }));
    setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
    setFieldNotices((prev) => ({
      ...prev,
      [field]: result.hadInvalidChars ? noticeMsg : undefined,
    }));
    setSaveError(null);
    setSaveSuccess(null);
  }

  function handleCreateFieldChange(
    field: keyof CreateRecordPayload,
    raw: string
  ) {
    if (field === 'mobile') {
      const digitsOnly = raw.replace(/\D/g, '').slice(0, 10);
      setCreateForm((prev) => ({ ...prev, mobile: digitsOnly }));
      setCreateErrors((prev) => ({ ...prev, mobile: undefined }));
      setDuplicateCreateMobileError(null);
      setSaveError(null);
      setSaveSuccess(null);
      return;
    }

    if (field === 'seDate' || field === 'gender') {
      setCreateForm((prev) => ({ ...prev, [field]: raw.toUpperCase() }));
      if (field === 'seDate' && raw && raw <= '2026-11-15') {
        setCreateErrors((prev) => ({
          ...prev,
          seDate: 'स्व गणना दिनांक must be after 15-11-2026.',
        }));
      } else {
        setCreateErrors((prev) => ({ ...prev, [field]: undefined }));
      }
      setSaveError(null);
      setSaveSuccess(null);
      return;
    }

    let result: { value: string; hadInvalidChars: boolean };
    let noticeMsg = '';

    if (field === 'ehrmsCode') {
      result = sanitizeUppercaseAlphanumeric(raw);
      noticeMsg =
        'Only UPPERCASE English letters (A-Z) and digits (0-9) are allowed.';
    } else if (field === 'village') {
      result = sanitizeUppercasePlace(raw);
      noticeMsg = 'Only UPPERCASE English characters are allowed.';
    } else if (field === 'designation' || field === 'officeName' || field === 'departmentName') {
      result = sanitizeUppercaseGeneral(raw);
      noticeMsg = 'Only UPPERCASE English characters are allowed.';
    } else if (field === 'seId') {
      result = sanitizeSeIdInput(raw);
      noticeMsg =
        'Must start with "P" followed by up to 11 digits (e.g. P12345678945).';
    } else {
      result = sanitizeUppercaseEnglishAlpha(raw);
      noticeMsg = 'Only UPPERCASE English alphabet (A-Z) is allowed.';
    }

    setCreateForm((prev) => ({ ...prev, [field]: result.value }));
    setCreateErrors((prev) => ({ ...prev, [field]: undefined }));
    setCreateNotices((prev) => ({
      ...prev,
      [field]: result.hadInvalidChars ? noticeMsg : undefined,
    }));
    setSaveError(null);
    setSaveSuccess(null);
  }

  async function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedRecord) return;

    const errors = validateEditableFields(form);
    if (isEhrmsMandatory && !isUppercaseAlphanumericText(form.ehrmsCode)) {
      errors.ehrmsCode = `EHRMS CODE is mandatory for ${normalizedDesignation} and must contain only UPPERCASE English letters or digits.`;
    }
    if (form.seDate && form.seDate <= '2026-11-15') {
      errors.seDate = 'स्व गणना दिनांक must be after 15-11-2026.';
    }
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setSaveError('Please fix the highlighted validation errors before saving.');
      return;
    }

    setSaving(true);
    setSaveError(null);
    setSaveSuccess(null);

    const resolvedEhrms = resolveEhrmsCodeForSave(form.ehrmsCode);

    try {
      if (isLiveConnected) {
        const res = await updateMasterRecord({
          rowIndex: selectedRecord.rowIndex,
          mobile: selectedRecord.mobile,
          ...form,
          ehrmsCode: resolvedEhrms,
        });

        if (!res.ok || !res.record) {
          setSaveError(res.error || 'Failed to update Google Sheet.');
          return;
        }

        setSelectedRecord(res.record);
        if (res.records && res.records.length > 0) {
          const byRow = new Map(res.records.map((r) => [r.rowIndex, r]));
          setMatches((prev) => prev.map((m) => byRow.get(m.rowIndex) || m));
        } else {
          setMatches((prev) =>
            prev.map((m) => (m.rowIndex === res.record!.rowIndex ? res.record! : m))
          );
        }
        setSaveSuccess(
          res.message ||
            `Saved to MASTER DATA (Row ${res.record.rowIndex}) with SE ID ${res.record.seId}.`
        );
      } else {
        const submittedAt = formatLocalTimestamp();
        const updated: MasterRecord = {
          ...selectedRecord,
          fatherHusbandName: form.fatherHusbandName.trim(),
          ehrmsCode: resolvedEhrms,
          village: form.village.trim(),
          seId: form.seId.trim(),
          seDate: form.seDate.trim(),
          doneBy: form.doneBy.trim(),
          submittedAt,
        };
        const matchingRows = previewRows.filter(
          (row) => row.rowIndex === updated.rowIndex || row.mobile === updated.mobile
        );
        const updatedRowNums = matchingRows.map((row) => row.rowIndex);
        onUpdatePreviewRow(updated);
        setSelectedRecord(updated);
        setMatches((prev) =>
          prev.map((m) =>
            m.rowIndex === updated.rowIndex || m.mobile === updated.mobile
              ? {
                  ...m,
                  fatherHusbandName: updated.fatherHusbandName,
                  ehrmsCode: updated.ehrmsCode,
                  village: updated.village,
                  seId: updated.seId,
                  seDate: updated.seDate,
                  doneBy: updated.doneBy,
                  submittedAt,
                }
              : m
          )
        );
        setSaveSuccess(
          updatedRowNums.length > 1
            ? `Saved in Local Preview for all ${updatedRowNums.length} rows (Rows ${updatedRowNums.join(', ')}) with SE ID ${updated.seId}. Connect Apps Script URL to write to live Google Sheets.`
            : `Saved in Local Preview (Row ${updated.rowIndex}) with SE ID ${updated.seId}. Connect Apps Script URL to write to live Google Sheets.`
        );
      }
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : 'Unexpected error while saving record.'
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canQuery) {
      setSaveError(
        'Connect your Google Apps Script URL first, or enable Local Preview Sheet to test.'
      );
      return;
    }

    const resolvedDesignation =
      createForm.designation === 'OTHER'
        ? customDesignation.trim()
        : createForm.designation.trim();

    const resolvedDepartment =
      createForm.departmentName === 'OTHER'
        ? customDepartment.trim()
        : createForm.departmentName.trim();

    const payloadToValidate: CreateRecordPayload = {
      ...createForm,
      designation: resolvedDesignation,
      departmentName: resolvedDepartment,
    };

    const errors = validateCreateRecord(payloadToValidate);
    if (createForm.seDate && createForm.seDate <= '2026-11-15') {
      errors.seDate = 'स्व गणना दिनांक must be after 15-11-2026.';
    }
    if (duplicateCreateMobileError) {
      errors.mobile = duplicateCreateMobileError;
    }
    if (Object.keys(errors).length > 0) {
      setCreateErrors(errors);
      setSaveError(
        errors.mobile && Object.keys(errors).length === 1
          ? errors.mobile
          : 'Please fix the highlighted validation errors before saving.'
      );
      return;
    }

    setSaving(true);
    setSaveError(null);
    setSaveSuccess(null);

    const cleanPayload: CreateRecordPayload = {
      employeeName: createForm.employeeName.trim(),
      mobile: createForm.mobile.trim(),
      gender: createForm.gender.trim(),
      designation: resolvedDesignation,
      officeName: createForm.officeName.trim(),
      departmentName: resolvedDepartment,
      fatherHusbandName: createForm.fatherHusbandName.trim(),
      ehrmsCode: resolveEhrmsCodeForSave(createForm.ehrmsCode),
      village: createForm.village.trim(),
      seId: createForm.seId.trim(),
      seDate: createForm.seDate.trim(),
      doneBy: createForm.doneBy.trim(),
    };

    try {
      if (isLiveConnected) {
        const existingCheck = await lookupByMobile(cleanPayload.mobile);
        if (
          existingCheck.ok &&
          existingCheck.matches &&
          existingCheck.matches.length > 0
        ) {
          const dupMsg = `Mobile number ${cleanPayload.mobile} is already present in MASTER DATA (Row ${existingCheck.matches[0].rowIndex}).`;
          setDuplicateCreateMobileError(dupMsg);
          setCreateErrors((prev) => ({ ...prev, mobile: dupMsg }));
          setSaveError(dupMsg);
          return;
        }

        const res = await createMasterRecord(cleanPayload);
        if (!res.ok || !res.record) {
          const errMsg = res.error || 'Failed to add new entry to Google Sheet.';
          if (errMsg.toLowerCase().includes('already present')) {
            setDuplicateCreateMobileError(errMsg);
            setCreateErrors((prev) => ({ ...prev, mobile: errMsg }));
          }
          setSaveError(errMsg);
          return;
        }
        setSaveSuccess(
          res.message ||
            `New entry added to MASTER DATA (Row ${res.record.rowIndex}) with SE ID ${res.record.seId}.`
        );
        setCreateForm(createEmptyNewRecord());
        setCustomDesignation('');
        setCustomDesignationNotice(undefined);
        setCustomDepartment('');
        setCustomDepartmentNotice(undefined);
        setDuplicateCreateMobileError(null);
      } else {
        const existingLocal = previewRows.find(
          (row) => row.mobile === cleanPayload.mobile
        );
        if (existingLocal) {
          const dupMsg = `Mobile number ${cleanPayload.mobile} is already present in MASTER DATA (Row ${existingLocal.rowIndex}).`;
          setDuplicateCreateMobileError(dupMsg);
          setCreateErrors((prev) => ({ ...prev, mobile: dupMsg }));
          setSaveError(dupMsg);
          return;
        }

        const created = onAddPreviewRow({
          ...cleanPayload,
          submittedAt: formatLocalTimestamp(),
        });
        setSaveSuccess(
          `New entry added in Local Preview (Row ${created.rowIndex}) with SE ID ${created.seId}.`
        );
        setCreateForm(createEmptyNewRecord());
        setCustomDesignation('');
        setCustomDesignationNotice(undefined);
        setCustomDepartment('');
        setCustomDepartmentNotice(undefined);
      }
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : 'Unexpected error while creating new entry.'
      );
    } finally {
      setSaving(false);
    }
  }

  const seIdDigitCount =
    form.seId.startsWith('P') ? Math.max(0, form.seId.length - 1) : 0;
  const seIdValid = isValidSeId(form.seId);

  const normalizedDesignation = (selectedRecord?.designation || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ');
  const isEhrmsMandatory = EHRMS_MANDATORY_DESIGNATIONS.has(normalizedDesignation);

  const createSeIdDigitCount =
    createForm.seId.startsWith('P') ? Math.max(0, createForm.seId.length - 1) : 0;
  const createSeIdValid = isValidSeId(createForm.seId);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            {mode === 'create'
              ? 'Create New Employee Entry'
              : 'Employee Enumeration Entry'}
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            {mode === 'create'
              ? 'Add a new employee row directly to MASTER DATA using UPPERCASE English alphabet.'
              : 'Enter a 10-digit mobile number to auto-fetch employee details from MASTER DATA and complete self-enumeration fields in uppercase English.'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {mode === 'lookup' ? (
            <button
              type="button"
              onClick={() => enterCreateMode(mobileInput.length === 10 ? mobileInput : '')}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-800 hover:bg-blue-900 rounded-lg shadow-sm transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              Create New Entry
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setMode('lookup');
                setSaveError(null);
                setSaveSuccess(null);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-800 hover:bg-blue-900 rounded-lg shadow-sm transition-colors whitespace-nowrap shrink-0"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Search by Mobile Number
            </button>
          )}
        </div>
      </div>

      {/* Setup Banner when neither Live URL nor Preview is active */}
      {!canQuery && (
        <section className="bg-amber-50 border border-amber-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-sm font-semibold text-amber-950">
              Google Apps Script Deployment URL Needed
            </h2>
            <p className="text-xs text-amber-900 leading-relaxed max-w-2xl">
              Deploy <span className="font-mono font-semibold">code.js</span> as a Web App and
              paste the URL into <span className="font-mono font-semibold">src/config.ts</span> to
              read and write your live Google Sheet, or enable Local Preview to test the form right
              now.
            </p>
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onEnablePreviewMode}
              className="px-3.5 py-2 text-xs font-semibold text-amber-950 bg-white border border-amber-300 hover:bg-amber-100 rounded-lg transition-colors whitespace-nowrap"
            >
              Try Local Preview
            </button>
            <button
              type="button"
              onClick={onGoToSetup}
              className="px-4 py-2 text-xs font-semibold text-white bg-blue-800 hover:bg-blue-900 rounded-lg transition-colors whitespace-nowrap"
            >
              Configure URL
            </button>
          </div>
        </section>
      )}

      {/* Local Preview Mode Info Strip */}
      {!isLiveConnected && isPreviewMode && (
        <section className="bg-white border border-slate-200 rounded-xl px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-700">
            <span className="font-semibold text-amber-700">Local Preview Active</span>
            <span className="mx-2 text-slate-300">|</span>
            <span>Sample mobiles: </span>
            {['8077539121', '7456913512', '9719243073', '6395180619'].map((sample) => (
              <button
                key={sample}
                type="button"
                onClick={() => {
                  setMode('lookup');
                  handleMobileChange(sample);
                }}
                className="font-mono tabular-nums text-blue-700 hover:underline mx-1.5 font-medium"
              >
                {sample}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={onGoToSetup}
            className="text-xs font-semibold text-blue-800 hover:underline whitespace-nowrap"
          >
            Connect Live Sheet URL →
          </button>
        </section>
      )}

      {/* CREATE NEW ENTRY MODE */}
      {mode === 'create' && (
        <form onSubmit={handleCreateSubmit} className="space-y-6">
          <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-blue-800" />
                <h2 className="text-base font-semibold text-slate-900">
                  New Employee & Self-Enumeration Details
                </h2>
              </div>
              <span className="text-xs text-slate-500">
                Appends a new row to MASTER DATA · UPPERCASE English only
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* मोबाइल नंबर */}
              <div>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <label
                    htmlFor="create-mobile"
                    className="block text-sm font-medium text-slate-800"
                  >
                    मोबाइल नंबर <span className="text-slate-500 font-normal">(Mobile Number)</span>
                    <span className="text-red-600 ml-0.5" aria-hidden="true">*</span>
                  </label>
                  <span className="text-xs font-mono tabular-nums text-slate-500">
                    {createForm.mobile.length}/10 digits
                  </span>
                </div>
                <input
                  id="create-mobile"
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  required
                  aria-invalid={Boolean(createErrors.mobile || duplicateCreateMobileError)}
                  value={createForm.mobile}
                  onChange={(e) => handleCreateFieldChange('mobile', e.target.value)}
                  className={`w-full px-3.5 py-2.5 text-sm font-mono tabular-nums bg-slate-50 border rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:ring-2 ${
                    createErrors.mobile || duplicateCreateMobileError
                      ? 'border-red-400 focus:ring-red-600/20 focus:border-red-600'
                      : 'border-slate-300 focus:ring-blue-700/20 focus:border-blue-700'
                  }`}
                />
                {checkingCreateMobile ? (
                  <p className="text-xs text-slate-500 mt-1">
                    Checking mobile number in MASTER DATA...
                  </p>
                ) : createErrors.mobile || duplicateCreateMobileError ? (
                  <p className="text-xs text-red-700 mt-1">
                    {createErrors.mobile || duplicateCreateMobileError}
                  </p>
                ) : null}
              </div>

              {/* कार्मिक का नाम */}
              <div>
                  <label
                    htmlFor="create-employee-name"
                    className="block text-sm font-medium text-slate-800 mb-1.5"
                  >
                    कार्मिक का नाम <span className="text-slate-500 font-normal">(Employee Name)</span>
                    <span className="text-red-600 ml-0.5" aria-hidden="true">*</span>
                  </label>
                  <input
                    id="create-employee-name"
                    type="text"
                    required
                    value={createForm.employeeName}
                  onChange={(e) =>
                    handleCreateFieldChange('employeeName', e.target.value)
                  }
                  className={`w-full px-3.5 py-2.5 text-sm uppercase bg-slate-50 border rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:ring-2 ${
                    createErrors.employeeName
                      ? 'border-red-400 focus:ring-red-600/20 focus:border-red-600'
                      : 'border-slate-300 focus:ring-blue-700/20 focus:border-blue-700'
                  }`}
                />
                {createErrors.employeeName ? (
                  <p className="text-xs text-red-700 mt-1">{createErrors.employeeName}</p>
                ) : createNotices.employeeName ? (
                  <p className="text-xs text-amber-700 mt-1">{createNotices.employeeName}</p>
                ) : null}
              </div>

              {/* पिता/पति का नाम */}
              <div>
                <label
                  htmlFor="create-father-husband-name"
                  className="block text-sm font-medium text-slate-800 mb-1.5"
                >
                  पिता/पति का नाम{' '}
                  <span className="text-slate-500 font-normal">(Father / Husband Name)</span>
                  <span className="text-red-600 ml-0.5" aria-hidden="true">*</span>
                </label>
                <input
                  id="create-father-husband-name"
                  type="text"
                  required
                  value={createForm.fatherHusbandName}
                  onChange={(e) =>
                    handleCreateFieldChange('fatherHusbandName', e.target.value)
                  }
                  className={`w-full px-3.5 py-2.5 text-sm uppercase bg-slate-50 border rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:ring-2 ${
                    createErrors.fatherHusbandName
                      ? 'border-red-400 focus:ring-red-600/20 focus:border-red-600'
                      : 'border-slate-300 focus:ring-blue-700/20 focus:border-blue-700'
                  }`}
                />
                {createErrors.fatherHusbandName ? (
                  <p className="text-xs text-red-700 mt-1">
                    {createErrors.fatherHusbandName}
                  </p>
                ) : createNotices.fatherHusbandName ? (
                  <p className="text-xs text-amber-700 mt-1">
                    {createNotices.fatherHusbandName}
                  </p>
                ) : null}
              </div>

              {/* EHRMS CODE */}
              <div>
                <label
                  htmlFor="create-ehrms-code"
                  className="block text-sm font-medium text-slate-800 mb-1.5"
                >
                  EHRMS CODE
                </label>
                <input
                  id="create-ehrms-code"
                  type="text"
                  value={createForm.ehrmsCode}
                  onChange={(e) =>
                    handleCreateFieldChange('ehrmsCode', e.target.value)
                  }
                  className={`w-full px-3.5 py-2.5 text-sm font-mono tabular-nums uppercase bg-slate-50 border rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:ring-2 ${
                    createErrors.ehrmsCode
                      ? 'border-red-400 focus:ring-red-600/20 focus:border-red-600'
                      : 'border-slate-300 focus:ring-blue-700/20 focus:border-blue-700'
                  }`}
                />
                {createErrors.ehrmsCode ? (
                  <p className="text-xs text-red-700 mt-1">{createErrors.ehrmsCode}</p>
                ) : createNotices.ehrmsCode ? (
                  <p className="text-xs text-amber-700 mt-1">{createNotices.ehrmsCode}</p>
                ) : null}
              </div>

              {/* लिंग */}
              <div>
                <label
                  htmlFor="create-gender"
                  className="block text-sm font-medium text-slate-800 mb-1.5"
                >
                  लिंग <span className="text-slate-500 font-normal">(Gender)</span>
                  <span className="text-red-600 ml-0.5" aria-hidden="true">*</span>
                </label>
                <select
                  id="create-gender"
                  required
                  value={createForm.gender}
                  onChange={(e) => handleCreateFieldChange('gender', e.target.value)}
                  className={`w-full px-3.5 py-2.5 text-sm uppercase bg-slate-50 border rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:ring-2 ${
                    createErrors.gender
                      ? 'border-red-400 focus:ring-red-600/20 focus:border-red-600'
                      : 'border-slate-300 focus:ring-blue-700/20 focus:border-blue-700'
                  }`}
                >
                  <option value="">SELECT</option>
                  <option value="MALE">MALE</option>
                  <option value="FEMALE">FEMALE</option>
                </select>
                {createErrors.gender && (
                  <p className="text-xs text-red-700 mt-1">{createErrors.gender}</p>
                )}
              </div>

              {/* पदनाम */}
              <div>
                <label
                  htmlFor="create-designation"
                  className="block text-sm font-medium text-slate-800 mb-1.5"
                >
                  पदनाम <span className="text-slate-500 font-normal">(Designation)</span>
                  <span className="text-red-600 ml-0.5" aria-hidden="true">*</span>
                </label>
                <select
                  id="create-designation"
                  required
                  value={createForm.designation}
                  onChange={(e) => {
                    const nextVal = e.target.value;
                    handleCreateFieldChange('designation', nextVal);
                    if (nextVal !== 'OTHER') {
                      setCustomDesignation('');
                      setCustomDesignationNotice(undefined);
                    }
                  }}
                  className={`w-full px-3.5 py-2.5 text-sm uppercase bg-slate-50 border rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:ring-2 ${
                    createErrors.designation && createForm.designation !== 'OTHER'
                      ? 'border-red-400 focus:ring-red-600/20 focus:border-red-600'
                      : 'border-slate-300 focus:ring-blue-700/20 focus:border-blue-700'
                  }`}
                >
                  <option value="">SELECT</option>
                  <option value="AT PS">AT PS</option>
                  <option value="AT UPS">AT UPS</option>
                  <option value="HT PS">HT PS</option>
                  <option value="HT UPS">HT UPS</option>
                  <option value="SM">SM</option>
                  <option value="LEKHPAL">LEKHPAL</option>
                  <option value="OTHER">OTHER</option>
                </select>
                {createForm.designation === 'OTHER' && (
                  <div className="mt-2.5">
                    <label
                      htmlFor="create-designation-other"
                      className="block text-xs font-medium text-slate-700 mb-1"
                    >
                      Other Designation Name (UPPERCASE English)
                    </label>
                    <input
                      id="create-designation-other"
                      type="text"
                      required
                      value={customDesignation}
                      onChange={(e) => {
                        const res = sanitizeUppercaseGeneral(e.target.value);
                        setCustomDesignation(res.value);
                        setCustomDesignationNotice(
                          res.hadInvalidChars
                            ? 'Only UPPERCASE English characters are allowed.'
                            : undefined
                        );
                        setCreateErrors((prev) => ({
                          ...prev,
                          designation: undefined,
                        }));
                        setSaveError(null);
                        setSaveSuccess(null);
                      }}
                      className={`w-full px-3.5 py-2.5 text-sm uppercase bg-slate-50 border rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:ring-2 ${
                        createErrors.designation
                          ? 'border-red-400 focus:ring-red-600/20 focus:border-red-600'
                          : 'border-slate-300 focus:ring-blue-700/20 focus:border-blue-700'
                      }`}
                    />
                  </div>
                )}
                {createErrors.designation ? (
                  <p className="text-xs text-red-700 mt-1">{createErrors.designation}</p>
                ) : createForm.designation === 'OTHER' && customDesignationNotice ? (
                  <p className="text-xs text-amber-700 mt-1">{customDesignationNotice}</p>
                ) : null}
              </div>

              {/* कार्यालय का नाम */}
              <div>
                <label
                  htmlFor="create-office-name"
                  className="block text-sm font-medium text-slate-800 mb-1.5"
                >
                  कार्यालय का नाम <span className="text-slate-500 font-normal">(Office Name)</span>
                  <span className="text-red-600 ml-0.5" aria-hidden="true">*</span>
                </label>
                <input
                  id="create-office-name"
                  type="text"
                  required
                  value={createForm.officeName}
                  onChange={(e) =>
                    handleCreateFieldChange('officeName', e.target.value)
                  }
                  className={`w-full px-3.5 py-2.5 text-sm uppercase bg-slate-50 border rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:ring-2 ${
                    createErrors.officeName
                      ? 'border-red-400 focus:ring-red-600/20 focus:border-red-600'
                      : 'border-slate-300 focus:ring-blue-700/20 focus:border-blue-700'
                  }`}
                />
                {createErrors.officeName ? (
                  <p className="text-xs text-red-700 mt-1">{createErrors.officeName}</p>
                ) : createNotices.officeName ? (
                  <p className="text-xs text-amber-700 mt-1">{createNotices.officeName}</p>
                ) : null}
              </div>

              {/* विभाग का नाम */}
              <div>
                <label
                  htmlFor="create-department-name"
                  className="block text-sm font-medium text-slate-800 mb-1.5"
                >
                  विभाग का नाम <span className="text-slate-500 font-normal">(Department Name)</span>
                  <span className="text-red-600 ml-0.5" aria-hidden="true">*</span>
                </label>
                <select
                  id="create-department-name"
                  required
                  value={createForm.departmentName}
                  onChange={(e) => {
                    const nextVal = e.target.value;
                    handleCreateFieldChange('departmentName', nextVal);
                    if (nextVal !== 'OTHER') {
                      setCustomDepartment('');
                      setCustomDepartmentNotice(undefined);
                    }
                  }}
                  className={`w-full px-3.5 py-2.5 text-sm uppercase bg-slate-50 border rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:ring-2 ${
                    createErrors.departmentName && createForm.departmentName !== 'OTHER'
                      ? 'border-red-400 focus:ring-red-600/20 focus:border-red-600'
                      : 'border-slate-300 focus:ring-blue-700/20 focus:border-blue-700'
                  }`}
                >
                  <option value="">SELECT</option>
                  <option value="BASIC EDUCATION DEPARTMENT">BASIC EDUCATION DEPARTMENT</option>
                  <option value="REVENUE DEPARTMENT">REVENUE DEPARTMENT</option>
                  <option value="AGRICULTURE DEPARTMENT">AGRICULTURE DEPARTMENT</option>
                  <option value="RURAL ENGINEERING DEPARTMENT">RURAL ENGINEERING DEPARTMENT</option>
                  <option value="VOCATIONAL EDUCATION AND SKILL DEVELOPMENT">
                    VOCATIONAL EDUCATION AND SKILL DEVELOPMENT
                  </option>
                  <option value="IRRIGATION AND WATER RESOURCE DEPARTMENT">
                    IRRIGATION AND WATER RESOURCE DEPARTMENT
                  </option>
                  <option value="OTHER">OTHER</option>
                </select>
                {createForm.departmentName === 'OTHER' && (
                  <div className="mt-2.5">
                    <label
                      htmlFor="create-department-other"
                      className="block text-xs font-medium text-slate-700 mb-1"
                    >
                      Other Department Name (UPPERCASE English)
                    </label>
                    <input
                      id="create-department-other"
                      type="text"
                      required
                      value={customDepartment}
                      onChange={(e) => {
                        const res = sanitizeUppercaseGeneral(e.target.value);
                        setCustomDepartment(res.value);
                        setCustomDepartmentNotice(
                          res.hadInvalidChars
                            ? 'Only UPPERCASE English characters are allowed.'
                            : undefined
                        );
                        setCreateErrors((prev) => ({
                          ...prev,
                          departmentName: undefined,
                        }));
                        setSaveError(null);
                        setSaveSuccess(null);
                      }}
                      className={`w-full px-3.5 py-2.5 text-sm uppercase bg-slate-50 border rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:ring-2 ${
                        createErrors.departmentName
                          ? 'border-red-400 focus:ring-red-600/20 focus:border-red-600'
                          : 'border-slate-300 focus:ring-blue-700/20 focus:border-blue-700'
                      }`}
                    />
                  </div>
                )}
                {createErrors.departmentName ? (
                  <p className="text-xs text-red-700 mt-1">
                    {createErrors.departmentName}
                  </p>
                ) : createForm.departmentName === 'OTHER' && customDepartmentNotice ? (
                  <p className="text-xs text-amber-700 mt-1">
                    {customDepartmentNotice}
                  </p>
                ) : null}
              </div>

              {/* ग्राम */}
              <div>
                <label
                  htmlFor="create-village"
                  className="block text-sm font-medium text-slate-800 mb-1.5"
                >
                  स्व गणना स्थल/ ग्राम
                  <span className="text-red-600 ml-0.5" aria-hidden="true">*</span>
                </label>
                <input
                  id="create-village"
                  type="text"
                  required
                  value={createForm.village}
                  onChange={(e) => handleCreateFieldChange('village', e.target.value)}
                  className={`w-full px-3.5 py-2.5 text-sm uppercase bg-slate-50 border rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:ring-2 ${
                    createErrors.village
                      ? 'border-red-400 focus:ring-red-600/20 focus:border-red-600'
                      : 'border-slate-300 focus:ring-blue-700/20 focus:border-blue-700'
                  }`}
                />
                {createErrors.village ? (
                  <p className="text-xs text-red-700 mt-1">{createErrors.village}</p>
                ) : createNotices.village ? (
                  <p className="text-xs text-amber-700 mt-1">{createNotices.village}</p>
                ) : null}
              </div>

              {/* स्व गणना आइडी(SE ID) */}
              <div>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <label
                    htmlFor="create-se-id"
                    className="block text-sm font-medium text-slate-800"
                  >
                    स्व गणना आइडी(SE ID)
                    <span className="text-red-600 ml-0.5" aria-hidden="true">*</span>
                  </label>
                  <span
                    className={`text-xs font-mono tabular-nums font-medium ${
                      createSeIdValid ? 'text-emerald-700' : 'text-slate-500'
                    }`}
                  >
                    {createSeIdDigitCount}/11 digits
                  </span>
                </div>
                <input
                  id="create-se-id"
                  type="text"
                  maxLength={12}
                  required
                  value={createForm.seId}
                  onChange={(e) => handleCreateFieldChange('seId', e.target.value)}
                  className={`w-full px-3.5 py-2.5 text-sm font-mono tabular-nums uppercase bg-slate-50 border rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:ring-2 ${
                    createErrors.seId
                      ? 'border-red-400 focus:ring-red-600/20 focus:border-red-600'
                      : createSeIdValid
                        ? 'border-emerald-500 focus:ring-emerald-600/20 focus:border-emerald-600'
                        : 'border-slate-300 focus:ring-blue-700/20 focus:border-blue-700'
                  }`}
                />
                {createErrors.seId ? (
                  <p className="text-xs text-red-700 mt-1">{createErrors.seId}</p>
                ) : createNotices.seId ? (
                  <p className="text-xs text-amber-700 mt-1">{createNotices.seId}</p>
                ) : null}
              </div>

              {/* स्व गणना दिनांक */}
              <div>
                <label
                  htmlFor="create-se-date"
                  className="block text-sm font-medium text-slate-800 mb-1.5"
                >
                  स्व गणना दिनांक{' '}
                  <span className="text-slate-500 font-normal">(Enumeration Date)</span>
                  <span className="text-red-600 ml-0.5" aria-hidden="true">*</span>
                </label>
                <input
                  id="create-se-date"
                  type="date"
                  min="2026-11-16"
                  required
                  value={createForm.seDate}
                  onChange={(e) => handleCreateFieldChange('seDate', e.target.value)}
                  className={`w-full px-3.5 py-2.5 text-sm font-mono tabular-nums bg-slate-50 border rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:ring-2 ${
                    createErrors.seDate
                      ? 'border-red-400 focus:ring-red-600/20 focus:border-red-600'
                      : 'border-slate-300 focus:ring-blue-700/20 focus:border-blue-700'
                  }`}
                />
                {createErrors.seDate && (
                  <p className="text-xs text-red-700 mt-1">{createErrors.seDate}</p>
                )}
              </div>

              {/* स्व गणना किसके द्वारा की गई */}
              <div>
                <label
                  htmlFor="create-done-by"
                  className="block text-sm font-medium text-slate-800 mb-1.5"
                >
                  स्व गणना किसके द्वारा की गई{' '}
                  <span className="text-slate-500 font-normal">(Done By)</span>
                  <span className="text-red-600 ml-0.5" aria-hidden="true">*</span>
                </label>
                <input
                  id="create-done-by"
                  type="text"
                  required
                  value={createForm.doneBy}
                  onChange={(e) => handleCreateFieldChange('doneBy', e.target.value)}
                  className={`w-full px-3.5 py-2.5 text-sm uppercase bg-slate-50 border rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:ring-2 ${
                    createErrors.doneBy
                      ? 'border-red-400 focus:ring-red-600/20 focus:border-red-600'
                      : 'border-slate-300 focus:ring-blue-700/20 focus:border-blue-700'
                  }`}
                />
                {createErrors.doneBy ? (
                  <p className="text-xs text-red-700 mt-1">{createErrors.doneBy}</p>
                ) : createNotices.doneBy ? (
                  <p className="text-xs text-amber-700 mt-1">{createNotices.doneBy}</p>
                ) : null}
              </div>
            </div>

            {saveError && (
              <div className="flex items-start gap-2.5 p-3.5 rounded-lg bg-red-50 border border-red-200 text-sm text-red-900">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-700" />
                <span>{saveError}</span>
              </div>
            )}

            {saveSuccess && (
              <div className="flex items-start gap-2.5 p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-900">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-700" />
                <span>{saveSuccess}</span>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-slate-100">
              <p className="text-xs text-slate-500">
                Adds a new row at the bottom of Google Sheet{' '}
                <span className="font-semibold text-slate-700">MASTER DATA</span>.
              </p>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-blue-800 hover:bg-blue-900 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Adding Entry...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    Add New Entry to MASTER DATA
                  </>
                )}
              </button>
            </div>
          </section>
        </form>
      )}

      {/* LOOKUP & UPDATE MODE */}
      {mode === 'lookup' && (
        <>
          {/* Step 1: Mobile Number Lookup */}
          <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Step 1 · मोबाइल नंबर (Mobile Number Lookup)
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Auto-fetches कार्मिक का नाम, लिंग, पदनाम, कार्यालय का नाम, and विभाग का नाम
                </p>
              </div>
              <span className="text-xs font-mono tabular-nums text-slate-500">
                {mobileInput.length}/10 digits
              </span>
            </div>

            <form onSubmit={handleLookupSubmit} className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="mobile-lookup"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={10}
                  value={mobileInput}
                  onChange={(e) => handleMobileChange(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 text-base font-mono tabular-nums tracking-wide bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700"
                />
              </div>
              <button
                type="submit"
                disabled={lookingUp || mobileInput.length !== 10}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-blue-800 hover:bg-blue-900 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                {lookingUp ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Fetching...
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4" />
                    Fetch Employee
                  </>
                )}
              </button>
            </form>

            {lookupError && (
              <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-lg bg-red-50 border border-red-200 text-sm text-red-900">
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-700" />
                  <span>{lookupError}</span>
                </div>
                {notFoundMobile && (
                  <button
                    type="button"
                    onClick={() => enterCreateMode(notFoundMobile)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-800 hover:bg-blue-900 rounded-lg transition-colors whitespace-nowrap shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Create New Entry
                  </button>
                )}
              </div>
            )}

            {/* Duplicate Mobile Selector (when multiple sheet rows share one mobile number) */}
            {matches.length > 1 && (
              <div className="pt-2 border-t border-slate-100 space-y-2.5">
                <p className="text-xs font-semibold text-slate-700">
                  {matches.length} records match mobile {mobileInput}. Saving will update all{' '}
                  {matches.length} matching rows.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {matches.map((item) => {
                    const isSelected = selectedRecord?.rowIndex === item.rowIndex;
                    return (
                      <button
                        key={item.rowIndex}
                        type="button"
                        onClick={() => populateFromRecord(item)}
                        className={`p-3 rounded-lg border text-left transition-colors ${
                          isSelected
                            ? 'border-blue-700 bg-blue-50/70'
                            : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-slate-900">
                            {item.employeeName}
                          </span>
                          <span className="font-mono tabular-nums text-slate-500">
                            Row #{item.rowIndex}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 mt-0.5 truncate">
                          {item.designation} · {item.officeName}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </section>

          {/* Step 2 & 3: Auto-fetched Profile + Remaining Sheet Fields */}
          {selectedRecord && (
            <form onSubmit={handleFormSubmit} className="space-y-6">
              {/* Step 2: Auto-Fetched Read-Only Fields */}
              <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-emerald-700" />
                    <h2 className="text-base font-semibold text-slate-900">
                      Step 2 · Auto-Fetched Employee Details
                    </h2>
                  </div>
                  <div className="text-xs text-slate-500 font-mono tabular-nums">
                    Row #{selectedRecord.rowIndex} · Mobile {selectedRecord.mobile}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
                  <div>
                    <p className="text-xs font-medium text-slate-500">
                      कार्मिक का नाम (Employee Name)
                    </p>
                    <p className="text-sm font-semibold text-slate-900 mt-1">
                      {selectedRecord.employeeName || '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-500">
                      लिंग (Gender)
                    </p>
                    <p className="text-sm font-semibold text-slate-900 mt-1">
                      {selectedRecord.gender || '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-500">
                      पदनाम (Designation)
                    </p>
                    <p className="text-sm font-semibold text-slate-900 mt-1">
                      {selectedRecord.designation || '—'}
                    </p>
                  </div>
                  <div className="md:col-span-2">
                    <p className="text-xs font-medium text-slate-500">
                      कार्यालय का नाम (Office Name)
                    </p>
                    <p className="text-sm font-semibold text-slate-900 mt-1">
                      {selectedRecord.officeName || '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-500">
                      विभाग का नाम (Department Name)
                    </p>
                    <p className="text-sm font-semibold text-slate-900 mt-1">
                      {selectedRecord.departmentName || '—'}
                    </p>
                  </div>
                </div>
              </section>

              {/* Step 3: Remaining Sheet Fields (Uppercase English + SE ID Validation) */}
              <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-4">
                  <div>
                    <h2 className="text-base font-semibold text-slate-900">
                      Step 3 · Complete Remaining Sheet Fields
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      All text entries automatically format to UPPERCASE English alphabet (A-Z).
                    </p>
                  </div>
                  <span className="text-xs text-slate-500 font-medium">
                    {isEhrmsMandatory ? 'All 6 fields mandatory' : 'EHRMS CODE optional'}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* पिता/पति का नाम */}
                  <div>
                    <label
                      htmlFor="father-husband-name"
                      className="block text-sm font-medium text-slate-800 mb-1.5"
                    >
                      पिता/पति का नाम{' '}
                      <span className="text-slate-500 font-normal">(Father / Husband Name)</span>
                      <span className="text-red-600 ml-0.5" aria-hidden="true">*</span>
                    </label>
                    <input
                      id="father-husband-name"
                      type="text"
                      required
                      value={form.fatherHusbandName}
                      onChange={(e) =>
                        handleUppercaseFieldChange('fatherHusbandName', e.target.value)
                      }
                      className={`w-full px-3.5 py-2.5 text-sm uppercase bg-slate-50 border rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:ring-2 ${
                        fieldErrors.fatherHusbandName
                          ? 'border-red-400 focus:ring-red-600/20 focus:border-red-600'
                          : 'border-slate-300 focus:ring-blue-700/20 focus:border-blue-700'
                      }`}
                    />
                    {fieldErrors.fatherHusbandName ? (
                      <p className="text-xs text-red-700 mt-1">
                        {fieldErrors.fatherHusbandName}
                      </p>
                    ) : fieldNotices.fatherHusbandName ? (
                      <p className="text-xs text-amber-700 mt-1">
                        {fieldNotices.fatherHusbandName}
                      </p>
                    ) : null}
                  </div>

                  {/* EHRMS CODE */}
                  <div>
                    <label
                      htmlFor="ehrms-code"
                      className="block text-sm font-medium text-slate-800 mb-1.5"
                    >
                      मानव संपदा id (EHRMS ID)
                      {isEhrmsMandatory && (
                        <span className="text-red-600 ml-0.5" aria-hidden="true">*</span>
                      )}
                    </label>
                    <input
                      id="ehrms-code"
                      type="text"
                      required={isEhrmsMandatory}
                      value={form.ehrmsCode}
                      onChange={(e) =>
                        handleUppercaseFieldChange('ehrmsCode', e.target.value)
                      }
                      className={`w-full px-3.5 py-2.5 text-sm font-mono tabular-nums uppercase bg-slate-50 border rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:ring-2 ${
                        fieldErrors.ehrmsCode
                          ? 'border-red-400 focus:ring-red-600/20 focus:border-red-600'
                          : 'border-slate-300 focus:ring-blue-700/20 focus:border-blue-700'
                      }`}
                    />
                    {fieldErrors.ehrmsCode ? (
                      <p className="text-xs text-red-700 mt-1">{fieldErrors.ehrmsCode}</p>
                    ) : fieldNotices.ehrmsCode ? (
                      <p className="text-xs text-amber-700 mt-1">{fieldNotices.ehrmsCode}</p>
                    ) : null}
                  </div>

                  {/* ग्राम */}
                  <div>
                    <label
                      htmlFor="village-input"
                      className="block text-sm font-medium text-slate-800 mb-1.5"
                    >
                      स्व गणना स्थल/ ग्राम
                      <span className="text-red-600 ml-0.5" aria-hidden="true">*</span>
                    </label>
                    <input
                      id="village-input"
                      type="text"
                      required
                      value={form.village}
                      onChange={(e) =>
                        handleUppercaseFieldChange('village', e.target.value)
                      }
                      className={`w-full px-3.5 py-2.5 text-sm uppercase bg-slate-50 border rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:ring-2 ${
                        fieldErrors.village
                          ? 'border-red-400 focus:ring-red-600/20 focus:border-red-600'
                          : 'border-slate-300 focus:ring-blue-700/20 focus:border-blue-700'
                      }`}
                    />
                    {fieldErrors.village ? (
                      <p className="text-xs text-red-700 mt-1">{fieldErrors.village}</p>
                    ) : fieldNotices.village ? (
                      <p className="text-xs text-amber-700 mt-1">{fieldNotices.village}</p>
                    ) : null}
                  </div>

                  {/* स्व गणना आइडी(SE ID) */}
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <label
                        htmlFor="se-id-input"
                        className="block text-sm font-medium text-slate-800"
                      >
                        स्व गणना आइडी(SE ID)
                        <span className="text-red-600 ml-0.5" aria-hidden="true">*</span>
                      </label>
                      <span
                        className={`text-xs font-mono tabular-nums font-medium ${
                          seIdValid ? 'text-emerald-700' : 'text-slate-500'
                        }`}
                      >
                        {seIdDigitCount}/11 digits
                      </span>
                    </div>
                    <input
                      id="se-id-input"
                      type="text"
                      maxLength={12}
                      required
                      value={form.seId}
                      onChange={(e) =>
                        handleUppercaseFieldChange('seId', e.target.value)
                      }
                      className={`w-full px-3.5 py-2.5 text-sm font-mono tabular-nums uppercase bg-slate-50 border rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:ring-2 ${
                        fieldErrors.seId
                          ? 'border-red-400 focus:ring-red-600/20 focus:border-red-600'
                          : seIdValid
                            ? 'border-emerald-500 focus:ring-emerald-600/20 focus:border-emerald-600'
                            : 'border-slate-300 focus:ring-blue-700/20 focus:border-blue-700'
                      }`}
                    />
                    {fieldErrors.seId ? (
                      <p className="text-xs text-red-700 mt-1">{fieldErrors.seId}</p>
                    ) : fieldNotices.seId ? (
                      <p className="text-xs text-amber-700 mt-1">{fieldNotices.seId}</p>
                    ) : null}
                  </div>

                  {/* स्व गणना दिनांक */}
                  <div>
                    <label
                      htmlFor="se-date-input"
                      className="block text-sm font-medium text-slate-800 mb-1.5"
                    >
                      स्व गणना दिनांक{' '}
                      <span className="text-slate-500 font-normal">(Enumeration Date)</span>
                      <span className="text-red-600 ml-0.5" aria-hidden="true">*</span>
                    </label>
                    <input
                      id="se-date-input"
                      type="date"
                      min="2026-11-16"
                      required
                      value={form.seDate}
                      onChange={(e) => {
                        const nextDate = e.target.value;
                        setForm((prev) => ({ ...prev, seDate: nextDate }));
                        setFieldErrors((prev) => ({
                          ...prev,
                          seDate:
                            nextDate && nextDate <= '2026-11-15'
                              ? 'स्व गणना दिनांक must be after 15-11-2026.'
                              : undefined,
                        }));
                        setSaveError(null);
                        setSaveSuccess(null);
                      }}
                      className={`w-full px-3.5 py-2.5 text-sm font-mono tabular-nums bg-slate-50 border rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:ring-2 ${
                        fieldErrors.seDate
                          ? 'border-red-400 focus:ring-red-600/20 focus:border-red-600'
                          : 'border-slate-300 focus:ring-blue-700/20 focus:border-blue-700'
                      }`}
                    />
                    {fieldErrors.seDate && (
                      <p className="text-xs text-red-700 mt-1">{fieldErrors.seDate}</p>
                    )}
                  </div>

                  {/* स्व गणना किसके द्वारा की गई */}
                  <div>
                    <label
                      htmlFor="done-by-input"
                      className="block text-sm font-medium text-slate-800 mb-1.5"
                    >
                      स्व गणना किसके द्वारा की गई{' '}
                      <span className="text-slate-500 font-normal">(Done By)</span>
                      <span className="text-red-600 ml-0.5" aria-hidden="true">*</span>
                    </label>
                    <input
                      id="done-by-input"
                      type="text"
                      required
                      value={form.doneBy}
                      onChange={(e) =>
                        handleUppercaseFieldChange('doneBy', e.target.value)
                      }
                      className={`w-full px-3.5 py-2.5 text-sm uppercase bg-slate-50 border rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:ring-2 ${
                        fieldErrors.doneBy
                          ? 'border-red-400 focus:ring-red-600/20 focus:border-red-600'
                          : 'border-slate-300 focus:ring-blue-700/20 focus:border-blue-700'
                      }`}
                    />
                    {fieldErrors.doneBy ? (
                      <p className="text-xs text-red-700 mt-1">{fieldErrors.doneBy}</p>
                    ) : fieldNotices.doneBy ? (
                      <p className="text-xs text-amber-700 mt-1">{fieldNotices.doneBy}</p>
                    ) : null}
                  </div>
                </div>

                {saveError && (
                  <div className="flex items-start gap-2.5 p-3.5 rounded-lg bg-red-50 border border-red-200 text-sm text-red-900">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-700" />
                    <span>{saveError}</span>
                  </div>
                )}

                {saveSuccess && (
                  <div className="flex items-start gap-2.5 p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-900">
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-700" />
                    <span>{saveSuccess}</span>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-end gap-4 pt-4 border-t border-slate-100">
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-blue-800 hover:bg-blue-900 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap shrink-0"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Saving to Sheet...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        Save to MASTER DATA
                      </>
                    )}
                  </button>
                </div>
              </section>
            </form>
          )}
        </>
      )}
    </div>
  );
}
