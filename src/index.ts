// Module imports
import { Database } from 'https://deno.land/x/aloedb@0.9.0/mod.ts'
import { serve } from "https://deno.land/std@0.175.0/http/server.ts";
import { Sha256 } from "https://deno.land/std@0.119.0/hash/sha256.ts";
import { User, Message, Channel } from './types.ts'

// Database imports
const userDB = new Database<User>('db/users.json');
const _messageDB = new Database<Message>('db/messages.json');
const _channelDB = new Database<Channel>('db/channels.json');

// File imports
const config = JSON.parse(Deno.readTextFileSync('./config.json'));

// Variable declarations
// @ts-expect-error: PORT is either not defined or a number
const PORT = parseInt(Deno.env.get('PORT')) || 3000;

// HTTP Request Handler
const handler = (request: Request): Response => {
    const url = new URL(request.url);
    switch (url.pathname) {
        // deno-lint-ignore no-case-declarations
        case '/oauth':
            // @ts-expect-error: Tbh, idk why this is an error
            const {message, code} = oauthToEmail(url.searchParams.get('app'), url.searchParams.get('code'));
            return new Response(message, { status: code });
    }
    return new Response('Not Found', { status: 404 });
}

// Run the HTTP Server
await serve(handler, { port: PORT });

function oauthToEmail(app: string, code: string) {
    switch (app) {
        case 'github':
            return handleGitHubOauth(code);
        default:
            return {message: 'Invalid app', code: 400};
    }
}

async function handleGitHubOauth(code: string) {
    const params  = new URLSearchParams();
        params.append('client_id', config.oauthApps.github.clientId);
        params.append('client_secret', config.oauthApps.github.clientSecret);
        params.append('redirect_uri', config.oauthApps.github.redirectUri);
        params.append('code', code);
        const url = new URL('https://github.com/login/oauth/access_token');
        url.search = params.toString();
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Accept': 'application/json'
            }
        });
        const data = await response.json();

        const userResponse = await fetch('https://api.github.com/user', {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Authorization': `Bearer ${data.access_token}`
            }
        });
        const userData = await userResponse.json();
        
        if (await userDB.findOne({ email: userData.email })) {
            return {message: 'User already exists', code: 409}
        }

        const token = generateToken([userData.email, userData.login, userData.id.toString(), userData.avatar_url]);

        await userDB.insertOne({
            id: await userDB.count() + 1,
            email: userData.email,
            name: userData.login,
            token: token
        });

        return {message: 'OK', code: 200}
}

function shuffle(array: string[]): string[] {
    let currentIndex = array.length,  randomIndex;

    // While there remain elements to shuffle.
    while (currentIndex != 0) {

        // Pick a remaining element.
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;

        // And swap it with the current element.
        [array[currentIndex], array[randomIndex]] = [
        array[randomIndex], array[currentIndex]];
    }

    return array;
}

function generateToken(values: string[]): string {
    let tokenArray: string[]|string = [];

    for (const value of values) {
        tokenArray.push(value);
        tokenArray.push(Math.floor(Math.random() * (Math.random() * 100)).toString());
    }

    tokenArray = shuffle(tokenArray);
    tokenArray = tokenArray.join('');

    return new Sha256().update(tokenArray).toString();
}