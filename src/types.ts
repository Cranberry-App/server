export interface User {
    id: number;
    name: string;
    email: string;
    token: string;
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