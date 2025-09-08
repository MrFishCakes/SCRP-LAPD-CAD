/**
 * Discord OAuth Configuration Diagnostic Tool
 * Helps identify and fix Discord OAuth setup issues
 */

require('dotenv').config();

console.log('🔍 Discord OAuth Configuration Diagnostic\n');

// Check environment variables
const requiredVars = [
    'DISCORD_CLIENT_ID',
    'DISCORD_CLIENT_SECRET',
    'DISCORD_REDIRECT_URI'
];

const optionalVars = [
    'DISCORD_GUILD_ID',
    'DISCORD_REQUIRED_ROLE_ID',
    'DISCORD_BOT_TOKEN'
];

console.log('📋 Environment Variables Check:');
console.log('================================');

let hasErrors = false;

// Check required variables
requiredVars.forEach(varName => {
    const value = process.env[varName];
    if (!value || value.includes('your_')) {
        console.log(`❌ ${varName}: Missing or not configured`);
        hasErrors = true;
    } else {
        console.log(`✅ ${varName}: Configured`);
    }
});

console.log('\n📋 Optional Variables Check:');
console.log('=============================');

optionalVars.forEach(varName => {
    const value = process.env[varName];
    if (!value || value.includes('your_')) {
        console.log(`⚠️  ${varName}: Not configured (optional)`);
    } else {
        console.log(`✅ ${varName}: Configured`);
    }
});

// Validate Discord Client ID format
const clientId = process.env.DISCORD_CLIENT_ID;
if (clientId && !clientId.includes('your_')) {
    console.log('\n🔍 Discord Client ID Validation:');
    console.log('================================');
    
    if (/^\d{17,19}$/.test(clientId)) {
        console.log('✅ Client ID format is valid (17-19 digits)');
    } else {
        console.log('❌ Client ID format is invalid (should be 17-19 digits)');
        hasErrors = true;
    }
}

// Check redirect URI
const redirectUri = process.env.DISCORD_REDIRECT_URI;
if (redirectUri && !redirectUri.includes('your_')) {
    console.log('\n🔍 Redirect URI Validation:');
    console.log('============================');
    
    if (redirectUri.startsWith('http://localhost:') || redirectUri.startsWith('https://')) {
        console.log('✅ Redirect URI format is valid');
    } else {
        console.log('❌ Redirect URI should start with http://localhost: or https://');
        hasErrors = true;
    }
    
    if (redirectUri.endsWith('/auth/discord/callback')) {
        console.log('✅ Redirect URI ends with correct callback path');
    } else {
        console.log('❌ Redirect URI should end with /auth/discord/callback');
        hasErrors = true;
    }
}

// Test Discord API connectivity
async function testDiscordAPI() {
    console.log('\n🌐 Discord API Connectivity Test:');
    console.log('==================================');
    
    try {
        const response = await fetch('https://discord.com/api/v10/applications/@me', {
            headers: {
                'Authorization': `Bot ${process.env.DISCORD_BOT_TOKEN || 'invalid-token'}`
            }
        });
        
        if (response.ok) {
            console.log('✅ Discord API is accessible');
        } else {
            console.log(`⚠️  Discord API returned status: ${response.status}`);
        }
    } catch (error) {
        console.log('❌ Discord API connectivity test failed:', error.message);
    }
}

// Generate setup instructions
function generateSetupInstructions() {
    console.log('\n📖 Discord OAuth Setup Instructions:');
    console.log('=====================================');
    
    console.log('\n1. Go to Discord Developer Portal:');
    console.log('   https://discord.com/developers/applications');
    
    console.log('\n2. Create a new application or select existing one');
    
    console.log('\n3. Go to OAuth2 section and configure:');
    console.log('   - Client ID: Copy to DISCORD_CLIENT_ID');
    console.log('   - Client Secret: Copy to DISCORD_CLIENT_SECRET');
    console.log('   - Redirect URI: Add http://localhost:3000/auth/discord/callback');
    
    console.log('\n4. Go to OAuth2 > Scopes and ensure these are selected:');
    console.log('   ✅ identify');
    console.log('   ✅ guilds');
    
    console.log('\5. (Optional) For role verification:');
    console.log('   - Create a bot in the Bot section');
    console.log('   - Copy bot token to DISCORD_BOT_TOKEN');
    console.log('   - Invite bot to your server with appropriate permissions');
    
    console.log('\n6. Get your Discord server ID:');
    console.log('   - Enable Developer Mode in Discord');
    console.log('   - Right-click your server → Copy Server ID');
    console.log('   - Set as DISCORD_GUILD_ID');
    
    console.log('\n7. (Optional) Get role ID for access control:');
    console.log('   - Right-click the required role → Copy Role ID');
    console.log('   - Set as DISCORD_REQUIRED_ROLE_ID');
}

// Main execution
async function main() {
    if (hasErrors) {
        console.log('\n❌ Configuration issues found!');
        generateSetupInstructions();
    } else {
        console.log('\n✅ All required configuration looks good!');
        await testDiscordAPI();
    }
    
    console.log('\n🔧 Quick Fix Commands:');
    console.log('======================');
    console.log('1. Run setup script: npm run setup');
    console.log('2. Check your .env file configuration');
    console.log('3. Verify Discord application settings');
    console.log('4. Test the application: npm start');
}

main().catch(console.error);
