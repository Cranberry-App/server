import { Sha256, config } from "../deps.ts";

export function shuffle(array: string[]): string[] {
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

export function generateToken(values: string[]): string {
    let tokenArray: string[]|string = [];

    for (const value of values) {
        tokenArray.push(value);
        tokenArray.push(Math.floor(Math.random() * (Math.random() * 100)).toString());
    }

    tokenArray = shuffle(tokenArray);
    tokenArray = tokenArray.join('');

    return new Sha256().update(tokenArray).toString();
}

export async function exchangeGitHubCode(code: string): Promise<string | null> {
    const url = new URL("https://github.com/login/oauth/access_token");
    const params = new URLSearchParams();
    params.append("client_id", config.oauthApps.github.clientId);
    params.append("client_secret", config.oauthApps.github.clientSecret);
    params.append("redirect_uri", config.oauthApps.github.redirectUri);
    params.append("code", code);

    url.search = params.toString();

    const response = await fetch(url, {
        method: "POST",
        headers: {
            Accept: "application/json",
        },
    });
    const data = await response.json();

    return data.access_token || null;
}