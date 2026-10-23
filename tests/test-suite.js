// CricBid Platform - Comprehensive Automated Regression & Security Test Suite
// Covers Phases 1 to 12 requirements: Auth, Payment Integrity, Validation, Privacy, Lifecycle

const BASE_URL = 'http://localhost:3000';
let adminSessionCookie = '';
const results = [];

function logTest(id, name, pass, detail, evidence) {
  results.push({ id, name, pass, detail, evidence });
  const badge = pass ? '\x1b[32m[PASS]\x1b[0m' : '\x1b[31m[FAIL]\x1b[0m';
  console.log(`${badge} ${id}: ${name} - ${detail}`);
}

async function apiFetch(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (adminSessionCookie && !options.noCookie) {
    headers['Cookie'] = adminSessionCookie;
  }

  const fetchOptions = {
    method: options.method || (options.body ? 'POST' : 'GET'),
    headers,
  };

  if (options.body) {
    fetchOptions.body =
      typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
  }

  const res = await fetch(url, fetchOptions);
  let json = null;
  const text = await res.text();
  try {
    json = JSON.parse(text);
  } catch (e) {}

  return {
    status: res.status,
    headers: res.headers,
    text,
    json,
  };
}

async function runTests() {
  console.log('\n======================================================');
  console.log('CRICBID PLATFORM - AUTOMATED REGRESSION & SECURITY AUDIT');
  console.log('======================================================\n');

  // TEST 1: Public Tournaments API
  try {
    const res = await apiFetch('/api/tournaments');
    const pass = res.status === 200 && Array.isArray(res.json?.tournaments);
    logTest(
      'TC-01',
      'Tournaments List API',
      pass,
      `Status ${res.status}, Count: ${res.json?.tournaments?.length || 0}`,
      JSON.stringify(res.json?.tournaments?.[0] || {}).slice(0, 80)
    );
  } catch (e) {
    logTest('TC-01', 'Tournaments List API', false, e.message);
  }

  // TEST 2: Tournament Detail - Unknown Slug
  try {
    const res = await apiFetch('/api/tournaments/unknown-slug-xyz-999');
    const pass = res.status === 404 && res.json?.success === false;
    logTest(
      'TC-02',
      'Unknown Tournament 404 Handling',
      pass,
      `Status ${res.status}, Expected 404`,
      res.text
    );
  } catch (e) {
    logTest('TC-02', 'Unknown Tournament 404 Handling', false, e.message);
  }

  // TEST 3: Unauthenticated Access to Admin Players API (Should be 401)
  try {
    const res = await apiFetch('/api/admin/players', { noCookie: true });
    const pass = res.status === 401 && res.json?.success === false;
    logTest(
      'TC-03',
      'Unauthenticated Admin Players Access Blocked',
      pass,
      `Status ${res.status} (Expected 401 Unauthorized)`,
      res.text
    );
  } catch (e) {
    logTest('TC-03', 'Unauthenticated Admin Players Access Blocked', false, e.message);
  }

  // TEST 4: Unauthenticated Admin Tournament Mutation (PATCH Should be 401)
  try {
    const res = await apiFetch('/api/tournaments/ympl-2026-season-2-jlhb', {
      method: 'PATCH',
      noCookie: true,
      body: { title: 'Hacked Title' },
    });
    const pass = res.status === 401 && res.json?.success === false;
    logTest(
      'TC-04',
      'Unauthenticated Tournament Patch Blocked',
      pass,
      `Status ${res.status} (Expected 401 Unauthorized)`,
      res.text
    );
  } catch (e) {
    logTest('TC-04', 'Unauthenticated Tournament Patch Blocked', false, e.message);
  }

  // TEST 5: Unauthenticated Admin Tournament Deletion (DELETE Should be 401)
  try {
    const res = await apiFetch('/api/tournaments/ympl-2026-season-2-jlhb', {
      method: 'DELETE',
      noCookie: true,
    });
    const pass = res.status === 401 && res.json?.success === false;
    logTest(
      'TC-05',
      'Unauthenticated Tournament Delete Blocked',
      pass,
      `Status ${res.status} (Expected 401 Unauthorized)`,
      res.text
    );
  } catch (e) {
    logTest('TC-05', 'Unauthenticated Tournament Delete Blocked', false, e.message);
  }

  // TEST 6: Admin Login with Wrong Password (Should be 401)
  try {
    const res = await apiFetch('/api/admin/auth', {
      method: 'POST',
      body: { password: 'wrong_password_999' },
    });
    const pass = res.status === 401 && res.json?.success === false;
    logTest(
      'TC-06',
      'Admin Auth Invalid Password Rejection',
      pass,
      `Status ${res.status} (Expected 401)`,
      res.text
    );
  } catch (e) {
    logTest('TC-06', 'Admin Auth Invalid Password Rejection', false, e.message);
  }

  // TEST 7: Admin Login with Correct Password (Should set HttpOnly cookie)
  try {
    const adminPass =
      process.env.ADMIN_PASSWORD ||
      process.env.ADMIN_PIN ||
      process.env.NEXT_PUBLIC_ADMIN_PIN ||
      'Shoaib@55';
    const res = await apiFetch('/api/admin/auth', {
      method: 'POST',
      body: { password: adminPass },
    });
    const setCookie = res.headers.get('set-cookie');
    const pass = res.status === 200 && res.json?.success === true && Boolean(setCookie);
    if (setCookie) {
      adminSessionCookie = setCookie.split(';')[0];
    }
    logTest(
      'TC-07',
      'Admin Auth Success & Session Issuance',
      pass,
      `Status ${res.status}, Session Cookie Created: ${Boolean(adminSessionCookie)}`,
      res.text
    );
  } catch (e) {
    logTest('TC-07', 'Admin Auth Success & Session Issuance', false, e.message);
  }

  // TEST 8: Authenticated Session Verification Endpoint (GET /api/admin/auth)
  try {
    const res = await apiFetch('/api/admin/auth');
    const pass = res.status === 200 && res.json?.authenticated === true;
    logTest(
      'TC-08',
      'Admin Session Token Verification',
      pass,
      `Status ${res.status}, Authenticated: ${res.json?.authenticated}`,
      res.text
    );
  } catch (e) {
    logTest('TC-08', 'Admin Session Token Verification', false, e.message);
  }

  // TEST 9: Authenticated Access to Admin Players API (Should be 200 with cookie)
  try {
    const res = await apiFetch('/api/admin/players');
    const pass = res.status === 200 && res.json?.success === true;
    logTest(
      'TC-09',
      'Authenticated Admin Players Access Allowed',
      pass,
      `Status ${res.status}, Players Count: ${res.json?.count || 0}`,
      `Total: ${res.json?.count}`
    );
  } catch (e) {
    logTest('TC-09', 'Authenticated Admin Players Access Allowed', false, e.message);
  }

  // Create a paid test tournament with admin session for testing paid flows
  let testPaidSlug = '';
  try {
    const createPaidRes = await apiFetch('/api/tournaments', {
      method: 'POST',
      body: {
        title: `QA Paid Tournament ${Date.now()}`,
        city: 'Nagpur',
        venue: 'VCA Stadium',
        isPaid: true,
        entryFee: 1,
      },
    });
    testPaidSlug = createPaidRes.json?.tournament?.slug || '';
  } catch (e) {}

  // TEST 10: Public Players List Privacy (Masked Phone Numbers)
  try {
    const res = await apiFetch(`/api/tournaments/${testPaidSlug || 'ympl-2026-season-2-jlhb'}/players`);
    const players = res.json?.players || [];
    let noUnmaskedPhone = true;
    players.forEach((p) => {
      if (p.phone && !p.phone.includes('*')) {
        noUnmaskedPhone = false;
      }
      if (p.maskedPhone && !p.maskedPhone.includes('*')) {
        noUnmaskedPhone = false;
      }
    });
    const pass = res.status === 200 && noUnmaskedPhone;
    logTest(
      'TC-10',
      'Public Players Privacy Masking',
      pass,
      `All phone numbers properly masked: ${noUnmaskedPhone}`,
      JSON.stringify(players[0] || {}).slice(0, 80)
    );
  } catch (e) {
    logTest('TC-10', 'Public Players Privacy Masking', false, e.message);
  }

  // TEST 11: Free Tournament Registration Validation - Missing Fields
  try {
    const res = await apiFetch('/api/register', {
      method: 'POST',
      body: { fullName: 'Incomplete Player' },
    });
    const pass = res.status === 400 && res.json?.success === false;
    logTest(
      'TC-11',
      'Registration Missing Fields Rejected',
      pass,
      `Status ${res.status}, Error: ${res.json?.error}`,
      res.text
    );
  } catch (e) {
    logTest('TC-11', 'Registration Missing Fields Rejected', false, e.message);
  }

  // TEST 12: Registration Validation - Invalid Phone Format
  try {
    const res = await apiFetch('/api/register', {
      method: 'POST',
      body: {
        fullName: 'Test Player',
        phone: '12345',
        age: '24',
        role: 'Pure Batsman',
        battingStyle: 'Right-hand',
        bowlingStyle: 'Right-arm Fast',
        tournamentSlug: testPaidSlug || 'ympl-2026-season-2-jlhb',
      },
    });
    const pass = res.status === 400 && res.json?.error?.includes('mobile number');
    logTest(
      'TC-12',
      'Registration Invalid Phone Rejected',
      pass,
      `Status ${res.status}, Error: ${res.json?.error}`,
      res.text
    );
  } catch (e) {
    logTest('TC-12', 'Registration Invalid Phone Rejected', false, e.message);
  }

  // TEST 13: Registration Validation - Invalid Age Range
  try {
    const res = await apiFetch('/api/register', {
      method: 'POST',
      body: {
        fullName: 'Test Player',
        phone: '9876543210',
        age: '150',
        role: 'Pure Batsman',
        battingStyle: 'Right-hand',
        bowlingStyle: 'Right-arm Fast',
        tournamentSlug: testPaidSlug || 'ympl-2026-season-2-jlhb',
      },
    });
    const pass = res.status === 400 && res.json?.error?.includes('age');
    logTest(
      'TC-13',
      'Registration Invalid Age Rejected',
      pass,
      `Status ${res.status}, Error: ${res.json?.error}`,
      res.text
    );
  } catch (e) {
    logTest('TC-13', 'Registration Invalid Age Rejected', false, e.message);
  }

  // TEST 14: Registration Validation - SVG Image Rejected (Stored XSS Protection)
  try {
    const res = await apiFetch('/api/register', {
      method: 'POST',
      body: {
        fullName: 'Hacker Player',
        phone: '9876543210',
        age: '24',
        role: 'Pure Batsman',
        battingStyle: 'Right-hand',
        bowlingStyle: 'Right-arm Fast',
        tournamentSlug: testPaidSlug || 'ympl-2026-season-2-jlhb',
        photoUrl: 'data:image/svg+xml;base64,PHN2ZyBvbmxvYWQ9YWxlcnQoMSk+',
      },
    });
    const pass = res.status === 400 && res.json?.error?.includes('SVG');
    logTest(
      'TC-14',
      'SVG Image Upload Rejection (XSS Defense)',
      pass,
      `Status ${res.status}, Error: ${res.json?.error}`,
      res.text
    );
  } catch (e) {
    logTest('TC-14', 'SVG Image Upload Rejection (XSS Defense)', false, e.message);
  }

  // TEST 15: Order Creation Amount Tampering Attempt (Server-Controlled Fee)
  try {
    const res = await apiFetch('/api/razorpay/create-order', {
      method: 'POST',
      body: {
        tournamentSlug: testPaidSlug || 'ympl-2026-season-2-jlhb',
        fullName: 'Fee Tamperer',
        phone: '9876543210',
        amount: 0.01, // Attempted client-side fee override
      },
    });
    // Server must enforce tournament.entryFee (1 INR = 100 paise)
    const pass = res.status === 200 && res.json?.amount === 100;
    logTest(
      'TC-15',
      'Order Creation Fee Tampering Defense',
      pass,
      `Amount charged: ${res.json?.amount} paise (Server Fee Enforced: ₹1.00)`,
      res.text
    );
  } catch (e) {
    logTest('TC-15', 'Order Creation Fee Tampering Defense', false, e.message);
  }

  // TEST 16: Fake Payment Verification Bypass Attempt (Must be Rejected)
  try {
    const res = await apiFetch('/api/register', {
      method: 'POST',
      body: {
        fullName: 'Fake Paid Player',
        phone: '9811122233',
        age: '25',
        role: 'Pure Batsman',
        battingStyle: 'Right-hand',
        bowlingStyle: 'Right-arm Fast',
        tournamentSlug: testPaidSlug || 'ympl-2026-season-2-jlhb',
        paymentId: 'pay_fake_unverified_hacker_id',
      },
    });
    const pass = res.status === 400 && res.json?.success === false;
    logTest(
      'TC-16',
      'Unverified Fake Payment ID Rejection',
      pass,
      `Status ${res.status}, Rejected with error: ${res.json?.error}`,
      res.text
    );
  } catch (e) {
    logTest('TC-16', 'Unverified Fake Payment ID Rejection', false, e.message);
  }

  // TEST 17: Webhook Signature Verification - Invalid Signature (Must be 403)
  try {
    const res = await apiFetch('/api/razorpay/webhook', {
      method: 'POST',
      headers: {
        'x-razorpay-signature': 'invalid_forged_signature_hex_123',
      },
      body: { event: 'payment.captured' },
    });
    const pass = res.status === 403 && res.json?.success === false;
    logTest(
      'TC-17',
      'Webhook Invalid Signature Rejection',
      pass,
      `Status ${res.status} (Expected 403 Forbidden)`,
      res.text
    );
  } catch (e) {
    logTest('TC-17', 'Webhook Invalid Signature Rejection', false, e.message);
  }

  // TEST 18: Public Host API Abuse Protection (Cannot create Paid Tournament as anonymous)
  try {
    const res = await apiFetch('/api/tournaments', {
      method: 'POST',
      noCookie: true,
      body: {
        title: 'Public Injected Paid Tournament',
        city: 'Mumbai',
        venue: 'Wankhede',
        isPaid: true,
        entryFee: 500,
      },
    });
    const createdTournament = res.json?.tournament;
    const pass =
      res.status === 200 &&
      createdTournament?.isPaid === false &&
      createdTournament?.entryFee === 0;
    logTest(
      'TC-18',
      'Public Host Abuse Defense (Paid Tournament Restriction)',
      pass,
      `Anonymous creation forced to Free mode: isPaid=${createdTournament?.isPaid}, fee=${createdTournament?.entryFee}`,
      res.text
    );
  } catch (e) {
    logTest('TC-18', 'Public Host Abuse Defense', false, e.message);
  }

  // TEST 19: Valid Free Tournament Creation & Registration Flow
  let testFreeSlug = '';
  try {
    const uniqueTitle = `QA Test League ${Date.now()}`;
    const createRes = await apiFetch('/api/tournaments', {
      method: 'POST',
      noCookie: true,
      body: {
        title: uniqueTitle,
        city: 'Pune',
        venue: 'MCA Stadium',
      },
    });
    testFreeSlug = createRes.json?.tournament?.slug;

    // Register a player for this free tournament
    const regRes = await apiFetch('/api/register', {
      method: 'POST',
      body: {
        fullName: 'Sachin Tendulkar',
        phone: '9822012345',
        age: '30',
        role: 'Pure Batsman',
        battingStyle: 'Right-hand',
        bowlingStyle: 'Right-arm Fast',
        tournamentSlug: testFreeSlug,
      },
    });

    const pass =
      regRes.status === 200 &&
      regRes.json?.success === true &&
      regRes.json?.registration?.paymentStatus === 'FREE' &&
      regRes.json?.registration?.registrationId?.startsWith('CRIC-');

    logTest(
      'TC-19',
      'Valid Free Registration Flow',
      pass,
      `Status ${regRes.status}, Ticket: ${regRes.json?.registration?.registrationId}, PaymentStatus: ${regRes.json?.registration?.paymentStatus}`,
      regRes.text
    );
  } catch (e) {
    logTest('TC-19', 'Valid Free Registration Flow', false, e.message);
  }

  // TEST 20: Duplicate Phone Registration Rejection for Same Tournament
  try {
    const dupRes = await apiFetch('/api/register', {
      method: 'POST',
      body: {
        fullName: 'Sachin Duplicate',
        phone: '9822012345', // Same phone number
        age: '30',
        role: 'Pure Batsman',
        battingStyle: 'Right-hand',
        bowlingStyle: 'Right-arm Fast',
        tournamentSlug: testFreeSlug,
      },
    });
    const pass = dupRes.status === 409 && dupRes.json?.error?.includes('already registered');
    logTest(
      'TC-20',
      'Duplicate Registration Defense (409 Conflict)',
      pass,
      `Status ${dupRes.status}, Error: ${dupRes.json?.error}`,
      dupRes.text
    );
  } catch (e) {
    logTest('TC-20', 'Duplicate Registration Defense', false, e.message);
  }

  // TEST 21: Authorized Admin Player Deletion
  try {
    // Delete the test registration created in TC-19
    const playersRes = await apiFetch('/api/admin/players');
    const createdPlayer = (playersRes.json?.players || []).find(
      (p) => p.tournamentSlug === testFreeSlug
    );

    if (createdPlayer) {
      const delRes = await apiFetch(
        `/api/admin/players?registrationId=${encodeURIComponent(createdPlayer.registrationId)}`,
        { method: 'DELETE' }
      );
      const pass = delRes.status === 200 && delRes.json?.success === true;
      logTest(
        'TC-21',
        'Authorized Admin Player Deletion',
        pass,
        `Status ${delRes.status}, Deleted: ${createdPlayer.registrationId}`,
        delRes.text
      );
    } else {
      logTest('TC-21', 'Authorized Admin Player Deletion', false, 'Test player not found');
    }
  } catch (e) {
    logTest('TC-21', 'Authorized Admin Player Deletion', false, e.message);
  }

  // TEST 23: Authorized Admin Tournament Mutation & Instant Fee Sync
  try {
    if (testPaidSlug) {
      const patchRes = await apiFetch(`/api/tournaments/${testPaidSlug}`, {
        method: 'PATCH',
        body: { entryFee: 150, title: 'Updated QA Paid Tournament' },
      });
      const patchPass =
        patchRes.status === 200 &&
        patchRes.json?.success === true &&
        patchRes.json?.tournament?.entryFee === 150;
      logTest(
        'TC-23',
        'Authorized Admin Tournament Mutation & Instant Fee Sync',
        patchPass,
        `Status ${patchRes.status}, Fee updated to: ₹${patchRes.json?.tournament?.entryFee}`,
        patchRes.text
      );
    }
  } catch (e) {
    logTest('TC-23', 'Authorized Admin Tournament Mutation & Instant Fee Sync', false, e.message);
  }

  // TEST 22: Clean Up Test Tournament
  try {
    if (testPaidSlug) {
      try {
        await apiFetch(`/api/tournaments/${testPaidSlug}`, { method: 'DELETE' });
      } catch (e) {}
    }
    if (testFreeSlug) {
      const delTournRes = await apiFetch(`/api/tournaments/${testFreeSlug}`, {
        method: 'DELETE',
      });
      const pass = delTournRes.status === 200 && delTournRes.json?.success === true;
      logTest(
        'TC-22',
        'Authorized Admin Tournament Cleanup',
        pass,
        `Status ${delTournRes.status}, Deleted test tournament ${testFreeSlug}`,
        delTournRes.text
      );
    }
  } catch (e) {
    logTest('TC-22', 'Authorized Admin Tournament Cleanup', false, e.message);
  }

  // SUMMARY
  const total = results.length;
  const passed = results.filter((r) => r.pass).length;
  const failed = total - passed;

  console.log('\n======================================================');
  console.log(`FINAL TEST SUMMARY: ${passed}/${total} PASSED (${failed} FAILED)`);
  console.log('======================================================\n');

  return { total, passed, failed, results };
}

runTests()
  .then((summary) => {
    if (summary.failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  })
  .catch((err) => {
    console.error('Fatal test error:', err);
    process.exit(1);
  });
