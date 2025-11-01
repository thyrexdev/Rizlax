# Start all services
docker compose up -d

# Stop all services  
docker compose down

# Rebuild and start
docker compose up --build -d

# Check service status
docker compose ps

# View logs
docker compose logs [service_name] --tail=10