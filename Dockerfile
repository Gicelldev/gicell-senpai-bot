FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy app files
COPY . .

# Create volume for session data
VOLUME [ "/app/session" ]

# Create volume for logs
VOLUME [ "/app/logs" ]

# Expose port
EXPOSE 3000

# Start app
CMD ["node", "src/index.js"] 