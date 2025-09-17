import express, { Request, Response, Router } from 'express';
import path from 'path';
import { checkCookieAuth } from '../middleware/simple-auth';

const router: Router = express.Router();

// Main page - shows login or redirects based on auth status
router.get('/', checkCookieAuth, (req: Request, res: Response): void => {
    if (req.authStatus === 'valid') {
        // User is authenticated, redirect to hello page
        res.redirect('/hello');
    } else {
        // User is not authenticated, show login page
        res.sendFile(path.join(__dirname, '../public/index.html'));
    }
});

// Hello world page - only accessible with valid authentication
router.get('/hello', checkCookieAuth, (req: Request, res: Response): void => {
    if (req.authStatus === 'valid') {
        res.sendFile(path.join(__dirname, '../public/hello.html'));
    } else {
        // Redirect to main page if not authenticated
        res.redirect('/');
    }
});

// No hello page - shown when authentication fails
router.get('/no-hello', checkCookieAuth, (_req: Request, res: Response): void => {
    res.sendFile(path.join(__dirname, '../public/no-hello.html'));
});

// Login page
router.get('/login', (_req: Request, res: Response): void => {
    res.sendFile(path.join(__dirname, '../public/login.html'));
});

// Status endpoint
router.get('/status', (_req: Request, res: Response): void => {
    res.json({
        server: 'SCRP-LAPD-CAD',
        status: 'running',
        timestamp: new Date().toISOString(),
        environment: process.env['NODE_ENV'] || 'development',
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch
    });
});

export default router;
