/**
 * ============================================================================
 * CRICBID - MULTI-TOURNAMENT & AUCTION PLATFORM
 * GOOGLE APPS SCRIPT WEBHOOK BACKEND (doPost & doGet)
 * ============================================================================
 * 
 * STEP-BY-STEP SETUP GUIDE:
 * ----------------------------------------------------------------------------
 * 1. Open Google Sheets (https://sheets.google.com) and create a New Spreadsheet.
 * 2. Name your spreadsheet (e.g. "CricBid - Tournament Registrations 2026").
 * 3. In the top menu, click: Extensions -> Apps Script.
 * 4. Delete any default code in Code.gs and replace it with ALL the code in this file.
 * 5. Click "Save" (the disk icon or Ctrl+S).
 * 6. Click the blue "Deploy" button at the top right -> Choose "New deployment".
 * 7. Click the gear icon (Select type) -> Select "Web app".
 * 8. Set the following settings:
 *      - Description: "CricBid Webhook v2"
 *      - Execute as: "Me (your email address)"
 *      - Who has access: "Anyone" (CRITICAL: Select "Anyone" so the Next.js app can post/read data)
 * 9. Click "Deploy" and authorize access when prompted.
 * 10. Copy the generated "Web App URL" (it looks like: https://script.google.com/macros/s/AKfycb.../exec).
 * 11. Paste this URL into your tournament settings on CricBid or in .env.local:
 *     GOOGLE_SHEET_SCRIPT_URL=https://script.google.com/macros/s/AKfycb.../exec
 * 
 * ============================================================================
 */

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000); // Wait up to 10 seconds for concurrent requests

  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    
    // Parse incoming JSON data
    var data;
    if (e.postData && e.postData.contents) {
      data = JSON.parse(e.postData.contents);
    } else {
      data = e.parameter;
    }

    // Define headers
    var headers = [
      "Timestamp",
      "Registration ID",
      "Tournament",
      "Full Name",
      "Phone / WhatsApp",
      "Age",
      "Primary Role",
      "Batting Style",
      "Bowling Style",
      "Previous Stats & Achievements",
      "Photo Link / Data",
      "Razorpay Payment ID",
      "Payment Status",
      "Amount (INR)"
    ];

    // If sheet is empty, write headers with styling
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(headers);
      var headerRange = sheet.getRange(1, 1, 1, headers.length);
      headerRange.setBackground("#0F172A"); // Dark Navy
      headerRange.setFontColor("#F59E0B"); // Gold
      headerRange.setFontWeight("bold");
      headerRange.setFontSize(11);
      sheet.setFrozenRows(1);
    }

    // Format photo display
    var photoDisplay = data.photoUrl || "No photo uploaded";
    if (photoDisplay.length > 500 && photoDisplay.startsWith("data:image")) {
      photoDisplay = "Uploaded (Base64 Image Data - " + Math.round(photoDisplay.length / 1024) + " KB)";
    }

    // Prepare row data
    var row = [
      data.timestamp || new Date().toISOString(),
      data.registrationId || ("CRIC-" + Utilities.formatDate(new Date(), "GMT+5:30", "yyyyMMdd-HHmmss")),
      data.tournamentTitle || data.tournamentSlug || "CricBid Tournament",
      data.fullName || "",
      data.phone ? "'" + data.phone : "", // Prefix apostrophe to preserve leading zeros
      data.age || "",
      data.role || "",
      data.battingStyle || "",
      data.bowlingStyle || "",
      data.stats || "None provided",
      photoDisplay,
      data.paymentId || (data.paymentStatus === "FREE" ? "FREE_ENTRY" : "UNPAID"),
      data.paymentStatus || "PAID",
      data.amount !== undefined ? data.amount : 0
    ];

    // Append the row to Google Sheet
    sheet.appendRow(row);

    // Auto-fit columns
    for (var col = 1; col <= headers.length; col++) {
      sheet.autoResizeColumn(col);
    }

    var totalRegistered = sheet.getLastRow() - 1;

    // Return success response with updated player count
    return ContentService
      .createTextOutput(JSON.stringify({
        status: "success",
        message: "Player registration logged successfully",
        registrationId: row[1],
        totalRegistered: totalRegistered,
        rowNumber: sheet.getLastRow()
      }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({
        status: "error",
        message: error.toString()
      }))
      .setMimeType(ContentService.MimeType.JSON);

  } finally {
    lock.releaseLock();
  }
}

/**
 * GET Endpoint for:
 * 1. Live Player Counter: ?action=count
 * 2. Health check & status
 */
function doGet(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var lastRow = sheet.getLastRow();
    var registeredCount = lastRow > 1 ? lastRow - 1 : 0;
    var action = (e && e.parameter && e.parameter.action) ? e.parameter.action : "status";

    if (action === "count") {
      return ContentService
        .createTextOutput(JSON.stringify({
          status: "success",
          count: registeredCount,
          timestamp: new Date().toISOString()
        }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService
      .createTextOutput(JSON.stringify({
        status: "online",
        message: "CricBid Webhook endpoint is active and working!",
        totalRegistered: registeredCount,
        timestamp: new Date().toISOString()
      }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({
        status: "error",
        message: error.toString()
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
