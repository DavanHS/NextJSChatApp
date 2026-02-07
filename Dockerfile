FROM oven/bun:1
WORKDIR /app
COPY . .
RUN bun install
ENV PORT=10000 
EXPOSE 10000
CMD ["bun", "src/ws-server.ts"] 
