/**
 * Quick fix for Discord rate limiting
 * Temporarily disables guild verification to allow authentication
 */

const fs = require('fs');
const path = require('path');

console.log('🔧 Discord Rate Limit Bypass\n');

const envPath = path.join(__dirname, '..', '.env');

if (!fs.existsSync(envPath)) {
    console.log('❌ .env file not found');
    process.exit(1);
}

// Read current .env content
let envContent = fs.readFileSync(envPath, 'utf8');

// Comment out guild verification
const guildIdLine = envContent.match(/^DISCORD_GUILD_ID=.*$/m);
const roleIdLine = envContent.match(/^DISCORD_REQUIRED_ROLE_ID=.*$/m);

if (guildIdLine && !guildIdLine[0].startsWith('#')) {
    envContent = envContent.replace(/^DISCORD_GUILD_ID=.*$/m, '# DISCORD_GUILD_ID=your_discord_server_id_here');
    console.log('✅ Commented out DISCORD_GUILD_ID');
}

if (roleIdLine && !roleIdLine[0].startsWith('#')) {
    envContent = envContent.replace(/^DISCORD_REQUIRED_ROLE_ID=.*$/m, '# DISCORD_REQUIRED_ROLE_ID=your_required_role_id_here');
    console.log('✅ Commented out DISCORD_REQUIRED_ROLE_ID');
}

// Write back to .env
fs.writeFileSync(envPath, envContent);

console.log('\n🎯 Rate limit bypass applied!');
console.log('Now any Discord user can authenticate without server verification.');
console.log('\nTo re-enable server verification later:');
console.log('1. Uncomment the DISCORD_GUILD_ID line in your .env file');
console.log('2. Uncomment the DISCORD_REQUIRED_ROLE_ID line in your .env file');
console.log('3. Set the correct values');
console.log('4. Restart the application');
console.log('\n🚀 You can now test the authentication without rate limiting issues!');

