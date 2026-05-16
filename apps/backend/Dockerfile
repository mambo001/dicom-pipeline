FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache openssl

COPY package.json tsconfig.base.json ./
COPY apps/backend/package.json apps/backend/package.json
COPY apps/desktop/package.json apps/desktop/package.json
COPY packages/contracts/package.json packages/contracts/package.json

RUN npm install --verbose

COPY . .

WORKDIR /app/apps/backend
RUN rm -rf node_modules && ln -s /app/node_modules node_modules

EXPOSE 8080

CMD ["npx", "tsx", "src/main.ts"]