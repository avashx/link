#!/bin/bash

echo "🚀 LinkrtGOD MongoDB Setup Script"
echo "=================================="

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed."
    echo "💡 Please install Docker first: https://docs.docker.com/get-docker/"
    echo "💡 Alternative: Install MongoDB locally or use MongoDB Atlas"
    exit 1
fi

echo "🔍 Checking if MongoDB container already exists..."

# Check if MongoDB container is already running
if docker ps | grep -q mongodb-linkrt; then
    echo "✅ MongoDB container is already running!"
    echo "📊 Container info:"
    docker ps --filter "name=mongodb-linkrt" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
    exit 0
fi

# Check if MongoDB container exists but is stopped
if docker ps -a | grep -q mongodb-linkrt; then
    echo "🔄 Starting existing MongoDB container..."
    docker start mongodb-linkrt
    echo "✅ MongoDB container started!"
    exit 0
fi

echo "📦 Creating new MongoDB container..."

# Create and start MongoDB container
docker run -d \
  --name mongodb-linkrt \
  -p 27017:27017 \
  -v mongodb-linkrt-data:/data/db \
  -e MONGO_INITDB_DATABASE=linkrtgod \
  mongo:latest

if [ $? -eq 0 ]; then
    echo "✅ MongoDB container created and started successfully!"
    echo "📊 Connection details:"
    echo "   🔗 URI: mongodb://localhost:27017"
    echo "   📂 Database: linkrtgod"
    echo "   🔧 Container name: mongodb-linkrt"
    echo ""
    echo "⏳ Waiting for MongoDB to be ready..."
    sleep 3
    echo "🎉 MongoDB is ready to use!"
    echo ""
    echo "📝 To stop MongoDB later:"
    echo "   docker stop mongodb-linkrt"
    echo ""
    echo "📝 To remove MongoDB container and data:"
    echo "   docker stop mongodb-linkrt"
    echo "   docker rm mongodb-linkrt"
    echo "   docker volume rm mongodb-linkrt-data"
else
    echo "❌ Failed to create MongoDB container"
    echo "💡 Try running with sudo or check Docker daemon"
    exit 1
fi
