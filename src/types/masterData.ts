export interface MasterRecord {
  rowIndex: number;
  employeeName: string; // कार्मिक का नाम
  fatherHusbandName: string; // पिता/पति का नाम
  mobile: string; // मोबाइल नंबर
  ehrmsCode: string; // EHRMS CODE
  gender: string; // लिंग
  designation: string; // पदनाम
  officeName: string; // कार्यालय का नाम
  departmentName: string; // विभाग का नाम
  village: string; // ग्राम
  seId: string; // स्व गणना आइडी(SE ID)
  seDate: string; // स्व गणना दिनांक
  doneBy: string; // स्व गणना किसके द्वारा की गई
  submittedAt?: string; // TIMESTAMP
}

export interface EditableFields {
  fatherHusbandName: string;
  ehrmsCode: string;
  village: string;
  seId: string;
  seDate: string;
  doneBy: string;
}

export interface UpdateRecordPayload extends EditableFields {
  rowIndex: number;
  mobile: string;
}

export interface CreateRecordPayload extends EditableFields {
  employeeName: string;
  mobile: string;
  gender: string;
  designation: string;
  officeName: string;
  departmentName: string;
}

export interface LookupResponse {
  ok: boolean;
  mobile?: string;
  count?: number;
  matches?: MasterRecord[];
  error?: string;
}

export interface ListResponse {
  ok: boolean;
  count?: number;
  records?: MasterRecord[];
  error?: string;
}

export interface HealthResponse {
  ok: boolean;
  sheetName?: string;
  totalRows?: number;
  timestamp?: string;
  error?: string;
}

export interface UpdateResponse {
  ok: boolean;
  message?: string;
  rowIndex?: number;
  updatedRows?: number[];
  record?: MasterRecord;
  records?: MasterRecord[];
  error?: string;
}
