/**
 * View Users Script
 * Shows user data stored in SQLite database
 */

const Database = require('better-sqlite3');
const path = require('path');

console.log('👥 User Data in Database\n');

try {
    const dbPath = path.join(__dirname, '..', 'data', 'user-sessions.sqlite');
    const db = new Database(dbPath);

    // Get all users
    const users = db.prepare('SELECT * FROM users ORDER BY created_at DESC').all();

    if (users.length === 0) {
        console.log('❌ No users found in database.');
    } else {
        console.log(`📊 Found ${users.length} user(s) in database:\n`);

        users.forEach((user, index) => {
            console.log(`${index + 1}. Discord ID: ${user.discord_id}`);
            console.log(`   Username: ${user.username || 'N/A'}`);
            console.log(`   Created: ${new Date(user.created_at * 1000).toISOString()} (${user.created_at})`);
            console.log(`   Expires: ${new Date(user.expiry_time * 1000).toISOString()} (${user.expiry_time})`);
            
            // Check if expired (epoch time comparison)
            const now = Math.floor(Date.now() / 1000); // current epoch time in seconds
            const isExpired = user.expiry_time <= now;
            const timeRemaining = (user.expiry_time - now) * 1000; // convert to milliseconds
            
            if (isExpired) {
                console.log(`   Status: ❌ EXPIRED`);
            } else {
                const hours = Math.floor(timeRemaining / (1000 * 60 * 60));
                const minutes = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));
                console.log(`   Status: ✅ ACTIVE (${hours}h ${minutes}m remaining)`);
            }
            console.log('');
        });
    }

    // Get database statistics (using epoch time)
    const currentEpoch = Math.floor(Date.now() / 1000);
    const stats = db.prepare(`
        SELECT 
            COUNT(*) as total_users,
            COUNT(CASE WHEN expiry_time > ? THEN 1 END) as active_users,
            COUNT(CASE WHEN expiry_time <= ? THEN 1 END) as expired_users
        FROM users
    `).get(currentEpoch, currentEpoch);

    console.log('📈 Database Statistics:');
    console.log('======================');
    console.log(`Total Users: ${stats.total_users}`);
    console.log(`Active Users: ${stats.active_users}`);
    console.log(`Expired Users: ${stats.expired_users}`);

    db.close();

} catch (error) {
    console.error('❌ Error accessing user database:', error.message);
    console.log('\nPossible issues:');
    console.log('- Database file not created yet');
    console.log('- Permission issues');
    console.log('- Database corruption');
}

console.log('\n🔧 Database Schema:');
    console.log('discord_id (TEXT PRIMARY KEY)');
    console.log('username (TEXT)');
    console.log('created_at (INTEGER - epoch time)');
    console.log('expiry_time (INTEGER - epoch time)');
