const express = require('express');
const path = require('path');
const { checkCookieAuth } = require('../middleware/simple-auth');

const router = express.Router();

// Main page - shows login or redirects based on auth status
router.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Hello world page - only accessible with valid authentication
router.get('/hello', checkCookieAuth, (req, res) => {
    if (req.authStatus === 'valid') {
        res.sendFile(path.join(__dirname, '../public/hello.html'));
    } else {
        // Redirect to main page if not authenticated
        res.redirect('/');
    }
});

// No hello page - shown when authentication fails
router.get('/no-hello', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/no-hello.html'));
});

module.exports = router;