# Redis Setup Guide

Redis is optional but recommended for better performance. The application will work without Redis, but with slower response times.

## Installation Options

### Option 1: Docker (Recommended)
```bash
# Run Redis in Docker
docker run -d --name redis -p 6379:6379 redis:alpine

# Or with persistence
docker run -d --name redis -p 6379:6379 -v redis-data:/data redis:alpine redis-server --appendonly yes
```

### Option 2: Homebrew (macOS)
```bash
# Install Redis
brew install redis

# Start Redis service
brew services start redis

# Or run manually
redis-server
```

### Option 3: APT (Ubuntu/Debian)
```bash
# Install Redis
sudo apt update
sudo apt install redis-server

# Start Redis service
sudo systemctl start redis-server
sudo systemctl enable redis-server
```

### Option 4: YUM (CentOS/RHEL)
```bash
# Install Redis
sudo yum install redis

# Start Redis service
sudo systemctl start redis
sudo systemctl enable redis
```

## Configuration

Add these environment variables to your `.env` file:

```env
# Redis Configuration (Optional)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
```

## Testing Redis Connection

```bash
# Test Redis connection
redis-cli ping
# Should return: PONG
```

## Without Redis

If you don't want to use Redis, the application will work fine with just SQLite. You'll see warnings in the logs about Redis connection failures, but the application will continue to function normally.

## Performance Benefits

With Redis enabled:
- ✅ User data cached for 1 hour
- ✅ Sessions cached for 24 hours  
- ✅ Refresh tokens cached for 7 days
- ✅ API logs cached for 24 hours
- ✅ Faster response times
- ✅ Reduced SQLite load

Without Redis:
- ⚠️ All data fetched from SQLite on every request
- ⚠️ Slower response times
- ⚠️ Higher SQLite load
- ✅ Still fully functional
- ✅ No additional services to manage
