import { createLicenseAfterPayment, activateLicense } from '../lib/license';
import { prisma } from '../lib/prisma';
import { hashToken } from '../lib/hash';

async function runTest() {
  console.log('==================================================');
  console.log('STARTING INTEGRATION TEST FOR LICENSE SYSTEM');
  console.log('==================================================\n');

  const testEmail = `buyer-${Date.now()}@example.com`;
  const testOrderId = `ORDER-${Math.floor(Math.random() * 1000000)}`;

  try {
    // 1. Test License Creation
    console.log('[Test 1] Creating license after simulated payment...');
    console.log(`Email: ${testEmail}`);
    console.log(`Order ID: ${testOrderId}`);
    
    const rawToken = await createLicenseAfterPayment({
      email: testEmail,
      orderId: testOrderId,
    });
    
    console.log(`\n>>> SUCCESS: License created!`);
    console.log(`>>> Raw Token returned: ${rawToken}`);
    console.log(`>>> Token length is correct: ${rawToken.length === 16}`);
    console.log(`>>> Token is uppercase/number only: ${/^[A-Z0-9]+$/.test(rawToken)}\n`);

    // 2. Test Secure Storage
    console.log('[Test 2] Verifying secure storage in database (token original must NOT be saved)...');
    const dbRecord = await prisma.license.findUnique({
      where: { orderId: testOrderId },
    });

    if (!dbRecord) {
      throw new Error('License record not found in database!');
    }

    console.log(`>>> License ID: ${dbRecord.id}`);
    console.log(`>>> Email in DB: ${dbRecord.email}`);
    console.log(`>>> Status in DB: ${dbRecord.status} (Expected: UNUSED)`);
    console.log(`>>> Token Hash in DB: ${dbRecord.tokenHash}`);
    
    const computedHash = hashToken(rawToken);
    const hashesMatch = dbRecord.tokenHash === computedHash;
    console.log(`>>> SHA-256 Hashes match: ${hashesMatch}`);
    
    if (!hashesMatch) {
      throw new Error('Hash in database does not match computed hash!');
    }
    console.log('>>> SUCCESS: Token hashed and stored securely!\n');

    // 3. Test Atomic One-Time Activation (First attempt)
    console.log('[Test 3] Attempting first token activation (should succeed)...');
    const firstActivation = await activateLicense(rawToken);
    console.log(`>>> Activation Response:`, firstActivation);

    if (!firstActivation.success || firstActivation.message !== 'License activated') {
      throw new Error(`First activation failed unexpectedly: ${firstActivation.message}`);
    }

    // Verify DB status is now USED
    const dbRecordAfter = await prisma.license.findUnique({
      where: { orderId: testOrderId },
    });
    console.log(`>>> Status in DB after activation: ${dbRecordAfter?.status} (Expected: USED)`);
    console.log(`>>> UsedAt timestamp in DB: ${dbRecordAfter?.usedAt}`);
    
    if (dbRecordAfter?.status !== 'USED' || !dbRecordAfter.usedAt) {
      throw new Error('Database status was not updated to USED correctly!');
    }
    console.log('>>> SUCCESS: Token activated successfully on first use!\n');

    // 4. Test Atomic One-Time Activation (Second attempt)
    console.log('[Test 4] Attempting second token activation (should be rejected)...');
    const secondActivation = await activateLicense(rawToken);
    console.log(`>>> Activation Response:`, secondActivation);

    if (secondActivation.success) {
      throw new Error('CRITICAL FAILURE: Token was allowed to be activated a second time!');
    }

    console.log(`>>> Message returned: "${secondActivation.message}"`);
    console.log('>>> SUCCESS: Duplicate activation correctly rejected!\n');

    console.log('==================================================');
    console.log('ALL INTEGRATION TESTS PASSED SUCCESSFULLY! 🎉');
    console.log('==================================================');
  } catch (error: any) {
    console.error('\n❌ TEST FAILED:', error.message || error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runTest();
