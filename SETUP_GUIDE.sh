#!/bin/bash

# LendStore Setup Verification Script
# This script verifies that all components are properly configured

echo "================================"
echo "LendStore Setup Verification"
echo "================================"
echo ""

# Check if .env exists in root
if [ -f ".env" ]; then
    echo "✓ .env file found in root directory"
    echo ""
    echo "Configuration:"
    grep -v "^#" .env | grep -v "^$"
else
    echo "✗ .env file NOT found in root directory"
    exit 1
fi

echo ""
echo "================================"
echo "Docker Configuration"
echo "================================"
echo ""

# Check if docker-compose.yml is properly configured
if grep -q "env_file:" docker-compose.yml && grep -q "./.env" docker-compose.yml; then
    echo "✓ docker-compose.yml is configured to use root .env"
else
    echo "✗ docker-compose.yml is NOT properly configured"
    exit 1
fi

echo ""
echo "================================"
echo "Starting Services"
echo "================================"
echo ""
echo "Run the following command to start all services:"
echo ""
echo "  docker-compose up --build"
echo ""

echo "================================"
echo "Testing After Startup"
echo "================================"
echo ""
echo "After services are running, test the following endpoints:"
echo ""
echo "1. Backend Health Check:"
echo "   curl http://3.108.233.74:5000/health"
echo ""
echo "2. Database Connection:"
echo "   curl http://3.108.233.74:5000/health"
echo ""
echo "3. Test Login (after registering a user):"
echo "   curl -X POST http://3.108.233.74:5000/api/auth/login \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -d '{\"email\": \"test@example.com\", \"password\": \"password123\"}'"
echo ""
echo "4. Frontend:"
echo "   Visit http://3.108.233.74"
echo ""

echo "================================"
echo "Troubleshooting"
echo "================================"
echo ""
echo "If signin is not working:"
echo ""
echo "1. Check backend logs:"
echo "   docker logs lendstore-backend"
echo ""
echo "2. Check MySQL is running:"
echo "   docker logs lendstore-mysql"
echo ""
echo "3. Check frontend logs:"
echo "   docker logs lendstore-frontend"
echo ""
echo "4. Verify database is initialized:"
echo "   docker exec lendstore-mysql mysql -u lendstore_user -pBhargavaram@143 -e 'SELECT * FROM lendstore.auth_users;'"
echo ""
