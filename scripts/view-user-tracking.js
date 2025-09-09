/**
 * View User Tracking Script
 * Shows user tracking and validation data from SQLite database
 */

const userTracker = require('../lib/user-tracker');

console.log('👥 User Tracking Data\n');

try {
    // Get validation statistics
    const stats = userTracker.getValidationStats();
    console.log('📊 Validation Statistics:');
    console.log('=========================');
    console.log(`Total Sessions: ${stats.totalSessions}`);
    console.log(`Active Sessions: ${stats.activeSessions}`);
    console.log(`Validated Sessions: ${stats.validatedSessions}`);
    console.log(`Unique Users: ${stats.uniqueUsers}`);
    console.log(`Unique Browsers: ${stats.uniqueBrowsers}`);
    console.log(`Validation Rate: ${stats.validationRate}%`);

    // Get recent activity
    console.log('\n🔄 Recent Activity:');
    console.log('===================');
    const recentActivity = userTracker.getRecentActivity(10);
    
    if (recentActivity.length === 0) {
        console.log('❌ No recent activity found');
    } else {
        recentActivity.forEach((activity, index) => {
            console.log(`\n${index + 1}. User: ${activity.user_id}`);
            console.log(`   Action: ${activity.action}`);
            console.log(`   Endpoint: ${activity.endpoint || 'N/A'}`);
            console.log(`   Success: ${activity.success ? '✅' : '❌'}`);
            console.log(`   Time: ${activity.timestamp}`);
            console.log(`   IP: ${activity.ip_address}`);
        });
    }

    // Get active sessions
    console.log('\n🔐 Active Sessions:');
    console.log('===================');
    const activeSessions = userTracker.db.prepare(`
        SELECT 
            us.*,
            bf.is_trusted,
            bf.first_seen as fingerprint_first_seen
        FROM user_sessions us
        LEFT JOIN browser_fingerprints bf ON us.browser_fingerprint = bf.fingerprint
        WHERE us.expires_at > CURRENT_TIMESTAMP
        ORDER BY us.last_activity DESC
    `).all();

    if (activeSessions.length === 0) {
        console.log('❌ No active sessions found');
    } else {
        activeSessions.forEach((session, index) => {
            console.log(`\n${index + 1}. User: ${session.user_id}`);
            console.log(`   Session ID: ${session.session_id}`);
            console.log(`   Validated: ${session.is_validated ? '✅' : '❌'}`);
            console.log(`   Method: ${session.validation_method}`);
            console.log(`   Trusted: ${session.is_trusted ? '✅' : '❌'}`);
            console.log(`   Last Activity: ${session.last_activity}`);
            console.log(`   Expires: ${session.expires_at}`);
            console.log(`   IP: ${session.ip_address}`);
        });
    }

    // Get browser fingerprints
    console.log('\n🔍 Browser Fingerprints:');
    console.log('=========================');
    const fingerprints = userTracker.db.prepare(`
        SELECT * FROM browser_fingerprints 
        ORDER BY last_seen DESC
    `).all();

    if (fingerprints.length === 0) {
        console.log('❌ No browser fingerprints found');
    } else {
        fingerprints.forEach((fingerprint, index) => {
            console.log(`\n${index + 1}. Fingerprint: ${fingerprint.fingerprint.substring(0, 16)}...`);
            console.log(`   User ID: ${fingerprint.user_id || 'Unknown'}`);
            console.log(`   Trusted: ${fingerprint.is_trusted ? '✅' : '❌'}`);
            console.log(`   First Seen: ${fingerprint.first_seen}`);
            console.log(`   Last Seen: ${fingerprint.last_seen}`);
            console.log(`   Device: ${fingerprint.device_info ? fingerprint.device_info.substring(0, 50) + '...' : 'Unknown'}`);
        });
    }

    // Clean up expired sessions
    console.log('\n🧹 Cleaning up expired sessions...');
    const cleaned = userTracker.cleanupExpiredSessions();
    if (cleaned > 0) {
        console.log(`✅ Cleaned up ${cleaned} expired sessions`);
    } else {
        console.log('✅ No expired sessions to clean up');
    }

} catch (error) {
    console.error('❌ Error accessing user tracking data:', error.message);
    console.log('\nPossible issues:');
    console.log('- Database file not created yet');
    console.log('- Permission issues');
    console.log('- Database corruption');
} finally {
    // Close database connection
    userTracker.close();
}

console.log('\n🔧 Available API Endpoints:');
console.log('GET /tracking/my-status - Your validation status');
console.log('GET /tracking/my-sessions - Your session history');
console.log('GET /tracking/my-fingerprint - Your browser fingerprint');
console.log('GET /tracking/dashboard - Complete dashboard data');
console.log('GET /tracking/stats - System statistics');
console.log('GET /tracking/activity - Recent activity');
console.log('POST /tracking/trust-browser - Trust current browser');

