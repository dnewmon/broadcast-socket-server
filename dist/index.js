#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const server_1 = require("./server");
const program = new commander_1.Command();
program
    .name("broadcast-socket-server")
    .description("Broadcast WebSocket server with channel support")
    .version("1.0.0")
    .option("-p, --port <number>", "Port to run the server on", "12000")
    .option("-c, --cors-origin <string>", "CORS origin", "http://localhost:5173")
    .option("--proxy-url <string>", "HTTP proxy endpoint URL for bi-directional event forwarding")
    .option("--proxy-token <string>", "Bearer token for proxy authentication")
    .parse(process.argv);
const options = program.opts();
const config = {
    port: parseInt(options.port, 10),
    corsOrigin: options.corsOrigin,
};
// Add proxy configuration if provided
if (options.proxyUrl) {
    config.proxy = {
        url: options.proxyUrl,
        bearerToken: options.proxyToken,
    };
}
// Start the server
(0, server_1.createSocketServer)(config);
