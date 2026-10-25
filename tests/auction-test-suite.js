// CricBid Live Auction Engine - Automated Integration & Concurrency Test Suite
const BASE_URL = 'http://localhost:3000';
const slug = 'ympl-season-2-organised-by-sr11-kqel';

function log(name, pass, detail) {
  const badge = pass ? '\x1b[32m[PASS]\x1b[0m' : '\x1b[31m[FAIL]\x1b[0m';
  console.log(`${badge} ${name}: ${detail}`);
}

async function apiFetch(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    method: options.method || (options.body ? 'POST' : 'GET'),
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  let json = null;
  try {
    json = await res.json();
  } catch (e) {}
  return { status: res.status, json };
}

async function runAuctionTests() {
  console.log('======================================================');
  console.log('CRICBID LIVE AUCTION ENGINE - INTEGRATION AUDIT');
  console.log('======================================================');

  // TEST 1: Fetch Auction State
  try {
    const res = await apiFetch(`/api/auction/${slug}`);
    const pass = res.status === 200 && res.json?.success === true && Array.isArray(res.json?.state?.teams);
    log('AT-01: Auction State Fetch', pass, `Status ${res.status}, Teams: ${res.json?.state?.teams?.length}, Players: ${res.json?.state?.playersQueue?.length}`);
  } catch (e) {
    log('AT-01: Auction State Fetch', false, e.message);
  }

  // TEST 2: Verify 4-Digit Team PIN Login
  let validTeamId = '';
  try {
    const teamsRes = await apiFetch(`/api/auction/${slug}/teams`);
    validTeamId = teamsRes.json?.teams?.[0]?.id;

    // Correct PIN (1111 for Mumbai Titans)
    const loginRes = await apiFetch(`/api/auction/${slug}/teams`, {
      method: 'POST',
      body: { teamId: validTeamId, secretPin: '1111' },
    });
    const pass = loginRes.status === 200 && loginRes.json?.success === true && loginRes.json?.team?.name;
    log('AT-02: Team PIN Authentication Success', pass, `Authenticated as ${loginRes.json?.team?.name}`);

    // Incorrect PIN
    const failRes = await apiFetch(`/api/auction/${slug}/teams`, {
      method: 'POST',
      body: { teamId: validTeamId, secretPin: '9999' },
    });
    const failPass = failRes.status === 401 && failRes.json?.success === false;
    log('AT-03: Team Incorrect PIN Rejection', failPass, `Status ${failRes.status}, Error: ${failRes.json?.error}`);
  } catch (e) {
    log('AT-02/03: Team PIN Auth', false, e.message);
  }

  // TEST 3: Controller Action - Resume Auction
  try {
    const res = await apiFetch(`/api/auction/${slug}/action`, {
      method: 'POST',
      body: {
        action: 'RESUME',
        adminPin: 'Shoaib@55',
      },
    });
    const pass = res.status === 200 && res.json?.state?.room?.status === 'ACTIVE';
    log('AT-04: Auctioneer Resume Action', pass, `Room Status: ${res.json?.state?.room?.status}`);
  } catch (e) {
    log('AT-04: Auctioneer Resume Action', false, e.message);
  }

  // TEST 4: Place Bids - Valid Bid & Stale Bid Rejection
  try {
    const stateRes = await apiFetch(`/api/auction/${slug}`);
    const currentBid = stateRes.json?.state?.room?.currentBid || 1000;
    const nextBid = currentBid + 500;

    // Valid bid
    const bidRes = await apiFetch(`/api/auction/${slug}/bid`, {
      method: 'POST',
      body: {
        teamId: validTeamId,
        amount: nextBid,
      },
    });
    const pass = bidRes.status === 200 && bidRes.json?.success === true && bidRes.json?.state?.room?.currentBid === nextBid;
    log('AT-05: Valid Bid Atomic Placement', pass, `Bid set to ₹${bidRes.json?.state?.room?.currentBid}`);

    // Lower/stale bid rejected
    const staleRes = await apiFetch(`/api/auction/${slug}/bid`, {
      method: 'POST',
      body: {
        teamId: validTeamId,
        amount: nextBid - 100,
      },
    });
    const stalePass = staleRes.status === 400 && staleRes.json?.success === false;
    log('AT-06: Stale/Under-bid Defense', stalePass, `Status ${staleRes.status}, Error: ${staleRes.json?.error}`);
  } catch (e) {
    log('AT-05/06: Bidding Tests', false, e.message);
  }

  // TEST 5: Controller Decision - Mark SOLD
  try {
    const res = await apiFetch(`/api/auction/${slug}/action`, {
      method: 'POST',
      body: {
        action: 'MARK_SOLD',
        adminPin: 'Shoaib@55',
      },
    });
    const pass = res.status === 200 && res.json?.state?.room?.lastAction === 'SOLD';
    log('AT-07: Auctioneer Mark SOLD Decision', pass, `Decision: ${res.json?.state?.room?.lastAction}, Sold History Count: ${res.json?.state?.soldHistory?.length}`);
  } catch (e) {
    log('AT-07: Mark SOLD Decision', false, e.message);
  }

  // TEST 6: Controller Navigation - Next Player
  try {
    const res = await apiFetch(`/api/auction/${slug}/action`, {
      method: 'POST',
      body: {
        action: 'NEXT_PLAYER',
        adminPin: 'Shoaib@55',
      },
    });
    const pass = res.status === 200 && res.json?.state?.currentPlayer?.fullName;
    log('AT-08: Auctioneer Next Player Loading', pass, `Next Active Player: ${res.json?.state?.currentPlayer?.fullName}`);
  } catch (e) {
    log('AT-08: Next Player Loading', false, e.message);
  }

  // TEST 7: Update Room Settings (Base Price & Bid Increment)
  try {
    const res = await apiFetch(`/api/auction/${slug}/action`, {
      method: 'POST',
      body: {
        action: 'UPDATE_SETTINGS',
        payload: {
          basePrice: 2000,
          bidIncrement: 1000,
          timerSeconds: 15,
        },
        adminPin: 'Shoaib@55',
      },
    });
    const pass = res.status === 200 && res.json?.state?.room?.basePrice === 2000 && res.json?.state?.room?.bidIncrement === 1000;
    log('AT-09: Update Room Settings', pass, `BasePrice: ₹${res.json?.state?.room?.basePrice}, Increment: ₹${res.json?.state?.room?.bidIncrement}`);
  } catch (e) {
    log('AT-09: Update Room Settings', false, e.message);
  }

  // TEST 8: Add Custom Franchise & Purse
  const customTeamId = `team_test_${Date.now()}`;
  try {
    const res = await apiFetch(`/api/auction/${slug}/action`, {
      method: 'POST',
      body: {
        action: 'SAVE_TEAM',
        payload: {
          team: {
            id: customTeamId,
            name: 'Hyderabad Hawks',
            shortName: 'HH',
            logoUrl: 'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=100',
            color: '#f97316',
            totalPurse: 250000,
            remainingPurse: 250000,
            maxPlayers: 15,
            secretPin: '7777',
          },
        },
        adminPin: 'Shoaib@55',
      },
    });
    const createdTeam = res.json?.state?.teams?.find((t) => t.id === customTeamId || t.name === 'Hyderabad Hawks');
    const pass = res.status === 200 && createdTeam && createdTeam.totalPurse === 250000;
    log('AT-10: Add Custom Franchise & Purse', pass, `Created ${createdTeam?.name} with ₹${createdTeam?.totalPurse} purse and PIN ${createdTeam?.secretPin}`);
  } catch (e) {
    log('AT-10: Add Custom Franchise & Purse', false, e.message);
  }

  // TEST 9: Update Player Individual Base Price
  try {
    const stateRes = await apiFetch(`/api/auction/${slug}`);
    const firstPlayer = stateRes.json?.state?.playersQueue?.[0]?.player;
    const targetPlayerId = firstPlayer?.registrationId;

    const res = await apiFetch(`/api/auction/${slug}/action`, {
      method: 'POST',
      body: {
        action: 'UPDATE_PLAYER_BASE_PRICE',
        payload: {
          playerId: targetPlayerId,
          basePrice: 3500,
        },
        adminPin: 'Shoaib@55',
      },
    });
    const updatedQueueItem = res.json?.state?.playersQueue?.find((pq) => pq.player.registrationId === targetPlayerId);
    const pass = res.status === 200 && updatedQueueItem?.basePrice === 3500;
    log('AT-11: Update Player Base Price', pass, `Player: ${firstPlayer?.fullName}, Base Price: ₹${updatedQueueItem?.basePrice}`);
  } catch (e) {
    log('AT-11: Update Player Base Price', false, e.message);
  }

  // TEST 10: Clean-up Delete Custom Franchise
  try {
    const res = await apiFetch(`/api/auction/${slug}/action`, {
      method: 'POST',
      body: {
        action: 'DELETE_TEAM',
        payload: {
          teamId: customTeamId,
        },
        adminPin: 'Shoaib@55',
      },
    });
    const exists = res.json?.state?.teams?.some((t) => t.id === customTeamId);
    const pass = res.status === 200 && !exists;
    log('AT-12: Delete Franchise Clean-up', pass, `Team removed successfully`);
  } catch (e) {
    log('AT-12: Delete Franchise Clean-up', false, e.message);
  }

  console.log('======================================================');
  console.log('ALL AUCTION ENGINE TESTS COMPLETE');
  console.log('======================================================');
}

runAuctionTests();
