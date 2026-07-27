FROM node:22-bookworm-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY server ./server
COPY lib ./lib
ENV PORT=8788
EXPOSE 8788
CMD ["node", "--import", "tsx", "server/index.ts"]