export async function authenticateRoute(request, route) {
  if (requestIncludesAuthHeader(request)) {
    const { user, pass } = getCredentialsFromRequest(request);
    // throws exception on failure
    console.log(user);
    console.log(pass);
    await verifyRequestCredentials(user, pass);
    return route;
  }
  return makeAuthenticationRequiredResponse();
}

function requestIncludesAuthHeader(request) {
  return request.headers.has("Authorization");
}

/**
 * Parse HTTP Basic Authorization value.
 * @param {Request} request
 * @throws {BadRequestException}
 * @returns {{ user: string, pass: string }}
 */
function getCredentialsFromRequest(request) {
  const Authorization = request.headers.get("Authorization");

  const [scheme, encoded] = Authorization.split(" ");

  // The Authorization header must start with Basic, followed by a space.
  if (!encoded || scheme !== "Basic") {
    throw new BadRequestException("Malformed authorization header.");
  }

  // Decodes the base64 value and performs unicode normalization.
  // @see https://datatracker.ietf.org/doc/html/rfc7613#section-3.3.2 (and #section-4.2.2)
  // @see https://dev.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String/normalize
  const buffer = Uint8Array.from(atob(encoded), (character) =>
    character.charCodeAt(0)
  );
  const decoded = new TextDecoder().decode(buffer).normalize();

  // The username & password are split by the first colon.
  //=> example: "username:password"
  const index = decoded.indexOf(":");

  // The user & password are split by the first colon and MUST NOT contain control characters.
  // @see https://tools.ietf.org/html/rfc5234#appendix-B.1 (=> "CTL = %x00-1F / %x7F")
  if (index === -1 || /[\0-\x1F\x7F]/.test(decoded)) {
    throw new BadRequestException("Invalid authorization value.");
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
    throw new UnauthorizedException("Invalid username.");
  }

  if (ADMIN_PASS !== pass) {
    throw new UnauthorizedException("Invalid password.");
  }
}

function makeAuthenticationRequiredResponse() {
  return new Response("You need to login.", {
    status: 401,
    headers: {
      // Prompts the user for credentials.
      "WWW-Authenticate": 'Basic realm="my scope", charset="UTF-8"',
    },
  });
}

function UnauthorizedException(reason) {
  this.status = 401;
  this.statusText = "Unauthorized";
  this.reason = reason;
}

function BadRequestException(reason) {
  this.status = 400;
  this.statusText = "Bad Request";
  this.reason = reason;
}
