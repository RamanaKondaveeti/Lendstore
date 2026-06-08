# LendStore App - Setup & Troubleshooting Guide

## ✅ Changes Made

### 1. **Moved .env to Root Directory**
   - **Before:** `.env` was in `backend/.env`
   - **After:** `.env` is now in the root directory
   - **Why:** Centralized configuration management for all services

### 2. **Updated docker-compose.yml**
   - Updated `env_file` path from `./backend/.env` to `./.env`
   - Added explicit `EXPO_PUBLIC_API_URL` environment variable for frontend

### 3. **Updated Backend Dockerfile**
   - Added .env file copying (with fallback for standalone builds)
   - Ensures backend can read environment variables

### 4. **Updated Frontend Dockerfile**
   - Added default value for `EXPO_PUBLIC_API_URL`
   - Ensures API URL is available at build time

### 5. **Fixed CORS Configuration**
   - Improved CORS handling in backend
   - Added multiple origin support with proper trimming
   - Added `optionsSuccessStatus: 200`

## 📋 Current Configuration

Your `.env` file contains:

```
PORT=5000
DB_HOST=mysql
DB_PORT=3306
DB_NAME=lendstore
DB_USER=lendstore_user
DB_PASSWORD=Bhargavaram@143
JWT_SECRET=change-this-secret-before-production
CORS_ORIGIN=http://3.108.233.74
EXPO_PUBLIC_API_URL=http://3.108.233.74:5000
```

## 🚀 Quick Start

### Option 1: Using Docker Compose (Recommended)

```bash
# Navigate to project root
cd /home/ubuntu/Lendstore

# Start all services
docker-compose up --build

# Services will be available at:
# - Backend API: http://3.108.233.74:5000
# - Frontend: http://3.108.233.74
# - MySQL: 3.108.233.74:3386
```

### Option 2: Running Locally (Without Docker)

#### Prerequisites:
- Node.js 20+
- MySQL Server on EC2 instance
- Database initialized with init.sql

#### Setup Backend:

```bash
cd backend
npm install
# Update .env DB_HOST to EC2 MySQL IP if needed
npm start
```

#### Setup Frontend:

```bash
cd frontend
npm install
EXPO_PUBLIC_API_URL=http://3.108.233.74:5000 npm start
```

## ✔️ Verify Everything is Working

### 1. Test Backend Health

```bash
curl http://3.108.233.74:5000/health
```

Expected response: `{"ok":true}`

### 2. Create a Test User (Register)

```bash
curl -X POST http://3.108.233.74:5000/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Test User",
    "email": "test@example.com",
    "password": "password123"
  }'
```

Expected response: 
```json
{
  "token": "JWT_TOKEN_HERE",
  "user": {
    "_id": "1",
    "id": 1,
    "name": "Test User",
    "email": "test@example.com"
  }
}
```

### 3. Test Login (Sign In)

```bash
curl -X POST http://3.108.233.74:5000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

Expected response: Same as register (with token and user data)

### 4. Test CORS

If testing from a different origin, verify CORS headers are present:

```bash
curl -i -X OPTIONS http://3.108.233.74:5000/api/auth/login \
  -H 'Origin: http://3.108.233.74' \
  -H 'Access-Control-Request-Method: POST'
```

## 🔍 Troubleshooting Sign-In Issues

### Issue 1: "Nothing happens when I click Sign In"

**Causes & Solutions:**

#### A) Frontend Cannot Reach Backend API
- Check `EXPO_PUBLIC_API_URL` in `.env`: should be `http://3.108.233.74:5000`
- Verify backend is running: `curl http://3.108.233.74:5000/health`
- Check browser console for network errors (F12 → Network tab)
- Check if EC2 security group allows port 5000 from your IP
- Verify EC2 backend is running and listening on 0.0.0.0:5000

**Fix:** Update `.env` if needed and restart services:
```bash
ssh your-ec2-instance
cd /home/ubuntu/Lendstore
docker-compose down
docker-compose up --build
```

#### B) Database Not Initialized
- MySQL might not have created tables
- The database might not have auth_users table

**Fix:** Verify database initialization:
```bash
# Check if tables exist
docker exec lendstore-mysql mysql -u lendstore_user -pBhargavaram@143 lendstore -e "SHOW TABLES;"

# Reinitialize if needed
docker-compose down -v  # Remove volumes
docker-compose up --build  # Rebuild and reinitialize
```

#### C) CORS Issues
- Frontend origin not in CORS_ORIGIN list
- Preflight request failing

**Check logs:**
```bash
docker logs lendstore-backend | grep -i cors
docker logs lendstore-backend | grep -i error
```

**Fix:** Update CORS_ORIGIN in `.env`:
```
CORS_ORIGIN=http://3.108.233.74
```

#### D) JWT or Session Issues
- Token not being stored properly
- Token expiration issues

**Check:** Verify AsyncStorage is working in frontend:
```
localStorage.getItem('token')
localStorage.getItem('user')
```

### Issue 2: "Invalid email or password" Error

**Causes:**

1. User doesn't exist - Register first
2. Password is incorrect - Verify credentials
3. Database issue - Check MySQL is running

**Fix:**
```bash
# Verify user exists in database
docker exec lendstore-mysql mysql -u lendstore_user -pBhargavaram@143 lendstore \
  -e "SELECT id, email FROM auth_users WHERE email='test@example.com';"

# If no results, register the user first via the UI or API
```

### Issue 3: "Cannot connect to server" Error

**Check connectivity:**

```bash
# Test from your machine
curl http://3.108.233.74:5000/health

# Test from frontend container
docker exec lendstore-frontend curl http://backend:5000/health
docker exec lendstore-frontend curl http://lendstore-backend:5000/health
```

**If frontend-to-backend fails:** They might not be on the same Docker network

**Fix:**
```bash
# Verify network
docker network ls
docker network inspect lendstore-app_default
```

## 📊 Docker Services Status

View all running services:

```bash
docker-compose ps
```

View logs for debugging:

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f mysql
```

## 🔐 Security Notes

⚠️ **Before Production:**

1. Change `DB_PASSWORD` in `.env`
2. Change `JWT_SECRET` in `.env`
3. Update `CORS_ORIGIN` to your actual domain
4. Set `NODE_ENV=production` in `.env`
5. Use HTTPS instead of HTTP
6. Store passwords securely (not in .env on production)

## 📝 File Structure After Changes

```
mobile/
├── .env (NEW - Root level)
├── docker-compose.yml (UPDATED)
├── SETUP_GUIDE.sh (NEW)
├── backend/
│   ├── Dockerfile (UPDATED)
│   ├── .env (OLD - Can be deleted now)
│   ├── init.sql
│   ├── package.json
│   └── src/
│       ├── db.js
│       └── index.js
├── frontend/
│   ├── Dockerfile (UPDATED)
│   ├── App.js
│   ├── app.json
│   ├── package.json
│   └── ...
└── nginx/
    └── default.conf
```

## 🎯 Next Steps

1. ✅ `.env` is in root - DONE
2. ✅ Docker files updated - DONE
3. ✅ CORS configured - DONE
4. Run: `docker-compose up --build`
5. Test signin with credentials
6. If still failing, check logs: `docker-compose logs -f backend`

## 💡 Pro Tips

- Keep `backend/.env` and `frontend/.env` files for local development (not in Docker)
- Use `.env.local` for sensitive local-only config
- Always test with Docker Compose before deploying
- Monitor logs with `docker-compose logs -f` during testing

---

**For further issues, share the following:**
- Frontend error message (from browser console)
- Backend logs: `docker logs lendstore-backend`
- Docker network status: `docker network inspect lendstore-app_default`
