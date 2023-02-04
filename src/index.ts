// Module imports
import { Database, Application, oakCors } from '../deps.ts';
import * as types from './types.ts'
import { generateToken } from './functions.ts';

// Database initializations
const userDB = new Database<types.User>('db/users.json');

// File imports
const config = JSON.parse(await Deno.readTextFile('./config.json'));

// Variable declarations
const port = parseInt(Deno.env.get('PORT') || config.port);

// Server initializations
const app = new Application();

// Middleware
app.use(oakCors());

app.use(async ctx => {
    // Define request variables
    const
        endpoint: string = ctx.request.url.pathname,
        method: types.HTTPMethods = ctx.request.method,
        searchParams: URLSearchParams = new URLSearchParams(ctx.request.url.searchParams),
        headers: Headers = ctx.request.headers;

    switch (`${method} ${endpoint}`) {
        case 'GET /oauth': {
            switch (searchParams.get('app')) {
                case 'github': {
                    const code = searchParams.get('code') || '';
                    // Exchange the OAuth code for a Bearer token
                    const accessToken = await exchangeGitHubCode(code);
                    if (!accessToken) {
                        ctx.response.redirect(`${config.frontendUrl}/login.html?error=invalid_code`);
                    }
                    // Get the user's GitHub profile infos
                    const response = await fetch('https://api.github.com/user', {
                        method: 'GET',
                        headers: {
                            'Accept': 'application/json',
                            'Authorization': `Bearer ${accessToken}`
                        }
                    });
                    const userData = await response.json();

                    const user = await userDB.findOne({ email: userData.email });
                    if (user) {
                        ctx.response.redirect(`${config.frontendUrl}/welcome.html?token=${user.token}`);
                        return;
                    }

                    const token = generateToken([userData.email, userData.login, userData.id.toString(), userData.avatar_url]);

                    await userDB.insertOne({
                        id: await userDB.count() + 1,
                        email: userData.email,
                        name: userData.login,
                        token: token,
                        avatarUrl: `https://source.boringavatars.com/bauhaus/128/${userData.login}`
                    });
                    
                    ctx.response.redirect(`${config.frontendUrl}/welcome.html?token=${token}`);
                    break;
                } default: {
                    ctx.response.redirect(`${config.frontendUrl}/login.html?error=invalid_app`);
                }
            }
            break;
        } case 'GET /user': {
            let id: string | number | null = searchParams.get('id');
            const token: string = headers.get('Authorization') || '';
            if (!id) {
                ctx.response.status = 400;
                ctx.response.body = JSON.stringify({ error: 'Missing or invalid id' });
                return;
            }
            if (!await userDB.findOne({token: token })) {
                ctx.response.status = 401;
                ctx.response.body = JSON.stringify({ error: 'Unauthorized' });
                return;
            }
            let me = false;
            if (id === 'me') {
                // @ts-ignore ID cannot be null
                id = (await userDB.findOne({token: token })).id.toString();
                me = true;
            }
            // @ts-ignore User cannot be null
            const user: types.User = await userDB.findOne({ id: parseInt(id) });

            const userObject: types.PublicUser = {
                id: user.id,
                name: user.name,
                avatarUrl: user.avatarUrl
            }
            if (me) userObject.email = user.email;

            ctx.response.status = 200;
            ctx.response.body = JSON.stringify(userObject);
            break;
        } default: {
            ctx.response.status = 404;
            ctx.response.body = 'Not found';
        }
    } 
});

// Server start
await app.listen({ port });

async function exchangeGitHubCode(code: string): Promise<string | null> {
    const url = new URL('https://github.com/login/oauth/access_token');
    const params = new URLSearchParams();
    params.append('client_id', config.oauthApps.github.clientId);
    params.append('client_secret', config.oauthApps.github.clientSecret);
    params.append('redirect_uri', config.oauthApps.github.redirectUri);
    params.append('code', code);

    url.search = params.toString();

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Accept': 'application/json'
        }
    });
    const data = await response.json();

    return data.access_token || null;
}