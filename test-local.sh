#!/bin/bash

echo "🧪 Testing Reonic Lambda with PostgreSQL"
echo "========================================"

# Check if Docker Compose is running
if ! docker compose ps | grep -q "reonic-lambda"; then
    echo "❌ Docker Compose services are not running. Starting them..."
    docker compose up -d
    echo "⏳ Waiting for services to be ready..."
    sleep 10
fi

# Test the Lambda function via Lambda runtime interface
echo "📡 Testing Lambda runtime interface..."
response1=$(curl -s -XPOST "http://localhost:9000/2015-03-31/functions/function/invocations" \
     -H "Content-Type: application/json" \
     -d '{}')

if [ $? -eq 0 ]; then
    echo "✅ Lambda runtime interface responded successfully!"
    echo "📄 Response:"
    echo "$response1" | jq '.' 2>/dev/null || echo "$response1"
else
    echo "❌ Failed to get response from Lambda runtime interface"
fi

echo ""
echo "📡 Testing direct HTTP interface..."
response2=$(curl -s -X POST http://localhost:9000/)

if [ $? -eq 0 ]; then
    echo "✅ Direct HTTP interface responded successfully!"
    echo "📄 Response:"
    echo "$response2" | jq '.' 2>/dev/null || echo "$response2"
else
    echo "❌ Failed to get response from direct HTTP interface"
fi

echo ""
echo "🔄 To test Lambda runtime interface:"
echo "   curl -XPOST \"http://localhost:9000/2015-03-31/functions/function/invocations\" -H \"Content-Type: application/json\" -d '{}'"
echo ""
echo "🔄 To test direct HTTP:"
echo "   curl -X POST http://localhost:9000/"
echo ""
echo "🛑 To stop services, run: docker compose down" 