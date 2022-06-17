import {
  RESPONSE_BASIC_LOGIN,
  EXCEPTION_UNAUTHORIZED,
  EXCEPTION_BAD_REQUEST,
  RESPONSE_AUTH_ERROR,
} from "../../constants";

export async function authenticateRequest(request, route) {
  if (requestIncludesAuthHeader(request)) {
    try {
      const { user, pass } = getCredentialsFromRequest(request);
      await verifyRequestCredentials(user, pass);
      return route;
    } catch (e) {
      return new Response("Authentication Error", RESPONSE_AUTH_ERROR);
    }
  }
  return makeAuthenticationRequiredResponse();
}

function requestIncludesAuthHeader(request) {
  return request.headers.has("Authorization");
}

function getCredentialsFromRequest(request) {
  const encoded = getEncodedCredentials(request.headers.get("Authorization"));

  const decoded = decodeEncodedCredentials(encoded);
  const { user, pass } = validateAndParseCredentials(decoded);

  return {
    user,
    pass,
  };
}

function getEncodedCredentials(header) {
  const authenticationScheme = "Basic";
  const [scheme, encoded] = header.split(" ");

  if (!encoded || scheme !== authenticationScheme) {
    throw new EXCEPTION_BAD_REQUEST("Malformed authorization header.");
  }

  return encoded;
}

function decodeEncodedCredentials(encoded) {
  const buffer = Uint8Array.from(atob(encoded), (character) =>
    character.charCodeAt(0)
  );
  return new TextDecoder().decode(buffer).normalize();
}

function validateAndParseCredentials(decoded) {
  const index = decoded.indexOf(":");

  if (index === -1 || /[\0-\x1F\x7F]/.test(decoded)) {
    throw new EXCEPTION_BAD_REQUEST("Invalid authorization value.");
  }
  return {
    user: decoded.substring(0, index),
    pass: decoded.substring(index + 1),
  };
}

async function verifyRequestCredentials(user, pass) {
  const ADMIN_USER = await ADMIN_KV.get("user");
  const ADMIN_PASS = await ADMIN_KV.get("pass");

  if (ADMIN_USER !== user) {
    throw new EXCEPTION_UNAUTHORIZED("Invalid username.");
  }

  if (ADMIN_PASS !== pass) {
    throw new EXCEPTION_UNAUTHORIZED("Invalid password.");
  }
}

function makeAuthenticationRequiredResponse() {
  return new Response("You need to login.", RESPONSE_BASIC_LOGIN);
}
