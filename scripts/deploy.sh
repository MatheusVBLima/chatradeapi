#!/bin/bash

# Deploy script for Chatbot API on Vultr
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
DOMAIN="seu-dominio.com"
EMAIL="seu-email@dominio.com"
COMPOSE_FILE="docker-compose.yml"

echo -e "${GREEN}🚀 Starting deployment process...${NC}"

# Check if required files exist
echo -e "${YELLOW}📋 Checking required files...${NC}"
if [ ! -f ".env.production" ]; then
    echo -e "${RED}❌ .env.production file not found!${NC}"
    exit 1
fi

if [ ! -f "$COMPOSE_FILE" ]; then
    echo -e "${RED}❌ docker-compose.yml file not found!${NC}"
    exit 1
fi

# Stop existing containers
echo -e "${YELLOW}🛑 Stopping existing containers...${NC}"
docker-compose -f $COMPOSE_FILE down --remove-orphans || true

# Build and start services
echo -e "${YELLOW}🔨 Building and starting services...${NC}"
docker-compose -f $COMPOSE_FILE build --no-cache
docker-compose -f $COMPOSE_FILE up -d

# Enable site in Nginx
echo -e "${YELLOW}🔗 Enabling Nginx site configuration...${NC}"
docker-compose -f $COMPOSE_FILE exec nginx ln -sf /etc/nginx/sites-available/chatbot-api /etc/nginx/sites-enabled/chatbot-api || true

# Wait for services to be ready
echo -e "${YELLOW}⏳ Waiting for services to be ready...${NC}"
sleep 30

# Test Nginx configuration
echo -e "${YELLOW}🧪 Testing Nginx configuration...${NC}"
docker-compose -f $COMPOSE_FILE exec nginx nginx -t

# Reload Nginx
echo -e "${YELLOW}🔄 Reloading Nginx...${NC}"
docker-compose -f $COMPOSE_FILE exec nginx nginx -s reload

# Setup SSL certificate (first time only)
if [ ! -d "./certbot_certs/live/$DOMAIN" ]; then
    echo -e "${YELLOW}🔒 Setting up SSL certificate for $DOMAIN...${NC}"
    docker-compose -f $COMPOSE_FILE run --rm certbot certonly \
        --webroot \
        --webroot-path=/var/www/certbot \
        --email $EMAIL \
        --agree-tos \
        --no-eff-email \
        -d $DOMAIN \
        -d www.$DOMAIN
    
    # Reload Nginx after SSL setup
    docker-compose -f $COMPOSE_FILE exec nginx nginx -s reload
else
    echo -e "${GREEN}✅ SSL certificate already exists${NC}"
fi

# Health check
echo -e "${YELLOW}🏥 Performing health checks...${NC}"
sleep 10

# Check API health
if curl -f http://localhost/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ API health check passed${NC}"
else
    echo -e "${RED}❌ API health check failed${NC}"
    echo -e "${YELLOW}📋 Container logs:${NC}"
    docker-compose -f $COMPOSE_FILE logs --tail=20 api
    exit 1
fi

# Check HTTPS (if SSL is configured)
if [ -d "./certbot_certs/live/$DOMAIN" ]; then
    if curl -f https://$DOMAIN/health > /dev/null 2>&1; then
        echo -e "${GREEN}✅ HTTPS health check passed${NC}"
    else
        echo -e "${YELLOW}⚠️  HTTPS health check failed (might take a few minutes after SSL setup)${NC}"
    fi
fi

# Setup log rotation
echo -e "${YELLOW}📝 Setting up log rotation...${NC}"
cat > /tmp/chatbot-logrotate << EOF
./logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    sharedscripts
    postrotate
        docker-compose -f $COMPOSE_FILE exec nginx nginx -s reopen
    endscript
}
EOF

sudo mv /tmp/chatbot-logrotate /etc/logrotate.d/chatbot

# Setup SSL renewal cron job
echo -e "${YELLOW}⏰ Setting up SSL renewal cron job...${NC}"
(crontab -l 2>/dev/null; echo "0 12 * * * cd $(pwd) && docker-compose -f $COMPOSE_FILE run --rm certbot renew && docker-compose -f $COMPOSE_FILE exec nginx nginx -s reload") | crontab -

# Display running services
echo -e "${GREEN}📊 Running services:${NC}"
docker-compose -f $COMPOSE_FILE ps

# Display useful information
echo -e "\n${GREEN}🎉 Deployment completed successfully!${NC}"
echo -e "\n${YELLOW}📋 Important information:${NC}"
echo -e "• API URL: http://localhost (or https://$DOMAIN if SSL is configured)"
echo -e "• Health check: /health"
echo -e "• Logs: docker-compose logs -f"
echo -e "• Stop services: docker-compose down"
echo -e "\n${YELLOW}🔧 Next steps:${NC}"
echo -e "1. Update DNS records to point to this server's IP"
echo -e "2. Update DOMAIN and EMAIL variables in this script"
echo -e "3. Configure firewall to allow ports 80 and 443"
echo -e "4. Monitor logs: docker-compose logs -f api nginx"

echo -e "\n${GREEN}✅ All done!${NC}"