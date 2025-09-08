/**
 * Setup script for SonoranCAD Web Application
 * Helps with initial configuration and validation
 */

const fs = require('fs');
const path = require('path');
const { generateSessionSecret } = require('../utils/helpers');

console.log('🚀 SonoranCAD Web Application Setup\n');

// Check if .env file exists
const envPath = path.join(__dirname, '..', '.env');
const envExamplePath = path.join(__dirname, '..', 'env.example');

if (!fs.existsSync(envPath)) {
    console.log('📝 Creating .env file from template...');
    
    if (fs.existsSync(envExamplePath)) {
        fs.copyFileSync(envExamplePath, envPath);
        console.log('✅ .env file created successfully');
    } else {
        console.log('❌ env.example file not found');
        process.exit(1);
    }
} else {
    console.log('✅ .env file already exists');
}

// Generate session secret if not set
require('dotenv').config();
if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET === 'your_session_secret_key') {
    console.log('🔐 Generating secure session secret...');
    const sessionSecret = generateSessionSecret();
    
    // Read current .env content
    let envContent = fs.readFileSync(envPath, 'utf8');
    
    // Replace session secret
    envContent = envContent.replace(
        /SESSION_SECRET=.*/,
        `SESSION_SECRET=${sessionSecret}`
    );
    
    // Write back to .env
    fs.writeFileSync(envPath, envContent);
    console.log('✅ Session secret generated and saved');
}

// Create logs directory
const logsDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logsDir)) {
    console.log('📁 Creating logs directory...');
    fs.mkdirSync(logsDir, { recursive: true });
    console.log('✅ Logs directory created');
} else {
    console.log('✅ Logs directory already exists');
}

// Validate required environment variables
console.log('\n🔍 Validating environment variables...');

const requiredVars = [
    'DISCORD_CLIENT_ID',
    'DISCORD_CLIENT_SECRET',
    'SONORAN_API_ID',
    'SONORAN_API_KEY',
    'SONORAN_COMMUNITY_ID'
];

const missingVars = [];
const recommendedVars = [
    'DISCORD_GUILD_ID',
    'DISCORD_REQUIRED_ROLE_ID',
    'SESSION_SECRET'
];

requiredVars.forEach(varName => {
    if (!process.env[varName] || process.env[varName].includes('your_')) {
        missingVars.push(varName);
    }
});

if (missingVars.length > 0) {
    console.log('❌ Missing required environment variables:');
    missingVars.forEach(varName => {
        console.log(`   - ${varName}`);
    });
    console.log('\nPlease update your .env file with the correct values.');
} else {
    console.log('✅ All required environment variables are set');
}

// Check recommended variables
const missingRecommended = recommendedVars.filter(varName => 
    !process.env[varName] || process.env[varName].includes('your_')
);

if (missingRecommended.length > 0) {
    console.log('\n⚠️  Missing recommended environment variables:');
    missingRecommended.forEach(varName => {
        console.log(`   - ${varName}`);
    });
    console.log('These are recommended for production use.');
}

// Check if node_modules exists
const nodeModulesPath = path.join(__dirname, '..', 'node_modules');
if (!fs.existsSync(nodeModulesPath)) {
    console.log('\n📦 Installing dependencies...');
    console.log('Please run: npm install');
} else {
    console.log('\n✅ Dependencies are installed');
}

// Display next steps
console.log('\n🎯 Next Steps:');
console.log('1. Update your .env file with the correct values');
console.log('2. Run: npm install (if not already done)');
console.log('3. Run: npm start');
console.log('4. Visit: http://localhost:3000');

console.log('\n📖 For detailed setup instructions, see README.md');
console.log('🔗 Discord OAuth Setup: https://discord.com/developers/applications');
console.log('🔗 SonoranCAD API: https://docs.sonoransoftware.com/cad/api-integration');

console.log('\n✨ Setup complete!');
