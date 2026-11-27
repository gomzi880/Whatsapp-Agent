FROM node:22-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install --omit=dev

# Copy project files
COPY . .

# Persistent session and database storage
VOLUME ["/app/auth_info_baileys", "/app/backups"]

EXPOSE 3000

CMD ["npm", "start"]
