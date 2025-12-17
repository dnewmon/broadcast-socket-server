"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSocketServer = createSocketServer;
const express_1 = __importDefault(require("express"));
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const cors_1 = __importDefault(require("cors"));
function createSocketServer(config) {
    const app = (0, express_1.default)();
    const httpServer = (0, http_1.createServer)(app);
    // Initialize Socket.IO with CORS
    const io = new socket_io_1.Server(httpServer, {
        cors: {
            origin: config.corsOrigin,
            methods: ["GET", "POST"],
        },
    });
    // Helper function to POST events to HTTP proxy endpoint
    async function sendToProxy(payload) {
        if (!config.proxy) {
            return null;
        }
        try {
            const headers = {
                "Content-Type": "application/json",
            };
            if (config.proxy.bearerToken) {
                headers["Authorization"] = `Bearer ${config.proxy.bearerToken}`;
            }
            const response = await fetch(config.proxy.url, {
                method: "POST",
                headers,
                body: JSON.stringify(payload),
            });
            if (!response.ok) {
                console.error(`Proxy request failed: ${response.status} ${response.statusText}`);
                return null;
            }
            const data = await response.json();
            return data;
        }
        catch (error) {
            console.error("Error sending to proxy:", error);
            return null;
        }
    }
    // Express middleware
    app.use((0, cors_1.default)({ origin: config.corsOrigin }));
    app.use(express_1.default.json());
    // Health check endpoint
    app.get("/health", (req, res) => {
        res.json({ status: "ok", timestamp: Date.now() });
    });
    // Proxy endpoint to send messages to a channel
    app.post("/proxy", (req, res) => {
        const channel = req.query.channel;
        if (!channel) {
            return res.status(400).json({ error: "Channel parameter is required" });
        }
        const message = {
            data: req.body,
            timestamp: Date.now(),
            sender: "proxy",
        };
        // Emit message to all sockets in the channel room
        io.to(channel).emit("message", message);
        res.json({
            success: true,
            channel,
            message: "Message sent to channel",
        });
    });
    // Socket.IO connection handling
    io.on("connection", async (socket) => {
        const channel = socket.handshake.query.channel;
        if (!channel) {
            console.log("Client connected without channel, disconnecting");
            socket.disconnect();
            return;
        }
        console.log(`Client ${socket.id} connected to channel: ${channel}`);
        // Join the channel room
        socket.join(channel);
        // Send connection event to proxy if configured
        if (config.proxy) {
            const proxyResponse = await sendToProxy({
                event: "connection",
                channel,
                socketId: socket.id,
                timestamp: Date.now(),
            });
            console.log(`Proxy responded with ${JSON.stringify(proxyResponse)}`);
            // If proxy returns messages (array), send them back to this specific socket
            if (proxyResponse?.messages) {
                console.log(`Proxy responded with ${proxyResponse.messages}`);
                for (const message of proxyResponse.messages) {
                    socket.emit("message", message);
                }
            }
            else if (proxyResponse?.message) {
                console.log(`Proxy responded with ${proxyResponse.message}`);
                // If proxy returns a single message, send it back to this specific socket
                socket.emit("message", proxyResponse.message);
            }
            else {
                console.log(`Proxy didn't provide a response. Sending generic welcome message back.`);
                console.log(JSON.stringify(proxyResponse));
            }
        }
        else {
            console.log(`No proxy configured. Sending generic welcome message back.`);
            // Fall back to default welcome message if no proxy configured
            const welcomeMessage = {
                data: { text: `Welcome to channel: ${channel}` },
                timestamp: Date.now(),
                sender: "system",
            };
            socket.emit("message", welcomeMessage);
        }
        // Handle incoming messages from client
        socket.on("message", async (data) => {
            if (config.proxy) {
                // Send message event to proxy if configured
                const proxyResponse = await sendToProxy({
                    event: "message",
                    channel,
                    socketId: socket.id,
                    timestamp: Date.now(),
                    data,
                });
                // If proxy returns messages (array), send them back to this specific socket
                if (proxyResponse?.messages) {
                    for (const message of proxyResponse.messages) {
                        socket.emit("message", message);
                    }
                }
                else if (proxyResponse?.message) {
                    // If proxy returns a single message, send it back to this specific socket
                    socket.emit("message", proxyResponse.message);
                }
            }
            else {
                // Fall back to default broadcast behavior if no proxy configured
                const message = {
                    data,
                    timestamp: Date.now(),
                    sender: socket.id,
                };
                io.to(channel).emit("message", message);
            }
        });
        // Handle disconnection
        socket.on("disconnect", async () => {
            console.log(`Client ${socket.id} disconnected from channel: ${channel}`);
            // Send disconnect event to proxy if configured (fire-and-forget)
            if (config.proxy) {
                sendToProxy({
                    event: "disconnect",
                    channel,
                    socketId: socket.id,
                    timestamp: Date.now(),
                });
            }
        });
    });
    // Start the server
    httpServer.listen(config.port, () => {
        console.log(`Simple Socket Server running on port ${config.port}`);
        console.log(`CORS origin: ${config.corsOrigin}`);
        if (config.proxy) {
            console.log(`HTTP Proxy: ${config.proxy.url}`);
            console.log(`Proxy Auth: ${config.proxy.bearerToken ? "Bearer token configured" : "None"}`);
        }
    });
    return { app, httpServer, io };
}
