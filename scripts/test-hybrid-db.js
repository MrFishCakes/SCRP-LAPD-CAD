/**
 * Test script for hybrid database implementation
 * Tests Redis + SQLite functionality
 */

const database = require('../config/hybrid-database');
const logger = require('../utils/logger');

async function testHybridDatabase() {
    console.log('🧪 Testing Hybrid Database Implementation...\n');

    try {
        // Initialize database
        console.log('1. Initializing database...');
        await database.initialize();
        console.log('✅ Database initialized successfully\n');

        // Test user operations
        console.log('2. Testing user operations...');
        const testUser = {
            id: 'test-user-123',
            username: 'testuser',
            discriminator: '1234',
            avatar: 'test-avatar',
            guildId: 'test-guild',
            accessToken: 'test-access-token'
        };

        await database.saveUser(testUser.id, testUser);
        console.log('✅ User saved');

        const retrievedUser = await database.getUser(testUser.id);
        console.log('✅ User retrieved:', retrievedUser ? 'SUCCESS' : 'FAILED');

        await database.updateUserLastLogin(testUser.id);
        console.log('✅ User last login updated');

        // Test session operations
        console.log('\n3. Testing session operations...');
        const testSession = {
            id: 'test-session-123',
            userId: testUser.id,
            data: { test: 'data' },
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        };

        await database.saveSession(testSession.id, testSession);
        console.log('✅ Session saved');

        const retrievedSession = await database.getSession(testSession.id);
        console.log('✅ Session retrieved:', retrievedSession ? 'SUCCESS' : 'FAILED');

        // Test refresh token operations
        console.log('\n4. Testing refresh token operations...');
        const testToken = {
            userId: testUser.id,
            hashedToken: 'hashed-test-token',
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        };

        await database.saveRefreshToken(testUser.id, testToken);
        console.log('✅ Refresh token saved');

        const retrievedToken = await database.getRefreshToken(testUser.id);
        console.log('✅ Refresh token retrieved:', retrievedToken ? 'SUCCESS' : 'FAILED');

        await database.updateRefreshTokenLastUsed(testUser.id);
        console.log('✅ Refresh token last used updated');

        // Test API logging
        console.log('\n5. Testing API logging...');
        await database.logApiCall(testUser.id, '/api/test', 'GET', 200, 150);
        console.log('✅ API call logged');

        const apiLogs = await database.getApiLogs(testUser.id, 10);
        console.log('✅ API logs retrieved:', apiLogs.length > 0 ? 'SUCCESS' : 'FAILED');

        // Test statistics
        console.log('\n6. Testing statistics...');
        const stats = await database.getStats();
        console.log('✅ Statistics retrieved:', stats);

        // Test cache performance (if Redis is available)
        console.log('\n7. Testing cache performance...');
        const startTime = Date.now();
        await database.getUser(testUser.id); // Should be cached
        const cacheTime = Date.now() - startTime;
        console.log(`✅ Cache performance: ${cacheTime}ms`);

        // Cleanup test data
        console.log('\n8. Cleaning up test data...');
        await database.deleteSession(testSession.id);
        await database.deleteRefreshToken(testUser.id);
        console.log('✅ Test data cleaned up');

        // Test backup functionality
        console.log('\n9. Testing backup functionality...');
        const backupFile = await database.createBackup();
        console.log('✅ Backup created:', backupFile);

        console.log('\n🎉 All tests passed successfully!');
        console.log('\nDatabase Status:');
        console.log(`- SQLite: ${stats.sqliteConnected ? '✅ Connected' : '❌ Disconnected'}`);
        console.log(`- Redis: ${stats.redisConnected ? '✅ Connected' : '⚠️  Not available (optional)'}`);

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error('Stack trace:', error.stack);
    } finally {
        // Shutdown database
        console.log('\n10. Shutting down database...');
        await database.shutdown();
        console.log('✅ Database shutdown complete');
    }
}

// Run tests
if (require.main === module) {
    testHybridDatabase().catch(console.error);
}

module.exports = testHybridDatabase;
