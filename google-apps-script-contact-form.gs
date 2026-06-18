/**
 * Paste this into Extensions → Apps Script in your Google Sheet, then:
 * Deploy → New deployment → type: Web app → execute as: Me → who has access: Anyone
 * Copy the resulting Web App URL and send it back.
 */
function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var params = e.parameter;

  sheet.appendRow([
    new Date(),
    params.name || '',
    params.phone || '',
    params.business || ''
  ]);

  return ContentService
    .createTextOutput(JSON.stringify({ result: 'success' }))
    .setMimeType(ContentService.MimeType.JSON);
}
