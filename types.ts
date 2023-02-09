export interface User {
    id: number;
    name: string;
    email: string;
    token: string;
    avatarUrl: string;
}

export interface Message {
    id: number;
    author: number;
    content: string;
    channel: number;
}

export interface Channel {
    id: number;
    name: string;
    messages: number[];
    participants: number[];
}

export type HTTPMethods = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS' | 'HEAD' | 'CONNECT' | 'TRACE';

export interface PublicUser {
    id: number;
    name: string;
    avatarUrl: string;
    email?: string;
}

export interface RequestBody {
    app?: string;
    content?: string;
    code?: string;
    name?: string;
    avatarUrl?: string;
    email?: string;
}