export interface ProxyConfig {
    url: string;
    bearerToken?: string;
}
export interface ServerConfig {
    port: number;
    corsOrigin: string;
    proxy?: ProxyConfig;
}
export interface ChannelMessage {
    data: any;
    timestamp: number;
    sender?: string;
}
export interface ProxyEventPayload {
    event: "connection" | "message" | "disconnect";
    channel: string;
    socketId: string;
    timestamp: number;
    data?: any;
}
export interface ProxyEventResponse {
    message?: ChannelMessage;
    messages?: ChannelMessage[];
}
