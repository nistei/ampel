FROM node:17-alpine as builder

COPY package.json .
COPY yarn.lock .
RUN yarn install

COPY . .
RUN npm run build

FROM node:17-alpine

COPY --from=builder dist app/dist

CMD ["node", "app/dist/server.js"]
