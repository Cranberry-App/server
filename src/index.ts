// Module imports
import { config, Database, Application, oakCors } from '../deps.ts';
import * as types from './types.ts'
import { generateToken, exchangeGitHubCode } from './functions.ts';

// Database initializations
const userDB = new Database<types.User>('db/users.json');

// Variable declarations
const port = parseInt(Deno.env.get('PORT') || config.port);

// Server initializations
const app = new Application();

// Middleware
app.use(oakCors());

app.use(ctx => {
    console.log(`${Date.now()}: ${ctx.request.method} ${ctx.request.url.href}`);
});

app.use(async ctx => {
    // Define request variables
    const
        endpoint: string = ctx.request.url.pathname,
        method: types.HTTPMethods = ctx.request.method,
        searchParams: URLSearchParams = new URLSearchParams(ctx.request.url.searchParams),
        headers: Headers = ctx.request.headers,
        body: string = await ctx.request.body().value;
    switch (`${method} ${endpoint}`) {
        case 'GET /oauth': {
            ctx.response.status = 302;
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
                    // Redirect to the frontend with an error
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
        } case 'PATCH /user': {
            const token: string = headers.get('Authorization') || '';
            if (!await userDB.findOne({ token: token })) {
                ctx.response.status = 401;
                ctx.response.body = JSON.stringify({ error: 'Unauthorized' });
                return;
            }
            const bodyObject = JSON.parse(body);
            if (!bodyObject.name || !bodyObject.avatarUrl) {
                ctx.response.status = 400;
                ctx.response.body = JSON.stringify({ error: 'Missing or invalid name or avatarUrl' });
                return;
            }
            // Check if a user that is not the user sending the request already has the same name
            const sameNameUser = await userDB.findOne({ name: bodyObject.name });
            if (sameNameUser && sameNameUser.token !== token) {
                ctx.response.status = 409;
                ctx.response.body = JSON.stringify({ error: 'Name already taken' });
                return;
            }
            userDB.updateOne({ token: token }, {
                avatarUrl: bodyObject.avatarUrl,
                name: bodyObject.name
            });
            ctx.response.status = 200;
            // @ts-ignore User can't be null
            const user: types.User = await userDB.findOne({ token: token });
            ctx.response.body = JSON.stringify({
                id: user.id,
                name: user.name,
                avatarUrl: user.avatarUrl,
                email: user.email
            });
            break;
        } default: {
            ctx.response.status = 404;
            ctx.response.body = 'Not found';
        }
    } 
});

// Server start
await app.listen({ port });

