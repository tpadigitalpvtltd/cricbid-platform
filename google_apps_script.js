/**
 * ============================================================================
 * CRICBID - MULTI-TOURNAMENT & AUCTION PLATFORM (v3.0 ENTERPRISE)
 * GOOGLE APPS SCRIPT MASTER WEBHOOK BACKEND (doPost & doGet)
 * ============================================================================
 * 
 * FEATURES:
 * 1. Multi-Auction Support: All tournaments & auctions are stored in the same
 *    Google Spreadsheet with clean dedicated tabs:
 *      - Tab 1: "Tournaments" (All hosted tournaments, venues, dates, fees)
 *      - Tab 2: "Players"     (All registered players, profiles, payment proof)
 * 2. Instant Sync with Next.js & Vercel:
 *      - doGet?action=tournaments  -> Returns all tournaments JSON
 *      - doGet?action=players&slug=xxx -> Returns all registered players JSON
 *      - doGet?action=count&slug=xxx   -> Returns live draft player count
 *      - doPost (action: "create_tournament") -> Saves/updates tournament
 *      - doPost (player registration) -> Saves player & auto-increments count
 * 
 * ============================================================================
 * STEP-BY-STEP SETUP / UPDATE GUIDE:
 * ============================================================================
 * 1. Open your Google Sheet: https://sheets.google.com
 * 2. In the top menu, click: Extensions -> Apps Script.
 * 3. Delete ANY existing code in Code.gs and paste ALL the code below.
 * 4. Click the "Save" icon (Ctrl + S).
 * 5. Click the blue "Deploy" button at top right -> Choose "Manage deployments".
 * 6. Click the pencil icon (Edit) on your active deployment.
 * 7. Under "Version", select "New version".
 * 8. Make sure "Who has access" is set to "Anyone".
 * 9. Click "Deploy". Done!
 * ============================================================================
 */

// SHEET TAB NAMES
var TAB_TOURNAMENTS = "Tournaments";
var TAB_PLAYERS = "Players";

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(15000); // Wait up to 15 seconds for concurrent traffic

  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // Parse incoming JSON data safely
    var data = {};
    if (e && e.postData && e.postData.contents) {
      data = JSON.parse(e.postData.contents);
    } else if (e && e.parameter) {
      data = e.parameter;
    }

    var action = data.action || (data.type === "tournament" ? "create_tournament" : "register_player");

    // =========================================================================
    // ACTION 1: CREATE OR UPDATE TOURNAMENT
    // =========================================================================
    if (action === "create_tournament" || action === "update_tournament") {
      var tSheet = getOrCreateTournamentsSheet(ss);
      var tRows = tSheet.getDataRange().getValues();
      var existingRowIndex = -1;

      // Check if tournament already exists by slug or id
      var targetSlug = (data.slug || "").toString().toLowerCase().trim();
      var targetId = (data.id || data.idOrSlug || "").toString().trim();

      for (var i = 1; i < tRows.length; i++) {
        var rowId = (tRows[i][0] || "").toString().trim();
        var rowSlug = (tRows[i][1] || "").toString().toLowerCase().trim();
        if ((targetId && rowId === targetId) || (targetSlug && rowSlug === targetSlug)) {
          existingRowIndex = i + 1; // 1-based index
          break;
        }
      }

      var isPaidVal = data.isPaid === true || data.isPaid === "true" || data.isPaid === "YES";
      var entryFeeVal = Number(data.entryFee) || 0;
      var registeredCountVal = Number(data.registeredCount) || 0;

      if (existingRowIndex > 0) {
        // Update existing tournament row
        if (data.title !== undefined) tSheet.getRange(existingRowIndex, 3).setValue(data.title);
        if (data.tagline !== undefined) tSheet.getRange(existingRowIndex, 4).setValue(data.tagline);
        if (data.city !== undefined) tSheet.getRange(existingRowIndex, 5).setValue(data.city);
        if (data.venue !== undefined) tSheet.getRange(existingRowIndex, 6).setValue(data.venue);
        if (data.bannerUrl !== undefined) tSheet.getRange(existingRowIndex, 7).setValue(data.bannerUrl);
        if (data.registrationDeadline !== undefined) tSheet.getRange(existingRowIndex, 8).setValue(data.registrationDeadline);
        if (data.auctionDate !== undefined) tSheet.getRange(existingRowIndex, 9).setValue(data.auctionDate);
        if (data.isPaid !== undefined) tSheet.getRange(existingRowIndex, 10).setValue(isPaidVal ? "YES" : "NO");
        if (data.entryFee !== undefined) tSheet.getRange(existingRowIndex, 11).setValue(entryFeeVal);
        if (data.googleSheetUrl !== undefined) tSheet.getRange(existingRowIndex, 12).setValue(data.googleSheetUrl);
        if (data.organizerName !== undefined) tSheet.getRange(existingRowIndex, 13).setValue(data.organizerName);
        if (data.organizerContact !== undefined) tSheet.getRange(existingRowIndex, 14).setValue(data.organizerContact);
        if (data.registeredCount !== undefined) tSheet.getRange(existingRowIndex, 15).setValue(registeredCountVal);

        return sendJsonResponse({
          status: "success",
          message: "Tournament updated successfully in Google Sheet",
          action: "update_tournament",
          tournament: data
        });
      } else {
        // Append new tournament row
        var newRow = [
          data.id || ("tourn_" + Utilities.formatDate(new Date(), "GMT+5:30", "yyyyMMdd_HHmmss")),
          data.slug || generateSlug(data.title || "cricket-tournament"),
          data.title || "Cricket Tournament",
          data.tagline || (data.city ? data.city + " Premier Cricket Draft" : "Official Cricket Draft 2026"),
          data.city || "",
          data.venue || "",
          data.bannerUrl || "https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?q=80&w=1200&auto=format&fit=crop",
          data.registrationDeadline || "2026-12-31",
          data.auctionDate || "2027-01-10",
          isPaidVal ? "YES" : "NO",
          entryFeeVal,
          data.googleSheetUrl || "",
          data.organizerName || "Tournament Host",
          data.organizerContact ? "'" + data.organizerContact : "",
          registeredCountVal,
          data.createdAt || Utilities.formatDate(new Date(), "GMT+5:30", "yyyy-MM-dd'T'HH:mm:ss'Z'")
        ];

        tSheet.appendRow(newRow);

        return sendJsonResponse({
          status: "success",
          message: "New tournament successfully logged in Google Sheet",
          action: "create_tournament",
          tournament: {
            id: newRow[0],
            slug: newRow[1],
            title: newRow[2],
            tagline: newRow[3],
            city: newRow[4],
            venue: newRow[5],
            bannerUrl: newRow[6],
            registrationDeadline: newRow[7],
            auctionDate: newRow[8],
            isPaid: isPaidVal,
            entryFee: entryFeeVal,
            googleSheetUrl: newRow[11],
            organizerName: newRow[12],
            organizerContact: newRow[13],
            registeredCount: registeredCountVal,
            createdAt: newRow[15]
          }
        });
      }
    }

    // =========================================================================
    // ACTION 2: PLAYER REGISTRATION (DEFAULT)
    // =========================================================================
    var pSheet = getOrCreatePlayersSheet(ss);

    // Format photo display
    var photoDisplay = data.photoUrl || "No photo uploaded";
    if (photoDisplay.length > 500 && photoDisplay.startsWith("data:image")) {
      photoDisplay = "Uploaded (Base64 Image Data - " + Math.round(photoDisplay.length / 1024) + " KB)";
    }

    var finalRegId = data.registrationId || ("CRIC-" + Utilities.formatDate(new Date(), "GMT+5:30", "yyyyMMdd-HHmmss"));
    var playerTimestamp = data.timestamp || Utilities.formatDate(new Date(), "GMT+5:30", "dd/MM/yyyy, hh:mm:ss a");

    var playerRow = [
      playerTimestamp,
      finalRegId,
      data.tournamentSlug || "general",
      data.tournamentTitle || "Cricket Tournament",
      data.fullName || "",
      data.phone ? "'" + data.phone : "",
      data.age || "",
      data.role || "",
      data.battingStyle || "",
      data.bowlingStyle || "",
      data.stats || "None provided",
      photoDisplay,
      data.paymentId || (data.paymentStatus === "FREE" ? "FREE_ENTRY" : "UNPAID"),
      data.orderId || "N/A",
      data.paymentStatus || "PAID",
      data.amount !== undefined ? data.amount : 0
    ];

    pSheet.appendRow(playerRow);

    // Auto-increment registeredCount in Tournaments sheet if exists
    var totalForTournament = incrementTournamentCounter(ss, data.tournamentSlug, data.tournamentTitle);

    var totalPlayers = pSheet.getLastRow() > 1 ? pSheet.getLastRow() - 1 : 0;

    return sendJsonResponse({
      status: "success",
      message: "Player registration logged successfully",
      registrationId: finalRegId,
      tournamentSlug: data.tournamentSlug || "general",
      tournamentCount: totalForTournament,
      totalRegistered: totalPlayers,
      rowNumber: pSheet.getLastRow()
    });

  } catch (error) {
    return sendJsonResponse({
      status: "error",
      message: error.toString()
    });
  } finally {
    lock.releaseLock();
  }
}

// =============================================================================
// GET ENDPOINT - DATA RETRIEVAL (Tournaments, Players, Live Counter)
// =============================================================================
function doGet(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var action = (e && e.parameter && e.parameter.action) ? e.parameter.action : "status";
    var slugParam = (e && e.parameter && e.parameter.slug) ? e.parameter.slug.toLowerCase().trim() : "";

    // 1. GET ALL TOURNAMENTS
    if (action === "tournaments") {
      var tSheet = ss.getSheetByName(TAB_TOURNAMENTS);
      if (!tSheet || tSheet.getLastRow() <= 1) {
        return sendJsonResponse({ status: "success", count: 0, tournaments: [] });
      }

      var rows = tSheet.getDataRange().getValues();
      var tournamentsList = [];

      for (var i = 1; i < rows.length; i++) {
        var r = rows[i];
        if (!r[0] && !r[1] && !r[2]) continue; // Skip empty rows

        var isPaid = r[9] === "YES" || r[9] === true || r[9] === "true";
        var entryFee = Number(r[10]) || 0;
        var regCount = Number(r[14]) || 0;

        tournamentsList.push({
          id: String(r[0] || ""),
          slug: String(r[1] || ""),
          title: String(r[2] || ""),
          tagline: String(r[3] || ""),
          city: String(r[4] || ""),
          venue: String(r[5] || ""),
          bannerUrl: String(r[6] || ""),
          registrationDeadline: String(r[7] || ""),
          auctionDate: String(r[8] || ""),
          isPaid: isPaid,
          entryFee: entryFee,
          googleSheetUrl: String(r[11] || ""),
          organizerName: String(r[12] || ""),
          organizerContact: String(r[13] || "").replace(/^'/, ""),
          registeredCount: regCount,
          createdAt: String(r[15] || "")
        });
      }

      return sendJsonResponse({
        status: "success",
        count: tournamentsList.length,
        tournaments: tournamentsList
      });
    }

    // 2. GET SINGLE TOURNAMENT BY SLUG
    if (action === "tournament") {
      var tSheet = ss.getSheetByName(TAB_TOURNAMENTS);
      if (!tSheet || tSheet.getLastRow() <= 1 || !slugParam) {
        return sendJsonResponse({ status: "error", message: "Tournament not found" });
      }

      var rows = tSheet.getDataRange().getValues();
      for (var i = 1; i < rows.length; i++) {
        var r = rows[i];
        var rowSlug = String(r[1] || "").toLowerCase().trim();
        if (rowSlug === slugParam) {
          var isPaid = r[9] === "YES" || r[9] === true;
          return sendJsonResponse({
            status: "success",
            tournament: {
              id: String(r[0] || ""),
              slug: String(r[1] || ""),
              title: String(r[2] || ""),
              tagline: String(r[3] || ""),
              city: String(r[4] || ""),
              venue: String(r[5] || ""),
              bannerUrl: String(r[6] || ""),
              registrationDeadline: String(r[7] || ""),
              auctionDate: String(r[8] || ""),
              isPaid: isPaid,
              entryFee: Number(r[10]) || 0,
              googleSheetUrl: String(r[11] || ""),
              organizerName: String(r[12] || ""),
              organizerContact: String(r[13] || "").replace(/^'/, ""),
              registeredCount: Number(r[14]) || 0,
              createdAt: String(r[15] || "")
            }
          });
        }
      }

      return sendJsonResponse({ status: "error", message: "Tournament not found with slug: " + slugParam });
    }

    // 3. GET PLAYERS (All or filtered by Tournament Slug)
    if (action === "players") {
      var pSheet = ss.getSheetByName(TAB_PLAYERS);
      if (!pSheet) pSheet = ss.getActiveSheet();

      if (!pSheet || pSheet.getLastRow() <= 1) {
        return sendJsonResponse({ status: "success", total: 0, players: [] });
      }

      var rows = pSheet.getDataRange().getValues();
      var playersList = [];

      for (var i = 1; i < rows.length; i++) {
        var r = rows[i];
        if (!r[1] && !r[4]) continue; // Skip empty row

        var rowSlug = String(r[2] || "").toLowerCase().trim();
        var rowTournTitle = String(r[3] || "").toLowerCase().trim();

        // If slug provided, filter by tournament
        if (slugParam && rowSlug !== slugParam && !rowTournTitle.includes(slugParam)) {
          continue;
        }

        playersList.push({
          timestamp: String(r[0] || ""),
          registrationId: String(r[1] || ""),
          tournamentSlug: String(r[2] || ""),
          tournamentTitle: String(r[3] || ""),
          fullName: String(r[4] || ""),
          phone: String(r[5] || "").replace(/^'/, ""),
          age: String(r[6] || ""),
          role: String(r[7] || ""),
          battingStyle: String(r[8] || ""),
          bowlingStyle: String(r[9] || ""),
          stats: String(r[10] || ""),
          photoUrl: String(r[11] || ""),
          paymentId: String(r[12] || ""),
          orderId: String(r[13] || ""),
          paymentStatus: String(r[14] || "PAID"),
          amount: Number(r[15]) || 0
        });
      }

      return sendJsonResponse({
        status: "success",
        tournamentSlug: slugParam || "all",
        total: playersList.length,
        players: playersList
      });
    }

    // 4. GET LIVE PLAYER COUNT
    if (action === "count") {
      var pSheet = ss.getSheetByName(TAB_PLAYERS);
      if (!pSheet) pSheet = ss.getActiveSheet();

      var count = 0;
      if (pSheet && pSheet.getLastRow() > 1) {
        if (!slugParam) {
          count = pSheet.getLastRow() - 1;
        } else {
          var rows = pSheet.getDataRange().getValues();
          for (var i = 1; i < rows.length; i++) {
            var rowSlug = String(rows[i][2] || "").toLowerCase().trim();
            if (rowSlug === slugParam) count++;
          }
        }
      }

      return sendJsonResponse({
        status: "success",
        count: count,
        tournamentSlug: slugParam || "all",
        timestamp: new Date().toISOString()
      });
    }

    // 5. DEFAULT HEALTH STATUS
    var pSheet = ss.getSheetByName(TAB_PLAYERS) || ss.getActiveSheet();
    var totalReg = pSheet && pSheet.getLastRow() > 1 ? pSheet.getLastRow() - 1 : 0;

    return sendJsonResponse({
      status: "online",
      version: "3.0",
      message: "CricBid Multi-Auction Webhook v3 is active and operational!",
      totalRegistered: totalReg,
      tabs: ss.getSheets().map(function(s) { return s.getName(); }),
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    return sendJsonResponse({
      status: "error",
      message: error.toString()
    });
  }
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function getOrCreateTournamentsSheet(ss) {
  var sheet = ss.getSheetByName(TAB_TOURNAMENTS);
  if (!sheet) {
    sheet = ss.insertSheet(TAB_TOURNAMENTS);
    var headers = [
      "Tournament ID",
      "Slug",
      "Title",
      "Tagline",
      "City",
      "Venue",
      "Banner URL",
      "Registration Deadline",
      "Auction Date",
      "Is Paid",
      "Entry Fee (INR)",
      "Google Sheet URL",
      "Organizer Name",
      "Organizer Contact",
      "Total Registered",
      "Created At"
    ];
    sheet.appendRow(headers);
    var headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setBackground("#0F172A"); // Dark Navy
    headerRange.setFontColor("#F59E0B"); // Gold
    headerRange.setFontWeight("bold");
    headerRange.setFontSize(11);
    sheet.setFrozenRows(1);
    for (var col = 1; col <= headers.length; col++) {
      sheet.autoResizeColumn(col);
    }
  }
  return sheet;
}

function getOrCreatePlayersSheet(ss) {
  var sheet = ss.getSheetByName(TAB_PLAYERS);
  if (!sheet) {
    // If "Sheet1" is active and empty or contains headers, rename it or insert new
    var active = ss.getActiveSheet();
    if (active.getName() === "Sheet1" && active.getLastRow() <= 1) {
      active.setName(TAB_PLAYERS);
      sheet = active;
    } else {
      sheet = ss.insertSheet(TAB_PLAYERS);
    }

    var headers = [
      "Timestamp",
      "Registration ID",
      "Tournament Slug",
      "Tournament Name",
      "Full Name",
      "Phone / WhatsApp",
      "Age",
      "Primary Role",
      "Batting Style",
      "Bowling Style",
      "Previous Stats & Achievements",
      "Photo Link / Data",
      "Razorpay Payment ID",
      "Order ID",
      "Payment Status",
      "Amount (INR)"
    ];
    sheet.clear();
    sheet.appendRow(headers);
    var headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setBackground("#0F172A");
    headerRange.setFontColor("#10B981"); // Emerald Green
    headerRange.setFontWeight("bold");
    headerRange.setFontSize(11);
    sheet.setFrozenRows(1);
    for (var col = 1; col <= headers.length; col++) {
      sheet.autoResizeColumn(col);
    }
  }
  return sheet;
}

function incrementTournamentCounter(ss, tournamentSlug, tournamentTitle) {
  try {
    var tSheet = ss.getSheetByName(TAB_TOURNAMENTS);
    if (!tSheet || tSheet.getLastRow() <= 1) return 1;

    var rows = tSheet.getDataRange().getValues();
    var targetSlug = (tournamentSlug || "").toLowerCase().trim();
    var targetTitle = (tournamentTitle || "").toLowerCase().trim();

    for (var i = 1; i < rows.length; i++) {
      var rowSlug = String(rows[i][1] || "").toLowerCase().trim();
      var rowTitle = String(rows[i][2] || "").toLowerCase().trim();

      if ((targetSlug && rowSlug === targetSlug) || (targetTitle && rowTitle === targetTitle)) {
        var currentCount = Number(rows[i][14]) || 0;
        var newCount = currentCount + 1;
        tSheet.getRange(i + 1, 15).setValue(newCount);
        return newCount;
      }
    }
    return 1;
  } catch (e) {
    return 0;
  }
}

function generateSlug(text) {
  return text
    .toString()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "") + "-" + Math.random().toString(36).substring(2, 6);
}

function sendJsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}