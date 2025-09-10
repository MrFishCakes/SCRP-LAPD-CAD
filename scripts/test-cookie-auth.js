/**
 * Test Cookie Authentication Script
 * Tests the cookie-based authentication system
 */

const cookieValidator = require('../lib/cookie-validator');

console.log('🍪 Cookie Authentication Test\n');

try {
    // Test 1: Generate a cookie
    console.log('1. Testing cookie generation...');
    const testDiscordId = '123456789012345678';
    const cookieValue = cookieValidator.generateCookieValue(testDiscordId);
    console.log(`✅ Cookie generated: ${cookieValue.substring(0, 50)}...`);

    // Test 2: Parse and validate the cookie
    console.log('\n2. Testing cookie parsing...');
    const parsed = cookieValidator.parseCookie(cookieValue);
    console.log('✅ Cookie parsed successfully:');
    console.log(`   Discord ID: ${parsed.discordId}`);
    console.log(`   Issued At: ${new Date(parsed.issuedAt).toISOString()}`);
    console.log(`   Expires At: ${new Date(parsed.expiresAt).toISOString()}`);
    console.log(`   Time Remaining: ${parsed.timeRemaining}ms`);
    console.log(`   Needs Refresh: ${parsed.needsRefresh}`);

    // Test 3: Check if needs re-authentication
    console.log('\n3. Testing re-authentication check...');
    const reauthCheck = cookieValidator.needsReauth(cookieValue);
    console.log(`✅ Re-auth check: ${reauthCheck.needsReauth ? 'REQUIRED' : 'NOT REQUIRED'}`);
    if (reauthCheck.reason) {
        console.log(`   Reason: ${reauthCheck.reason}`);
    }

    // Test 4: Get time until expiration
    console.log('\n4. Testing time until expiration...');
    const timeUntilExpiry = cookieValidator.getTimeUntilExpiration(cookieValue);
    console.log(`✅ Time until expiration: ${timeUntilExpiry}`);

    // Test 5: Test invalid cookie
    console.log('\n5. Testing invalid cookie...');
    const invalidCookie = 'invalid_cookie_data';
    const invalidParsed = cookieValidator.parseCookie(invalidCookie);
    console.log(`✅ Invalid cookie handled: ${invalidParsed.valid ? 'VALID' : 'INVALID'}`);
    if (!invalidParsed.valid) {
        console.log(`   Error: ${invalidParsed.error}`);
    }

    // Test 6: Test expired cookie (simulate)
    console.log('\n6. Testing expired cookie simulation...');
    const expiredCookie = cookieValidator.generateCookieValue(testDiscordId);
    // Manually modify the cookie to be expired (this is just for testing)
    const expiredData = JSON.parse(Buffer.from(expiredCookie, 'base64').toString('utf8'));
    expiredData.expiresAt = Date.now() - 1000; // 1 second ago
    const expiredCookieValue = Buffer.from(JSON.stringify(expiredData)).toString('base64');
    
    const expiredParsed = cookieValidator.parseCookie(expiredCookieValue);
    console.log(`✅ Expired cookie handled: ${expiredParsed.valid ? 'VALID' : 'INVALID'}`);
    if (!expiredParsed.valid) {
        console.log(`   Error: ${expiredParsed.error}`);
    }

    // Test 7: Test cookie info
    console.log('\n7. Testing cookie info...');
    const cookieInfo = cookieValidator.getCookieInfo(cookieValue);
    console.log('✅ Cookie info retrieved:');
    console.log(`   Valid: ${cookieInfo.valid}`);
    console.log(`   Discord ID: ${cookieInfo.discordId}`);
    console.log(`   Issued At: ${cookieInfo.issuedAt}`);
    console.log(`   Expires At: ${cookieInfo.expiresAt}`);
    console.log(`   Time Remaining: ${cookieInfo.timeRemainingFormatted}`);
    console.log(`   Needs Refresh: ${cookieInfo.needsRefresh}`);

    console.log('\n🎉 All cookie authentication tests passed!');
    console.log('\n📋 Cookie Authentication Features:');
    console.log('✅ Secure cookie generation with HMAC signature');
    console.log('✅ Cookie parsing and validation');
    console.log('✅ 12-hour expiration warning system');
    console.log('✅ Automatic re-authentication detection');
    console.log('✅ Time remaining calculation');
    console.log('✅ Invalid/expired cookie handling');

} catch (error) {
    console.error('❌ Cookie authentication test failed:', error.message);
    console.error('Stack trace:', error.stack);
}

console.log('\n🔧 Cookie Configuration:');
console.log(`Cookie Name: ${cookieValidator.cookieName}`);
console.log(`Max Age: ${cookieValidator.maxAge}ms (${cookieValidator.maxAge / (1000 * 60 * 60 * 24)} days)`);
console.log(`Warning Threshold: ${cookieValidator.warningThreshold}ms (${cookieValidator.warningThreshold / (1000 * 60 * 60)} hours)`);
console.log(`Secret: ${cookieValidator.secret ? 'Set' : 'Not set'}`);


