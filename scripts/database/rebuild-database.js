const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

async function rebuildDatabase() {
    const dbPath = path.join(__dirname, '../data/user-sessions.sqlite');
    
    // Remove old database if it exists
    try {
        if (fs.existsSync(dbPath)) {
            fs.unlinkSync(dbPath);
            console.log('🗑️  Removed old database');
        }
    } catch (error) {
        console.log('ℹ️  No old database to remove');
    }
    
    let db;
    
    try {
        // Create new database
        db = new Database(dbPath);
        console.log('✅ Created new database: user-sessions.sqlite');
        
        // Create users table with epoch time instead of datetime
        db.exec(`
            CREATE TABLE users (
                discord_id TEXT PRIMARY KEY,
                username TEXT NOT NULL,
                created_at INTEGER DEFAULT (strftime('%s', 'now')),
                expiry_time INTEGER
            )
        `);
        
        console.log('✅ Created users table with schema:');
        console.log('   - discord_id (TEXT PRIMARY KEY)');
        console.log('   - username (TEXT)');
        console.log('   - created_at (INTEGER - epoch time)');
        console.log('   - expiry_time (INTEGER - epoch time)');
        
        // Verify the schema
        const columns = db.prepare("PRAGMA table_info(users)").all();
        console.log('\n📊 Database Schema Verification:');
        columns.forEach(col => {
            console.log(`   - ${col.name} (${col.type}) ${col.pk ? 'PRIMARY KEY' : ''}`);
        });
        
        console.log('\n🎯 Database ready for authentication system!');
        console.log('   - Stores Discord ID as primary key');
        console.log('   - Stores username');
        console.log('   - Tracks creation time (epoch timestamp)');
        console.log('   - Tracks expiry time (epoch timestamp, 7 days from creation)');
        
    } catch (error) {
        console.error('❌ Error creating database:', error.message);
    } finally {
        if (db) db.close();
    }
}

rebuildDatabase();
