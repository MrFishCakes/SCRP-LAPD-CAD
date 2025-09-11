const Database = require('better-sqlite3');
const path = require('path');

async function fixDatabaseSchema() {
    const dbPath = path.join(__dirname, '../data/database.sqlite');
    let db;
    
    try {
        db = new Database(dbPath);
        
        console.log('🔍 Current database schema:');
        const schema = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'").get();
        console.log(schema ? schema.sql : 'No users table found');
        
        // Check if expiry_time column exists
        const columns = db.prepare("PRAGMA table_info(users)").all();
        console.log('\n📊 Current columns:');
        columns.forEach(col => console.log(`  - ${col.name} (${col.type})`));
        
        const hasExpiryTime = columns.some(col => col.name === 'expiry_time');
        const hasExpiresAt = columns.some(col => col.name === 'expires_at');
        
        if (hasExpiresAt && !hasExpiryTime) {
            console.log('\n🔧 Fixing schema: Renaming expires_at to expiry_time...');
            
            // Drop any tables that might have foreign key references
            try {
                db.exec('DROP TABLE IF EXISTS api_logs');
                db.exec('DROP TABLE IF EXISTS sessions');
                db.exec('DROP TABLE IF EXISTS refresh_tokens');
                console.log('✅ Removed old tables with foreign key references');
            } catch (e) {
                console.log('ℹ️  No old tables to remove');
            }
            
            // Create new table with correct schema
            db.exec(`
                CREATE TABLE users_new (
                    discord_id TEXT PRIMARY KEY,
                    username TEXT NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    expiry_time DATETIME
                )
            `);
            
            // Copy data from old table
            db.exec(`
                INSERT INTO users_new (discord_id, username, created_at, expiry_time)
                SELECT discord_id, username, created_at, expires_at FROM users
            `);
            
            // Drop old table and rename new one
            db.exec('DROP TABLE users');
            db.exec('ALTER TABLE users_new RENAME TO users');
            
            console.log('✅ Schema fixed successfully!');
        } else if (hasExpiryTime) {
            console.log('✅ Schema is already correct!');
        } else {
            console.log('❌ Unexpected schema state');
        }
        
        // Show final schema
        console.log('\n📊 Final schema:');
        const finalColumns = db.prepare("PRAGMA table_info(users)").all();
        finalColumns.forEach(col => console.log(`  - ${col.name} (${col.type})`));
        
    } catch (error) {
        console.error('❌ Error fixing database schema:', error.message);
    } finally {
        if (db) db.close();
    }
}

fixDatabaseSchema();
