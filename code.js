/**
 * Google Apps Script Web App for Google Sheet: "MASTER DATA"
 *
 * DEPLOYMENT INSTRUCTIONS:
 * 1. Open your Google Sheet containing the "MASTER DATA" sheet.
 * 2. Go to Extensions -> Apps Script.
 * 3. Replace any existing code in Code.gs with this entire file.
 * 4. Click Deploy -> New deployment -> Select type: "Web app".
 * 5. Set "Execute as": Me, and "Who has access": Anyone.
 * 6. Click Deploy, authorize permissions, and copy the Web App URL.
 * 7. Paste that Web App URL into src/config.ts (GAS_WEB_APP_URL) in the React app.
 */

var SHEET_NAME = "MASTER DATA";
var NO_EHRMS_TEXT = "मानव संपदा id (EHRMS ID) नहीं बनी है";

// Exact column headers in "MASTER DATA"
var HEADERS = {
  EMPLOYEE_NAME: "कार्मिक का नाम",
  FATHER_HUSBAND_NAME: "पिता/पति का नाम",
  MOBILE: "मोबाइल नंबर",
  EHRMS_CODE: "EHRMS CODE",
  GENDER: "लिंग",
  DESIGNATION: "पदनाम",
  OFFICE_NAME: "कार्यालय का नाम",
  DEPARTMENT_NAME: "विभाग का नाम",
  VILLAGE: "स्व गणना स्थल/ ग्राम",
  SE_ID: "स्व गणना आइडी(SE ID)",
  SE_DATE: "स्व गणना दिनांक",
  DONE_BY: "स्व गणना किसके द्वारा की गई",
  TIMESTAMP: "TIMESTAMP"
};

/**
 * Handles GET requests:
 * - ?action=health
 * - ?action=lookup&mobile=8077539121
 * - ?action=list&limit=200
 */
function doGet(e) {
  try {
    var params = (e && e.parameter) ? e.parameter : {};
    var action = (params.action || "health").toLowerCase();

    if (action === "health") {
      var sheet = getMasterSheet_();
      var totalRows = Math.max(0, sheet.getLastRow() - 1);
      return jsonResponse_({
        ok: true,
        sheetName: SHEET_NAME,
        totalRows: totalRows,
        timestamp: new Date().toISOString()
      });
    }

    if (action === "lookup") {
      var mobile = normalizeMobile_(params.mobile || "");
      if (!/^\d{10}$/.test(mobile)) {
        return jsonResponse_({
          ok: false,
          error: "Please provide a valid 10-digit mobile number."
        });
      }
      var matches = findRowsByMobile_(mobile);
      return jsonResponse_({
        ok: true,
        mobile: mobile,
        count: matches.length,
        matches: matches
      });
    }

    if (action === "list") {
      var limit = parseInt(params.limit || "250", 10);
      if (isNaN(limit) || limit <= 0) limit = 250;
      var query = String(params.q || "").trim().toUpperCase();
      var records = listRows_(limit, query);
      return jsonResponse_({
        ok: true,
        count: records.length,
        records: records
      });
    }

    return jsonResponse_({
      ok: false,
      error: "Unsupported action: " + action
    });
  } catch (err) {
    return jsonResponse_({
      ok: false,
      error: err && err.message ? err.message : String(err)
    });
  }
}

/**
 * Handles POST requests (using text/plain body to avoid CORS preflight):
 * Payload JSON:
 * {
 *   "action": "update",
 *   "rowIndex": 2,
 *   "mobile": "8077539121",
 *   "fatherHusbandName": "UPPERCASE NAME",
 *   "ehrmsCode": "123456",
 *   "village": "UPPERCASE VILLAGE",
 *   "seId": "P12345678945",
 *   "seDate": "2026-11-18",
 *   "doneBy": "UPPERCASE NAME"
 * }
 */
function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);

    var rawBody = e && e.postData && e.postData.contents ? e.postData.contents : "{}";
    var payload = JSON.parse(rawBody);
    var action = String(payload.action || "update").toLowerCase();

    if (action !== "update" && action !== "create") {
      return jsonResponse_({
        ok: false,
        error: "Unsupported POST action: " + action
      });
    }

    var mobile = normalizeMobile_(payload.mobile || "");
    if (!/^\d{10}$/.test(mobile)) {
      return jsonResponse_({
        ok: false,
        error: "Valid 10-digit mobile number is required."
      });
    }

    var fatherHusbandName = sanitizeUppercaseEnglish_(payload.fatherHusbandName || "");
    var rawEhrms = String(payload.ehrmsCode || "").trim();
    var ehrmsCode = "";
    if (!rawEhrms || rawEhrms.toLowerCase() === NO_EHRMS_TEXT.toLowerCase()) {
      ehrmsCode = NO_EHRMS_TEXT;
    } else {
      ehrmsCode = sanitizeUppercaseAlphanumeric_(rawEhrms);
      if (!ehrmsCode) {
        return jsonResponse_({ ok: false, error: "EHRMS CODE must be in UPPERCASE English alphanumeric." });
      }
    }
    var village = sanitizeUppercasePlace_(payload.village || "");
    var seId = String(payload.seId || "").trim().toUpperCase();
    var seDate = String(payload.seDate || "").trim();
    var doneBy = sanitizeUppercaseEnglish_(payload.doneBy || "");

    if (!fatherHusbandName) {
      return jsonResponse_({ ok: false, error: "पिता/पति का नाम must be in UPPERCASE English alphabet." });
    }
    if (!village) {
      return jsonResponse_({ ok: false, error: "स्व गणना स्थल/ ग्राम must be in UPPERCASE English alphabet." });
    }
    if (!/^P\d{11}$/.test(seId)) {
      return jsonResponse_({
        ok: false,
        error: 'स्व गणना आइडी(SE ID) must start with "P" followed by exactly 11 digits (e.g. P12345678945).'
      });
    }
    if (!seDate) {
      return jsonResponse_({ ok: false, error: "स्व गणना दिनांक is required." });
    }
    if (!doneBy) {
      return jsonResponse_({ ok: false, error: "स्व गणना किसके द्वारा की गई must be in UPPERCASE English alphabet." });
    }

    var sheet = getMasterSheet_();
    var colMap = getColumnIndexMap_(sheet, true);
    var submitTimestamp = formatSubmitTimestamp_();

    if (action === "create") {
      var existingMobileRows = findRowsByMobile_(mobile);
      if (existingMobileRows.length > 0) {
        return jsonResponse_({
          ok: false,
          error:
            "Mobile number " +
            mobile +
            " is already present in MASTER DATA (Row " +
            existingMobileRows[0].rowIndex +
            "). Duplicate mobile numbers are not allowed."
        });
      }

      var employeeName = sanitizeUppercaseEnglish_(payload.employeeName || "");
      var gender = sanitizeUppercaseEnglish_(payload.gender || "");
      var designation = sanitizeUppercaseGeneral_(payload.designation || "");
      var officeName = sanitizeUppercaseGeneral_(payload.officeName || "");
      var departmentName = sanitizeUppercaseGeneral_(payload.departmentName || "");

      if (!employeeName) {
        return jsonResponse_({ ok: false, error: "कार्मिक का नाम must be in UPPERCASE English alphabet." });
      }
      if (!gender) {
        return jsonResponse_({ ok: false, error: "लिंग must be in UPPERCASE English alphabet." });
      }
      if (!designation) {
        return jsonResponse_({ ok: false, error: "पदनाम must be in UPPERCASE English alphabet." });
      }
      if (!officeName) {
        return jsonResponse_({ ok: false, error: "कार्यालय का नाम must be in UPPERCASE English alphabet." });
      }
      if (!departmentName) {
        return jsonResponse_({ ok: false, error: "विभाग का नाम must be in UPPERCASE English alphabet." });
      }

      var newRow = Math.max(2, sheet.getLastRow() + 1);
      setTextCell_(sheet, newRow, colMap.EMPLOYEE_NAME, employeeName);
      setTextCell_(sheet, newRow, colMap.FATHER_HUSBAND_NAME, fatherHusbandName);
      setTextCell_(sheet, newRow, colMap.MOBILE, mobile);
      setTextCell_(sheet, newRow, colMap.EHRMS_CODE, ehrmsCode);
      setTextCell_(sheet, newRow, colMap.GENDER, gender);
      setTextCell_(sheet, newRow, colMap.DESIGNATION, designation);
      setTextCell_(sheet, newRow, colMap.OFFICE_NAME, officeName);
      setTextCell_(sheet, newRow, colMap.DEPARTMENT_NAME, departmentName);
      setTextCell_(sheet, newRow, colMap.VILLAGE, village);
      setTextCell_(sheet, newRow, colMap.SE_ID, seId);
      setTextCell_(sheet, newRow, colMap.SE_DATE, seDate);
      setTextCell_(sheet, newRow, colMap.DONE_BY, doneBy);
      setTextCell_(sheet, newRow, colMap.TIMESTAMP, submitTimestamp);

      SpreadsheetApp.flush();

      var createdRecord = readRowAsRecord_(sheet, newRow, colMap);
      return jsonResponse_({
        ok: true,
        message: "New entry added to MASTER DATA (Row " + newRow + ") at " + submitTimestamp + ".",
        rowIndex: newRow,
        record: createdRecord
      });
    }

    var lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      return jsonResponse_({ ok: false, error: "No employee records found in MASTER DATA." });
    }

    var matches = findRowsByMobile_(mobile);
    if (matches.length === 0) {
      return jsonResponse_({ ok: false, error: "Mobile number not found in MASTER DATA." });
    }

    var requestedRow = parseInt(payload.rowIndex, 10);
    var updatedRowIndices = [];

    for (var m = 0; m < matches.length; m++) {
      var targetRow = matches[m].rowIndex;
      // Write user-entered fields as plain text where needed to preserve formatting
      setTextCell_(sheet, targetRow, colMap.FATHER_HUSBAND_NAME, fatherHusbandName);
      setTextCell_(sheet, targetRow, colMap.EHRMS_CODE, ehrmsCode);
      setTextCell_(sheet, targetRow, colMap.VILLAGE, village);
      setTextCell_(sheet, targetRow, colMap.SE_ID, seId);
      setTextCell_(sheet, targetRow, colMap.SE_DATE, seDate);
      setTextCell_(sheet, targetRow, colMap.DONE_BY, doneBy);
      setTextCell_(sheet, targetRow, colMap.TIMESTAMP, submitTimestamp);
      updatedRowIndices.push(targetRow);
    }

    SpreadsheetApp.flush();

    var updatedRecords = [];
    var primaryRecord = null;
    for (var r = 0; r < updatedRowIndices.length; r++) {
      var rowNum = updatedRowIndices[r];
      var rec = readRowAsRecord_(sheet, rowNum, colMap);
      updatedRecords.push(rec);
      if (rowNum === requestedRow) {
        primaryRecord = rec;
      }
    }
    if (!primaryRecord) {
      primaryRecord = updatedRecords[0];
    }

    var successMsg =
      updatedRowIndices.length > 1
        ? "Record saved to all " +
          updatedRowIndices.length +
          " rows in MASTER DATA (Rows " +
          updatedRowIndices.join(", ") +
          ") at " +
          submitTimestamp +
          "."
        : "Record saved to MASTER DATA (Row " +
          updatedRowIndices[0] +
          ") at " +
          submitTimestamp +
          ".";

    return jsonResponse_({
      ok: true,
      message: successMsg,
      rowIndex: primaryRecord.rowIndex,
      updatedRows: updatedRowIndices,
      record: primaryRecord,
      records: updatedRecords
    });
  } catch (err) {
    return jsonResponse_({
      ok: false,
      error: err && err.message ? err.message : String(err)
    });
  } finally {
    try {
      lock.releaseLock();
    } catch (e2) {}
  }
}

/* ==================== HELPER FUNCTIONS ==================== */

function getMasterSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    throw new Error("No active Spreadsheet found. Bind this script to your MASTER DATA spreadsheet.");
  }
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    throw new Error('Sheet "' + SHEET_NAME + '" not found.');
  }
  return sheet;
}

function getColumnIndexMap_(sheet, ensureTimestampCol) {
  var lastCol = sheet.getLastColumn();
  if (lastCol < 1) {
    throw new Error("Header row is empty.");
  }
  var headerValues = sheet.getRange(1, 1, 1, lastCol).getDisplayValues()[0];
  var normalizedHeaderToCol = {};
  for (var i = 0; i < headerValues.length; i++) {
    var clean = normalizeHeader_(headerValues[i]);
    if (clean) {
      normalizedHeaderToCol[clean] = i + 1;
      normalizedHeaderToCol[clean.toUpperCase()] = i + 1;
    }
  }

  var map = {};
  var keys = Object.keys(HEADERS);
  for (var k = 0; k < keys.length; k++) {
    var key = keys[k];
    if (key === "TIMESTAMP") {
      continue;
    }
    var targetHeader = normalizeHeader_(HEADERS[key]);
    var colIdx = normalizedHeaderToCol[targetHeader];
    if (!colIdx && key === "VILLAGE") {
      var legacyVillageCol = normalizedHeaderToCol["ग्राम"];
      if (legacyVillageCol) {
        colIdx = legacyVillageCol;
        if (ensureTimestampCol) {
          sheet.getRange(1, legacyVillageCol).setValue(HEADERS.VILLAGE);
        }
      }
    }
    if (!colIdx) {
      throw new Error('Missing required column header: "' + HEADERS[key] + '"');
    }
    map[key] = colIdx;
  }

  var tsCol =
    normalizedHeaderToCol["TIMESTAMP"] ||
    normalizedHeaderToCol["SUBMIT TIMESTAMP"] ||
    normalizedHeaderToCol["SUBMISSION TIMESTAMP"] ||
    -1;

  if (tsCol === -1 && ensureTimestampCol) {
    tsCol = lastCol + 1;
    var tsHeaderCell = sheet.getRange(1, tsCol);
    if (lastCol >= 1) {
      sheet
        .getRange(1, lastCol)
        .copyTo(tsHeaderCell, SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
    }
    tsHeaderCell.setValue(HEADERS.TIMESTAMP);
  }
  map.TIMESTAMP = tsCol;

  return map;
}

function normalizeHeader_(val) {
  return String(val || "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeMobile_(val) {
  var digits = String(val || "").replace(/\D/g, "");
  if (digits.length > 10) {
    digits = digits.slice(-10);
  }
  return digits;
}

function sanitizeUppercaseEnglish_(val) {
  return String(val || "")
    .toUpperCase()
    .replace(/[^A-Z.\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function sanitizeUppercaseAlphanumeric_(val) {
  return String(val || "")
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "")
    .trim();
}

function sanitizeUppercasePlace_(val) {
  return String(val || "")
    .toUpperCase()
    .replace(/[^A-Z0-9.,\s-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function sanitizeUppercaseGeneral_(val) {
  return String(val || "")
    .toUpperCase()
    .replace(/[^A-Z0-9.,/()\s-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function formatSubmitTimestamp_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var tz = (ss && ss.getSpreadsheetTimeZone()) || Session.getScriptTimeZone() || "Asia/Kolkata";
  return Utilities.formatDate(new Date(), tz, "dd-MM-yyyy HH:mm:ss");
}

function setTextCell_(sheet, row, col, value) {
  var range = sheet.getRange(row, col);
  range.setNumberFormat("@");
  range.setValue(String(value));
}

function readRowAsRecord_(sheet, rowIndex, colMap) {
  var lastCol = sheet.getLastColumn();
  var rowValues = sheet.getRange(rowIndex, 1, 1, lastCol).getDisplayValues()[0];
  return rowArrayToRecord_(rowValues, rowIndex, colMap);
}

function rowArrayToRecord_(rowValues, rowIndex, colMap) {
  function cell(colNum) {
    return String(rowValues[colNum - 1] || "").trim();
  }
  var rawEhrmsCell = cell(colMap.EHRMS_CODE);
  var ehrmsDisplay = rawEhrmsCell.toLowerCase() === NO_EHRMS_TEXT.toLowerCase()
    ? NO_EHRMS_TEXT
    : rawEhrmsCell.toUpperCase();

  return {
    rowIndex: rowIndex,
    employeeName: cell(colMap.EMPLOYEE_NAME).toUpperCase(),
    fatherHusbandName: cell(colMap.FATHER_HUSBAND_NAME).toUpperCase(),
    mobile: normalizeMobile_(cell(colMap.MOBILE)),
    ehrmsCode: ehrmsDisplay,
    gender: cell(colMap.GENDER).toUpperCase(),
    designation: cell(colMap.DESIGNATION).toUpperCase(),
    officeName: cell(colMap.OFFICE_NAME).toUpperCase(),
    departmentName: cell(colMap.DEPARTMENT_NAME).toUpperCase(),
    village: cell(colMap.VILLAGE).toUpperCase(),
    seId: cell(colMap.SE_ID).toUpperCase(),
    seDate: cell(colMap.SE_DATE),
    doneBy: cell(colMap.DONE_BY).toUpperCase(),
    submittedAt: colMap.TIMESTAMP > 0 ? cell(colMap.TIMESTAMP) : ""
  };
}

function findRowsByMobile_(mobile) {
  var sheet = getMasterSheet_();
  var colMap = getColumnIndexMap_(sheet);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  var lastCol = sheet.getLastColumn();
  var allData = sheet.getRange(2, 1, lastRow - 1, lastCol).getDisplayValues();
  var matches = [];

  for (var i = 0; i < allData.length; i++) {
    var rowMobile = normalizeMobile_(allData[i][colMap.MOBILE - 1]);
    if (rowMobile === mobile) {
      matches.push(rowArrayToRecord_(allData[i], i + 2, colMap));
    }
  }
  return matches;
}

function listRows_(limit, query) {
  var sheet = getMasterSheet_();
  var colMap = getColumnIndexMap_(sheet);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  var lastCol = sheet.getLastColumn();
  var allData = sheet.getRange(2, 1, lastRow - 1, lastCol).getDisplayValues();
  var results = [];

  for (var i = 0; i < allData.length; i++) {
    var rec = rowArrayToRecord_(allData[i], i + 2, colMap);
    if (query) {
      var haystack = [
        rec.employeeName,
        rec.mobile,
        rec.officeName,
        rec.designation,
        rec.ehrmsCode,
        rec.seId,
        rec.village
      ].join(" ");
      if (haystack.indexOf(query) === -1) {
        continue;
      }
    }
    results.push(rec);
    if (results.length >= limit) {
      break;
    }
  }
  return results;
}

function jsonResponse_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
