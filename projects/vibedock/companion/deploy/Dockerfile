FROM node:24.15.0-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY src ./src
COPY public ./public
USER node
EXPOSE 8080
CMD ["node", "src/relay-server.mjs"]
