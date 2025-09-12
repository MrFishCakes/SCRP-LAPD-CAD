// Simple test - just define the functions
console.log('External JS file loaded!');

function deleteUser(discordId, username) {
    console.log('deleteUser called with:', discordId, username);
    alert('Delete user: ' + username + ' (ID: ' + discordId + ')');
}

function refreshCache(discordId) {
    console.log('refreshCache called with:', discordId);
    alert('Refresh cache for ID: ' + discordId);
}

console.log('Functions defined:', typeof deleteUser, typeof refreshCache);