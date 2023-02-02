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
const handler = async (request: Request): Promise<Response> => {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response('OK', { status: 200, headers: {'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization'} });
    switch (url.pathname) {
        // deno-lint-ignore no-case-declarations
        case '/oauth':
            const {code, message}: {code: number, message?:string} = oauthToEmail(url.searchParams.get('app'), url.searchParams.get('code'));
            //return new Response(message, { status: code, headers: {'Access-Control-Allow-Origin': '*' } });
            console.log(code + ' ' + message)
            switch (code) {
                case 200:
                    return Response.redirect(`${config.frontend}/welcome.html?token=${message}`, 302);
                case 409:
                    return Response.redirect(`${config.frontend}/index.html`, 302);
                default:
                    return Response.redirect(`${config.frontend}/login.html`, 302)
            };
        // deno-lint-ignore no-case-declarations
        case '/user':
            let id: string|number|null = url.searchParams.get('id');
            const token: string = request.headers.get('Authorization') || '';
            if (!id) return new Response('Invalid request', { status: 400, headers: {'Access-Control-Allow-Origin': '*' } });
            if (!await userDB.findOne({token: token })) return new Response('Invalid token', { status: 401, headers: {'Access-Control-Allow-Origin': '*' } });
            let me = false;
            if (id === 'me') {
                // @ts-ignore: Id cannot be null
                id = (await userDB.findOne({token: token })).id.toString();
                me = true;
            }
            id = parseInt(id as string);

            const user = await userDB.findOne({id: id});

            const userObject = {
                // @ts-expect-error: id is either null or a string
                id: user.id,
                // @ts-expect-error: id is either null or a string
                name: user.name,
                // @ts-expect-error: id is either null or a string
                avatarUrl: user.avatarUrl
            }

            if (me) {
                // @ts-expect-error: id is either null or a string
                userObject.email = user.email;
            }

            return new Response(JSON.stringify(userObject), { status: 200, headers: {'Access-Control-Allow-Origin': '*' } });
    }
    return new Response('Not Found', { status: 404, headers: {'Access-Control-Allow-Origin': '*' } });
}

// Run the HTTP Server
await serve(handler, { port: PORT });

function oauthToEmail(app: string, code: string) {
    switch (app) {
        case 'github':
            return handleGitHubOauth(code);
        default:
            return {code: 400};
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
            return {code: 409};
        }

        const token = generateToken([userData.email, userData.login, userData.id.toString(), userData.avatar_url]);

        await userDB.insertOne({
            id: await userDB.count() + 1,
            email: userData.email,
            name: userData.login,
            token: token,
            avatarUrl: `https://source.boringavatars.com/bauhaus/128/${userData.login}`
        });

        return {code: 200, message: token};
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