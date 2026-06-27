// OpenRouter OAuth (PKCE) — fully working (§6).
//
// No shared key: the key is minted in, and never leaves, the visitor's browser.
// Verifier lives in sessionStorage; the resulting key lives in localStorage.

const VERIFIER_KEY = 'stereo.or.verifier';
const KEY_KEY = 'stereo.or.key';
const AUTH_BASE = 'https://openrouter.ai/auth';
const KEYS_ENDPOINT = 'https://openrouter.ai/api/v1/auth/keys';

function base64url(bytes) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function randomVerifier() {
  const arr = new Uint8Array(64);
  crypto.getRandomValues(arr);
  return base64url(arr);
}

async function s256(verifier) {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64url(new Uint8Array(digest));
}

export function getStoredKey() {
  try {
    return localStorage.getItem(KEY_KEY);
  } catch {
    return null;
  }
}

export function isConnected() {
  return !!getStoredKey();
}

export function disconnect() {
  try {
    localStorage.removeItem(KEY_KEY);
    sessionStorage.removeItem(VERIFIER_KEY);
  } catch {
    /* storage may be unavailable */
  }
}

/**
 * Begin the PKCE flow: generate verifier + S256 challenge, stash the verifier,
 * and redirect to OpenRouter. `callbackUrl` defaults to the current page (the
 * GitHub Pages HTTPS URL — §6).
 */
export async function startLogin(callbackUrl) {
  const verifier = randomVerifier();
  const challenge = await s256(verifier);
  sessionStorage.setItem(VERIFIER_KEY, verifier);
  const cb = callbackUrl || window.location.href.split('?')[0].split('#')[0];
  const url =
    `${AUTH_BASE}?callback_url=${encodeURIComponent(cb)}` +
    `&code_challenge=${encodeURIComponent(challenge)}` +
    `&code_challenge_method=S256`;
  window.location.assign(url);
}

/**
 * If the URL carries a `?code=...` from OpenRouter, exchange it for a key.
 * Returns the key on success, null if there was no code to handle.
 * Throws with a clear message on 400/403/405 etc. (§6).
 */
export async function handleRedirect() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  if (!code) return null;

  const verifier = sessionStorage.getItem(VERIFIER_KEY);
  // Always clean the URL so a refresh can't re-trigger the exchange.
  cleanUrl();

  if (!verifier) {
    throw new Error(
      'Auth code received but no PKCE verifier was found in this session. ' +
      'Please start the connection again.'
    );
  }

  let res;
  try {
    res = await fetch(KEYS_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code,
        code_verifier: verifier,
        code_challenge_method: 'S256',
      }),
    });
  } catch (err) {
    throw new Error(`Network error contacting OpenRouter: ${err.message}`);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const hint =
      res.status === 400 ? 'Invalid or expired authorization code.' :
      res.status === 403 ? 'Authorization was rejected.' :
      res.status === 405 ? 'Auth endpoint method not allowed.' :
      `Unexpected error (HTTP ${res.status}).`;
    throw new Error(`Could not complete OpenRouter sign-in: ${hint} ${text}`.trim());
  }

  const data = await res.json();
  const key = data.key;
  if (!key) throw new Error('OpenRouter returned no key.');
  try {
    localStorage.setItem(KEY_KEY, key);
    sessionStorage.removeItem(VERIFIER_KEY);
  } catch {
    /* ignore storage failure; key still returned for this session */
  }
  return key;
}

function cleanUrl() {
  const url = new URL(window.location.href);
  url.searchParams.delete('code');
  window.history.replaceState({}, document.title, url.toString());
}
