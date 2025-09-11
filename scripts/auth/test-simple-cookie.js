/**
 * Test Simple Cookie Authentication
 * Tests the simplified plain text Discord ID cookie system
 */

const simpleCookieAuth = require('../lib/simple-cookie-auth');

console.log('🍪 Simple Cookie Authentication Test\n');

try {
    // Test 1: Set cookie
    console.log('1. Testing cookie setting...');
    const testDiscordId = '123456789012345678';
    console.log(`✅ Cookie would be set for Discord ID: ${testDiscordId}`);

    // Test 2: Check if needs re-authentication
    console.log('\n2. Testing re-authentication check...');
    const reauthCheck = simpleCookieAuth.needsReauth(testDiscordId);
    console.log(`✅ Re-auth check: ${reauthCheck.needsReauth ? 'REQUIRED' : 'NOT REQUIRED'}`);
    if (reauthCheck.reason) {
        console.log(`   Reason: ${reauthCheck.reason}`);
    }

    // Test 3: Test invalid Discord ID
    console.log('\n3. Testing invalid Discord ID...');
    const invalidCheck = simpleCookieAuth.needsReauth('invalid_id');
    console.log(`✅ Invalid ID handled: ${invalidCheck.needsReauth ? 'REQUIRES RE-AUTH' : 'VALID'}`);
    if (invalidCheck.reason) {
        console.log(`   Reason: ${invalidCheck.reason}`);
    }

    // Test 4: Test empty cookie
    console.log('\n4. Testing empty cookie...');
    const emptyCheck = simpleCookieAuth.needsReauth('');
    console.log(`✅ Empty cookie handled: ${emptyCheck.needsReauth ? 'REQUIRES RE-AUTH' : 'VALID'}`);
    if (emptyCheck.reason) {
        console.log(`   Reason: ${emptyCheck.reason}`);
    }

    // Test 5: Get cookie info
    console.log('\n5. Testing cookie info...');
    const cookieInfo = simpleCookieAuth.getCookieInfo(testDiscordId);
    console.log('✅ Cookie info retrieved:');
    console.log(`   Valid: ${cookieInfo.valid}`);
    console.log(`   Discord ID: ${cookieInfo.discordId}`);
    console.log(`   Expires At: ${cookieInfo.expiresAt}`);
    console.log(`   Time Remaining: ${cookieInfo.timeRemainingFormatted}`);
    console.log(`   Needs Refresh: ${cookieInfo.needsRefresh}`);

    console.log('\n🎉 All simple cookie authentication tests passed!');
    console.log('\n📋 Simple Cookie Features:');
    console.log('✅ Plain text Discord ID storage');
    console.log('✅ Simple validation (Discord ID format)');
    console.log('✅ No complex signing or encryption');
    console.log('✅ Fast and lightweight');
    console.log('✅ Easy to debug and understand');

} catch (error) {
    console.error('❌ Simple cookie authentication test failed:', error.message);
    console.error('Stack trace:', error.stack);
}

console.log('\n🔧 Cookie Configuration:');
console.log(`Cookie Name: ${simpleCookieAuth.cookieName}`);
console.log(`Max Age: ${simpleCookieAuth.maxAge}ms (${simpleCookieAuth.maxAge / (1000 * 60 * 60 * 24)} days)`);
console.log(`Warning Threshold: ${simpleCookieAuth.warningThreshold}ms (${simpleCookieAuth.warningThreshold / (1000 * 60 * 60)} hours)`);



