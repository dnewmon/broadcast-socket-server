# Broadcast Socket Server

A lightweight WebSocket broadcast server with channel support, built on Socket.IO and Express. Perfect for real-time broadcasting scenarios where you need to distribute messages to multiple clients organized by channels.

## Features

- **Channel-based Broadcasting**: Organize clients into isolated channels for targeted message distribution
- **HTTP Proxy Endpoint**: Send messages to channels via REST API without WebSocket connection
- **Bi-directional HTTP Proxy**: Forward WebSocket events to an external HTTP endpoint and proxy responses back
- **Health Check**: Built-in health monitoring endpoint
- **CLI Support**: Run as a standalone server with command-line options
- **Programmatic API**: Use as a library in your Node.js application
- **TypeScript Support**: Fully typed for better developer experience

## Installation

```bash
npm install broadcast-socket-server
```

## Quick Start

### As a CLI Tool

Run the server directly from the command line:

```bash
# Use default settings (port 12000, CORS origin http://localhost:5173)
npx broadcast-socket-server

# Custom port and CORS origin
npx broadcast-socket-server --port 8080 --cors-origin "http://localhost:3000"

# With HTTP proxy for bi-directional event forwarding
npx broadcast-socket-server --proxy-url "http://localhost:3000/websocket-events"

# With HTTP proxy and authentication
npx broadcast-socket-server --proxy-url "http://localhost:3000/websocket-events" --proxy-token "your-secret-token"
```

### As a Library

Use the server programmatically in your Node.js application:

```typescript
import { createSocketServer } from 'broadcast-socket-server';

// Basic configuration
const server = createSocketServer({
  port: 12000,
  corsOrigin: 'http://localhost:5173'
});

// With HTTP proxy for bi-directional event forwarding
const serverWithProxy = createSocketServer({
  port: 12000,
  corsOrigin: 'http://localhost:5173',
  proxy: {
    url: 'http://localhost:3000/websocket-events',
    bearerToken: 'your-secret-token' // Optional
  }
});

console.log('Server started successfully');
```

## Usage Examples

### Client-Side Connection (Browser)

Connect to a specific channel using Socket.IO client:

```javascript
import { io } from 'socket.io-client';

// Connect to the 'notifications' channel
const socket = io('http://localhost:12000', {
  query: {
    channel: 'notifications'
  }
});

// Listen for messages
socket.on('message', (message) => {
  console.log('Received:', message);
  // Output: { data: {...}, timestamp: 1234567890, sender: 'socket-id' }
});

// Send a message to the channel
socket.emit('message', {
  type: 'notification',
  title: 'Hello World',
  body: 'This is a broadcast message'
});
```

### Multiple Channels Example

Different clients can subscribe to different channels:

```javascript
// Client A - subscribes to 'chat' channel
const chatSocket = io('http://localhost:12000', {
  query: { channel: 'chat' }
});

chatSocket.on('message', (msg) => {
  console.log('Chat message:', msg.data);
});

// Client B - subscribes to 'updates' channel
const updatesSocket = io('http://localhost:12000', {
  query: { channel: 'updates' }
});

updatesSocket.on('message', (msg) => {
  console.log('Update received:', msg.data);
});
```

### HTTP Proxy Endpoint

Send messages to channels without maintaining a WebSocket connection:

```javascript
// Using fetch API
fetch('http://localhost:12000/proxy?channel=notifications', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    type: 'alert',
    message: 'System maintenance in 5 minutes'
  })
});

// Using axios
import axios from 'axios';

await axios.post(
  'http://localhost:12000/proxy',
  {
    type: 'update',
    status: 'completed',
    taskId: '12345'
  },
  {
    params: { channel: 'tasks' }
  }
);
```

### Bi-directional HTTP Proxy

Forward WebSocket events to an external HTTP endpoint and receive responses back. This allows you to manage WebSocket events through a simple REST API.

#### Setting Up the Proxy

Configure your server with a proxy URL:

```typescript
import { createSocketServer } from 'broadcast-socket-server';

const server = createSocketServer({
  port: 12000,
  corsOrigin: 'http://localhost:5173',
  proxy: {
    url: 'http://localhost:3000/websocket-events',
    bearerToken: 'your-secret-token' // Optional authentication
  }
});
```

#### Event Payload Structure

The server POSTs events to your HTTP endpoint with this structure:

```typescript
interface ProxyEventPayload {
  event: "connection" | "message" | "disconnect";
  channel: string;
  socketId: string;
  timestamp: number;
  data?: any; // Only present for "message" events
}
```

#### Handling Events in Your HTTP Endpoint

Create an endpoint to receive and process WebSocket events:

```javascript
// Express.js example
app.post('/websocket-events', (req, res) => {
  const { event, channel, socketId, timestamp, data } = req.body;

  // Verify bearer token if configured
  const authHeader = req.headers.authorization;
  if (authHeader !== 'Bearer your-secret-token') {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  switch (event) {
    case 'connection':
      console.log(`Client ${socketId} connected to ${channel}`);
      // Return a welcome message to the connecting socket
      return res.json({
        message: {
          data: { text: `Welcome! You are ${socketId}` },
          timestamp: Date.now(),
          sender: 'server'
        }
      });

    case 'message':
      console.log(`Message from ${socketId} in ${channel}:`, data);
      // Process the message and send a response back
      return res.json({
        message: {
          data: {
            echo: data,
            processedAt: Date.now()
          },
          timestamp: Date.now(),
          sender: 'server'
        }
      });

    case 'disconnect':
      console.log(`Client ${socketId} disconnected from ${channel}`);
      // No response needed for disconnect events
      return res.json({});

    default:
      return res.status(400).json({ error: 'Unknown event type' });
  }
});
```

#### Response Format

Your HTTP endpoint can optionally return a message to send back to the socket:

```typescript
interface ProxyEventResponse {
  message?: {
    data: any;              // Your response payload
    timestamp: number;      // Unix timestamp
    sender?: string;        // Identifier for the sender
  }
}
```

#### Behavior

- **Connection Events**: Sent when a client connects. Response is sent only to the connecting socket.
- **Message Events**: Sent when a client sends a message. Response is sent only to the socket that sent the message.
- **Disconnect Events**: Sent when a client disconnects. No response expected (fire-and-forget).
- **Fallback Mode**: If no proxy is configured, the server falls back to the default broadcast behavior.

#### Example: Chat Bot Integration

```javascript
// Chat bot that responds to messages
app.post('/websocket-events', async (req, res) => {
  const { event, socketId, data } = req.body;

  if (event === 'message' && data.text) {
    // Process message with AI or bot logic
    const botResponse = await processChatMessage(data.text);

    return res.json({
      message: {
        data: {
          text: botResponse,
          bot: true
        },
        timestamp: Date.now(),
        sender: 'bot'
      }
    });
  }

  res.json({});
});
```

### Server-Side Broadcasting

Integrate with your backend to broadcast messages:

```typescript
import { createSocketServer } from 'broadcast-socket-server';
import express from 'express';

// Create the socket server
const { io } = createSocketServer({
  port: 12000,
  corsOrigin: 'http://localhost:3000'
});

// Your main application
const app = express();

// Broadcast from your application logic
app.post('/api/notify-users', (req, res) => {
  const { userId, message } = req.body;

  // Send to user-specific channel
  io.to(`user-${userId}`).emit('message', {
    data: message,
    timestamp: Date.now(),
    sender: 'server'
  });

  res.json({ success: true });
});

app.listen(3000);
```

### Health Check

Monitor server status:

```javascript
fetch('http://localhost:12000/health')
  .then(res => res.json())
  .then(data => console.log(data));
// Output: { status: 'ok', timestamp: 1234567890 }
```

## CLI Options

```
Usage: broadcast-socket-server [options]

Options:
  -V, --version                 output the version number
  -p, --port <number>          Port to run the server on (default: "12000")
  -c, --cors-origin <string>   CORS origin (default: "http://localhost:5173")
  --proxy-url <string>         HTTP proxy endpoint URL for bi-directional event forwarding
  --proxy-token <string>       Bearer token for proxy authentication
  -h, --help                   display help for command
```

## API Reference

### `createSocketServer(config: ServerConfig)`

Creates and starts a new broadcast socket server.

**Parameters:**
- `config.port` (number): Port number for the server
- `config.corsOrigin` (string): Allowed CORS origin
- `config.proxy` (object, optional): HTTP proxy configuration
  - `config.proxy.url` (string): HTTP endpoint URL to forward WebSocket events
  - `config.proxy.bearerToken` (string, optional): Bearer token for authentication

**Returns:**
- `app`: Express application instance
- `httpServer`: HTTP server instance
- `io`: Socket.IO server instance

### Message Format

All messages follow this structure:

```typescript
interface ChannelMessage {
  data: any;              // Your message payload
  timestamp: number;      // Unix timestamp in milliseconds
  sender?: string;        // Socket ID or 'proxy'/'system'
}
```

## Use Cases

- **Real-time Notifications**: Push notifications to web/mobile clients
- **Live Updates**: Broadcast status updates, progress indicators
- **Chat Applications**: Simple channel-based chat systems
- **Dashboard Broadcasting**: Update multiple dashboard clients simultaneously
- **IoT Device Updates**: Broadcast commands or data to device groups
- **Collaborative Tools**: Synchronize state across multiple users

## License

MIT License - see [LICENSE](LICENSE) file for details
