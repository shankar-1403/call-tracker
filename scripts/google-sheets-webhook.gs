/**
 * READ-ONLY Apps Script — optimized for large lead sheets (6000+ rows).
 *
 * Deploy as Web app: Execute as Me, Who has access Anyone (ANYONE_ANONYMOUS).
 *
 * Endpoints:
 *   ?action=tabs
 *   ?action=leads&all=0&gid=GID&slim=1   ← preferred (small payload)
 *   ?action=leads&all=1&slim=1
 */

function jsonResponse_(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(
    ContentService.MimeType.JSON,
  );
}

function getSpreadsheet_() {
  // Ensure sheet reads see the latest saved rows (important right after edits).
  SpreadsheetApp.flush();
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet) {
    throw new Error(
      'No active spreadsheet. Open Apps Script from Extensions inside the Lead Google Sheet.',
    );
  }
  return spreadsheet;
}

function getSheetByName_(sheetName) {
  const spreadsheet = getSpreadsheet_();
  const sheet = spreadsheet.getSheetByName(sheetName) || spreadsheet.getActiveSheet();
  if (!sheet) {
    throw new Error('Sheet not found: ' + sheetName);
  }
  return sheet;
}

function getSheetByGid_(gid) {
  const spreadsheet = getSpreadsheet_();
  const sheets = spreadsheet.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    if (sheets[i].getSheetId() === Number(gid)) {
      return sheets[i];
    }
  }
  throw new Error('Sheet tab not found for gid: ' + gid);
}

function normalizePhone_(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) {
    return '';
  }
  if (digits.length <= 8) {
    return digits;
  }
  return digits.slice(-8);
}

function findColumnIndex_(headers, candidates) {
  var lowered = headers.map(function (header) {
    return String(header || '').trim().toLowerCase();
  });

  for (var j = 0; j < candidates.length; j++) {
    var candidate = candidates[j];
    for (var i = 0; i < lowered.length; i++) {
      if (lowered[i] === candidate) {
        return i;
      }
    }
  }

  for (var k = 0; k < candidates.length; k++) {
    var partial = candidates[k];
    for (var n = 0; n < lowered.length; n++) {
      if (lowered[n].indexOf(partial) !== -1) {
        return n;
      }
    }
  }

  return -1;
}

function pickDisplayName_(row, nameIndexes) {
  for (var i = 0; i < nameIndexes.length; i++) {
    var index = nameIndexes[i];
    if (index === -1) {
      continue;
    }
    var value = String(row[index] || '').trim();
    if (value) {
      return value;
    }
  }
  return 'Unknown';
}

function mergeHeaders_(existing, nextHeaders) {
  var seen = {};
  var merged = [];
  for (var i = 0; i < existing.length; i++) {
    if (!seen[existing[i]]) {
      seen[existing[i]] = true;
      merged.push(existing[i]);
    }
  }
  for (var j = 0; j < nextHeaders.length; j++) {
    if (nextHeaders[j] && !seen[nextHeaders[j]]) {
      seen[nextHeaders[j]] = true;
      merged.push(nextHeaders[j]);
    }
  }
  return merged;
}

var PHONE_HEADERS_ = [
  'phone_number',
  'phone number',
  'mobile number',
  'contact number',
  'mobile no',
  'mobile no.',
  'mob no',
  'mob. no',
  'contact no',
  'contact no.',
  'whatsapp number',
  'whatsapp',
  'cell number',
  'cell phone',
  'telephone',
  'tel',
  'ph no',
  'ph. no',
  'ph.no',
  'mo. no',
  'mo no',
  'mobile',
  'phone',
  'cell',
];

/**
 * If headers don't match, pick the column where most sample cells look like phone numbers.
 * @param {string[][]} values
 * @return {number} column index or -1
 */
function detectPhoneColumnFromData_(values) {
  if (!values || values.length < 2 || !values[0] || values[0].length < 1) {
    return -1;
  }

  var colCount = values[0].length;
  var sampleEnd = Math.min(values.length, 31);
  var bestIndex = -1;
  var bestScore = 0;

  for (var col = 0; col < colCount; col++) {
    var hits = 0;
    var checked = 0;
    for (var row = 1; row < sampleEnd; row++) {
      var raw = String(values[row][col] || '').trim();
      if (!raw) {
        continue;
      }
      checked += 1;
      var digits = raw.replace(/\D/g, '');
      // Indian mobiles are typically 10 digits; allow 8–15 after stripping
      if (digits.length >= 8 && digits.length <= 15) {
        hits += 1;
      }
    }
    if (checked >= 3 && hits / checked >= 0.6 && hits > bestScore) {
      bestScore = hits;
      bestIndex = col;
    }
  }

  return bestIndex;
}

/**
 * @param {string[]} headers
 * @param {string[][]} values
 * @return {number}
 */
function resolvePhoneColumn_(headers, values) {
  var fromHeader = findColumnIndex_(headers, PHONE_HEADERS_);
  if (fromHeader !== -1) {
    return fromHeader;
  }
  return detectPhoneColumnFromData_(values);
}

/** Only these columns are returned in slim mode (keeps 6k+ rows fast). */
var SLIM_HEADER_CANDIDATES_ = [
  'Date',
  'date',
  'company_name',
  'company name',
  'full name',
  'fullname',
  'phone_number',
  'phone number',
  'email',
  'city',
  'Name',
  'name',
  'Status',
  'status',
  'Remarks',
  'remarks',
];

function readHeaderRow_(sheet) {
  var lastCol = sheet.getLastColumn();
  if (lastCol < 1) {
    return [];
  }
  return sheet
    .getRange(1, 1, 1, lastCol)
    .getDisplayValues()[0]
    .map(function (header) {
      return String(header || '').trim();
    });
}

function listLeadTabs_() {
  var sheets = getSpreadsheet_().getSheets();
  var tabs = [];
  var skipped = [];

  for (var i = 0; i < sheets.length; i++) {
    var sheet = sheets[i];
    var lastRow = sheet.getLastRow();
    var lastCol = sheet.getLastColumn();
    if (lastRow < 2 || lastCol < 1) {
      skipped.push({
        sheet: sheet.getName(),
        gid: String(sheet.getSheetId()),
        reason: 'No data rows',
      });
      continue;
    }

    var values = sheet.getRange(1, 1, Math.min(lastRow, 31), lastCol).getDisplayValues();
    var headers = values[0].map(function (header) {
      return String(header || '').trim();
    });
    var phoneIndex = resolvePhoneColumn_(headers, values);

    if (phoneIndex === -1) {
      skipped.push({
        sheet: sheet.getName(),
        gid: String(sheet.getSheetId()),
        reason: 'No phone column (headers: ' + headers.filter(Boolean).slice(0, 8).join(', ') + ')',
      });
      continue;
    }

    tabs.push({
      sheet: sheet.getName(),
      gid: String(sheet.getSheetId()),
      rows: lastRow - 1,
    });
  }

  return { tabs: tabs, skipped: skipped };
}

function getSlimColumnIndexes_(headers) {
  var indexes = [];
  var seen = {};
  for (var i = 0; i < headers.length; i++) {
    if (!headers[i]) {
      continue;
    }
    var lower = headers[i].toLowerCase();
    for (var j = 0; j < SLIM_HEADER_CANDIDATES_.length; j++) {
      if (lower === SLIM_HEADER_CANDIDATES_[j].toLowerCase() && !seen[i]) {
        seen[i] = true;
        indexes.push(i);
        break;
      }
    }
  }
  return indexes;
}

/**
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @param {{ slim?: boolean }} options
 */
function getLeadsFromSheet_(sheet, options) {
  options = options || {};
  var slim = options.slim !== false; // default slim for performance

  var sheetName = sheet.getName();
  var sheetGid = String(sheet.getSheetId());
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();

  if (lastRow < 2 || lastCol < 1) {
    return {
      headers: [],
      leads: [],
      skipped: true,
      sheetName: sheetName,
      reason: 'No data rows',
    };
  }

  var values = sheet.getRange(1, 1, lastRow, lastCol).getDisplayValues();
  var headers = values[0].map(function (header) {
    return String(header || '').trim();
  });

  var phoneIndex = resolvePhoneColumn_(headers, values);
  if (phoneIndex === -1) {
    return {
      headers: headers,
      leads: [],
      skipped: true,
      sheetName: sheetName,
      reason: 'No phone column (headers: ' + headers.filter(Boolean).slice(0, 8).join(', ') + ')',
      invalidPhoneRows: 0,
    };
  }

  var fullNameIndex = findColumnIndex_(headers, ['full name', 'fullname']);
  var companyIndex = findColumnIndex_(headers, ['company_name', 'company name', 'company']);
  var nameIndex = findColumnIndex_(headers, ['name', 'contact name', 'lead name', 'customer']);
  var slimIndexes = slim ? getSlimColumnIndexes_(headers) : null;
  var leads = [];
  var invalidPhoneRows = 0;
  var outHeaders = [];

  if (slim) {
    // Always keep the detected phone column in slim output
    var phoneInSlim = false;
    for (var s = 0; s < slimIndexes.length; s++) {
      outHeaders.push(headers[slimIndexes[s]]);
      if (slimIndexes[s] === phoneIndex) {
        phoneInSlim = true;
      }
    }
    if (!phoneInSlim) {
      slimIndexes.push(phoneIndex);
      outHeaders.push(headers[phoneIndex] || 'phone_number');
    }
    if (outHeaders.indexOf('Sheet Tab') === -1) {
      outHeaders.push('Sheet Tab');
    }
  } else {
    outHeaders = headers.filter(function (header) {
      return !!header;
    });
    outHeaders.push('Sheet Tab');
  }

  for (var row = 1; row < values.length; row++) {
    var phoneNumber = String(values[row][phoneIndex] || '').trim();
    var normalizedPhone = normalizePhone_(phoneNumber);
    if (!normalizedPhone || normalizedPhone.length < 8) {
      invalidPhoneRows += 1;
      continue;
    }

    var raw = {};
    if (slim) {
      for (var c = 0; c < slimIndexes.length; c++) {
        var col = slimIndexes[c];
        raw[headers[col] || 'phone_number'] = String(values[row][col] || '');
      }
    } else {
      for (var col2 = 0; col2 < headers.length; col2++) {
        if (headers[col2]) {
          raw[headers[col2]] = String(values[row][col2] || '');
        }
      }
    }
    raw['Sheet Tab'] = sheetName;

    leads.push({
      rowNumber: row + 1,
      sheetName: sheetName,
      sheetGid: sheetGid,
      name: pickDisplayName_(values[row], [fullNameIndex, companyIndex, nameIndex]),
      phoneNumber: phoneNumber,
      normalizedPhone: normalizedPhone,
      raw: raw,
    });
  }

  return {
    headers: outHeaders,
    leads: leads,
    skipped: false,
    sheetName: sheetName,
    invalidPhoneRows: invalidPhoneRows,
  };
}

function getLeadsFromAllSheets_(options) {
  var sheets = getSpreadsheet_().getSheets();
  var allLeads = [];
  var headers = [];
  var tabs = [];
  var skipped = [];

  for (var i = 0; i < sheets.length; i++) {
    var result = getLeadsFromSheet_(sheets[i], options);
    if (result.skipped) {
      skipped.push({
        sheet: result.sheetName,
        reason: result.reason || 'Skipped',
      });
      continue;
    }

    tabs.push({
      sheet: result.sheetName,
      count: result.leads.length,
    });
    headers = mergeHeaders_(headers, result.headers);
    allLeads = allLeads.concat(result.leads);
  }

  return {
    headers: headers,
    leads: allLeads,
    tabs: tabs,
    skipped: skipped,
  };
}

function getLeads_(sheetName, gid, allTabs, options) {
  if (allTabs) {
    return getLeadsFromAllSheets_(options);
  }

  var sheet = gid ? getSheetByGid_(gid) : getSheetByName_(sheetName || 'Leads');
  var result = getLeadsFromSheet_(sheet, options);
  if (result.skipped) {
    throw new Error(
      'Could not find a phone column on tab "' +
        result.sheetName +
        '". Expected "phone_number" (or Phone Number / Mobile).',
    );
  }

  return {
    headers: result.headers,
    leads: result.leads,
    tabs: [{ sheet: result.sheetName, gid: String(sheet.getSheetId()), count: result.leads.length }],
    skipped: [],
  };
}

function doGet(e) {
  try {
    const action = e && e.parameter ? e.parameter.action : '';

    if (action === 'tabs') {
      const listed = listLeadTabs_();
      return jsonResponse_({
        success: true,
        readOnly: true,
        count: listed.tabs.length,
        tabs: listed.tabs,
        skippedTabs: listed.skipped,
      });
    }

    if (action === 'leads') {
      const sheetName = (e.parameter.sheet || '').trim();
      const gid = e.parameter.gid ? String(e.parameter.gid).trim() : '';
      const allParam = e.parameter.all != null ? String(e.parameter.all).trim() : '';
      const slimParam = e.parameter.slim != null ? String(e.parameter.slim).trim() : '1';
      const allTabs =
        allParam === '1' ||
        allParam.toLowerCase() === 'true' ||
        (!gid && !sheetName && allParam !== '0');
      const slim = slimParam !== '0' && slimParam.toLowerCase() !== 'false';

      const result = getLeads_(sheetName, gid, allTabs, { slim: slim });
      return jsonResponse_({
        success: true,
        readOnly: true,
        privateSheet: true,
        slim: slim,
        allTabs: allTabs,
        sheet: allTabs ? 'ALL' : sheetName || null,
        gid: gid || null,
        fetchedAt: new Date().toISOString(),
        tabs: result.tabs,
        skippedTabs: result.skipped,
        headers: result.headers,
        count: result.leads.length,
        leads: result.leads,
      });
    }

    return jsonResponse_({
      success: true,
      readOnly: true,
      privateSheet: true,
      message: 'Private Lead sheet webhook is live (read-only).',
      endpoints: {
        tabs: '?action=tabs',
        oneTabSlim: '?action=leads&all=0&gid=YOUR_GID&slim=1',
        allTabsSlim: '?action=leads&all=1&slim=1',
      },
    });
  } catch (error) {
    return jsonResponse_({
      success: false,
      error: String(error),
    });
  }
}

function doPost() {
  return jsonResponse_({
    success: false,
    error: 'Write disabled. This webhook is read-only.',
  });
}
