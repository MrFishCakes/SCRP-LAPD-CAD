# SCRP-LAPD-CAD Application Process Chart

## Overview
This document outlines the complete process flow of the SCRP-LAPD-CAD application from startup to user interaction, call detection, and real-time updates.

---

## 🚀 1. APPLICATION STARTUP

```
Server Startup (server.js)
├── Initialize Express App
├── Configure Middleware
│   ├── CORS (Cross-Origin Resource Sharing)
│   ├── Helmet (Security headers)
│   ├── Rate Limiting (1000 requests per 15 minutes)
│   └── Body Parsing (JSON, URL-encoded)
├── Setup Session Management
│   ├── Passport.js initialization
│   └── Express-Session (24-hour cookies)
├── Configure View Engine (EJS)
├── Initialize Database (Hybrid: Redis + SQLite)
│   ├── Connect to Redis (localhost:6379)
│   ├── Connect to SQLite (./data/database.sqlite)
│   └── Create Tables (users, sessions)
├── Initialize WebSocket Server (port 3000)
├── Mount Routes:
│   ├── /auth (Discord OAuth authentication)
│   ├── /api (SonoranCAD API endpoints)
│   ├── /sonoran (SonoranCAD monitoring)
│   └── / (Web routes)
└── Start Server (port 3000)
```

---

## 🔐 2. USER AUTHENTICATION FLOW

```
User Visits Application (/)
├── checkCookieAuth Middleware
│   ├── Check for 'discord_id' cookie
│   ├── Verify cookie signature (HMAC-SHA256)
│   ├── Validate cookie expiration (7 days)
│   └── Set req.authStatus & req.user
├── If authStatus === 'valid':
│   └── Redirect to /hello (PremierOne Mobile Client)
└── If authStatus !== 'valid':
    └── Show Login Page (index.html)
        ├── Discord OAuth Button
        ├── User clicks → /auth/discord
        ├── Discord OAuth Flow
        │   ├── Redirect to Discord
        │   ├── User authorizes app
        │   └── Discord returns with code
        ├── Exchange code for access token
        ├── Get user info from Discord API
        ├── Create signed cookie
        ├── Store user in database
        └── Redirect to /hello
```

---

## 📱 3. PREMIERONE MOBILE CLIENT (/hello)

```
User Accesses /hello
├── checkCookieAuth Middleware
├── Load hello.html (PremierOne Mobile Interface)
├── Frontend Initialization:
│   ├── Connect to WebSocket (/ws)
│   ├── Load active calls from /api/active-911-calls
│   ├── Setup audio system (INCOMING_911_TONE.mp3)
│   ├── Sync time with Apple servers
│   └── Start 5-second polling loop
└── Display Interface:
    ├── Active Incident Panel (cleared unless attached)
    ├── Calls Tab (shows all active 911 calls)
    ├── Audio Controls
    └── Time Display (Los Angeles timezone)
```

---

## 📡 4. SONORANCAD API INTEGRATION

```
SonoranCAD API Monitoring
├── Manual Service (sonoran-api.js)
│   ├── Configuration Validation
│   │   ├── Check ENABLE_SONORAN_API environment variable
│   │   ├── Validate SONORAN_API_KEY
│   │   └── Validate SONORAN_COMMUNITY_ID
│   ├── Initialize SonoranAPI instance
│   └── Ready for manual checks
├── API Endpoints (/sonoran/*):
│   ├── /monitor/status - Check service status
│   ├── /monitor/start - Initialize service
│   ├── /monitor/check - Manual API check
│   └── /calls/active - Get active calls from Redis
└── API Call Process:
    ├── sonoranAPI.getCalls(serverId: 1, type: 0)
    ├── Filter calls by origin: 0 (911 calls only)
    ├── Process new vs existing calls
    └── Store in Redis with 24-hour expiration
```

---

## 🔄 5. CALL DETECTION & STORAGE PROCESS

```
/api/active-911-calls Endpoint
├── Fetch from SonoranCAD API
│   └── sonoranAPI.getCalls(1, 100, 0)
├── Filter 911 Calls
│   └── activeCalls.filter(call => call.origin === 0)
├── Redis Check & Storage Loop:
│   ├── For each filtered call:
│   │   ├── Extract callId (call.id || call.callId)
│   │   ├── Check Redis: database.getFromCache(`call:${callId}`)
│   │   ├── If NOT in Redis (New Call):
│   │   │   ├── Create callData object
│   │   │   │   ├── Spread call properties
│   │   │   │   ├── Add callId
│   │   │   │   ├── Add timestamp
│   │   │   │   └── Add source: 'sonoran-api'
│   │   │   ├── Store in Redis: database.setCache(`call:${callId}`, callData, 86400)
│   │   │   ├── Add to priority queue: database.zAdd('calls:priority', Date.now(), callId)
│   │   │   └── Log: "✅ New 911 call stored"
│   │   └── If IN Redis (Existing Call):
│   │       └── Add to existingCalls array
│   └── Log summary: "📊 Call Summary: X new calls, Y existing calls"
└── Return JSON Response:
    ├── success: true
    ├── calls: filteredCalls
    ├── newCalls: count
    ├── existingCalls: count
    └── total: count
```

---

## 🌐 6. WEBSOCKET REAL-TIME COMMUNICATION

```
WebSocket Server (/ws)
├── Client Connection
│   ├── Generate unique client ID
│   ├── Store client info (IP, User-Agent, timestamp)
│   └── Add to clients Set
├── Heartbeat System
│   ├── Send ping every 30 seconds
│   ├── Handle pong responses
│   └── Remove inactive clients
├── Message Broadcasting
│   ├── new_call events
│   ├── call_update events
│   ├── call_closed events
│   └── system_status events
└── Client Disconnection
    └── Remove from clients Set
```

---

## 💾 7. DATA STORAGE ARCHITECTURE

```
Hybrid Database System
├── Redis (Cache Layer)
│   ├── User sessions: session:${sessionId}
│   ├── User data: user:${discordId}
│   ├── Call data: call:${callId} (24-hour TTL)
│   └── Priority queue: calls:priority (sorted set)
├── SQLite (Persistent Storage)
│   ├── users table (Discord ID, username, admin access)
│   ├── sessions table (session tracking)
│   └── Data durability & backup
└── Cache Operations:
    ├── getFromCache() - Check Redis first
    ├── setCache() - Store with TTL
    ├── zAdd() - Add to sorted sets
    ├── zRevRange() - Get from sorted sets
    └── deleteFromCache() - Remove entries
```

---

## 🎵 8. AUDIO SYSTEM

```
Audio Playback System
├── Audio File: /audio/INCOMING_911_TONE.mp3
├── Web Audio API Fallback
├── Audio Context Management
│   ├── Create AudioContext
│   ├── Handle suspended state
│   └── Resume context if needed
├── Playback Triggers:
│   ├── New 911 call detected
│   ├── User attaches to call
│   └── NOT on call closure
└── Audio Controls in UI
    ├── Play/Pause buttons
    ├── Volume control
    └── Audio status display
```

---

## ⏰ 9. TIME SYNCHRONIZATION

```
Time Management System
├── Apple Time Server Sync
│   ├── Fetch time from time.apple.com
│   ├── Calculate Los Angeles timezone offset
│   └── Update display every 1 minute
├── Force Resync Triggers:
│   ├── Page load
│   ├── Calls panel refresh
│   └── 5-second polling interval
└── Display Format:
    ├── Los Angeles timezone
    ├── 12-hour format with AM/PM
    └── Real-time updates
```

---

## 🔄 10. CONTINUOUS OPERATION

```
Ongoing Processes
├── Frontend Polling (5 seconds)
│   ├── Fetch calls from /api/active-911-calls
│   ├── Update calls tab
│   ├── Check for new calls (play audio)
│   └── Sync time display
├── WebSocket Heartbeat (30 seconds)
│   ├── Send ping to clients
│   ├── Monitor connection health
│   └── Clean up dead connections
├── Redis TTL Management
│   ├── Automatic expiration (24 hours)
│   ├── Cleanup expired sessions
│   └── Priority queue maintenance
└── Error Handling
    ├── Redis connection failures
    ├── SonoranCAD API errors
    ├── WebSocket disconnections
    └── Graceful degradation
```

---

## 🔄 KEY DATA FLOWS

### 1. New Call Detection Flow
```
SonoranCAD API → Filter (origin: 0) → Redis Check → Store New → WebSocket Broadcast → Frontend Update → Audio Play
```

### 2. User Authentication Flow
```
Discord OAuth → Cookie Creation → Database Storage → Session Management
```

### 3. Real-time Updates Flow
```
WebSocket Connection → Event Broadcasting → Frontend Refresh
```

### 4. Call Management Flow
```
Redis Storage → Priority Queue → Frontend Display → User Interaction
```

---

## 📊 CURRENT SYSTEM STATUS

Based on the terminal logs, the system is currently:

- ✅ **Server**: Running on port 3000
- ✅ **Database**: Redis and SQLite connected
- ✅ **WebSocket**: Server initialized and accepting connections
- ✅ **SonoranCAD API**: Configuration validated and ready
- ✅ **Call Detection**: Working (1 existing call detected)
- ✅ **Redis Storage**: Functional (calls being stored and retrieved)

---

## 🎯 SUMMARY

The SCRP-LAPD-CAD application is a comprehensive system that:

1. **Authenticates users** via Discord OAuth with secure cookie-based sessions
2. **Monitors SonoranCAD** for 911 calls using manual API checks
3. **Detects new calls** by comparing against Redis storage
4. **Stores call data** in Redis with 24-hour expiration
5. **Provides real-time updates** via WebSocket connections
6. **Displays calls** in a mobile-first PremierOne interface
7. **Plays audio alerts** for new calls and user attachments
8. **Synchronizes time** with Apple servers for accurate Los Angeles time

The system is designed for reliability with hybrid database storage, comprehensive error handling, and graceful degradation when services are unavailable.


