FROM node:22-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install --omit=dev

# Copy project files
COPY . .

# Persistent session storage
VOLUME ["/app/auth_info_baileys"]

CMD ["npm", "start"]
