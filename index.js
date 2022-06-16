/**
 * Shows how to restrict access using the HTTP Basic schema.
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Authentication
 * @see https://tools.ietf.org/html/rfc7617
 *
 * A user-id containing a colon (":") character is invalid, as the
 * first colon in a user-pass string separates user and password.
 */
const ADMIN_USER = "admin";
const ADMIN_PASS = await ADMIN_KV.get("pass");
// April 06 2022, the date this worker was created
const EPOCH = 1649217600000;
const SALT =
  "433889103174195811797780755069845129647994532343816442571266712185961340678261634656979592358647239141189876448717333068833648221006052783962147253499327657390954269437886255288170151255924520";

addEventListener("fetch", (event) => {
  event.respondWith(handleRequest(event));
});

function buf2hex(buffer) {
  // buffer is an ArrayBuffer
  return [...new Uint8Array(buffer)]
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
}

async function handleNameQuery(event, name) {
  const request = event.request;
  const ip = request.headers.get("CF-Connecting-IP");
  const textEncodedIp = new TextEncoder("utf-8").encode(ip + SALT);
  const hashedIp = await crypto.subtle.digest("SHA-256", textEncodedIp);
  // we subtract our EPOCH from the current timestamp to save some space
  // store data in the key format of `name|ip|timestamp`. this lets us filter by package+ip more easily.
  const key = `${name}|${buf2hex(hashedIp)}|${Date.now() - EPOCH}`;
  const value = JSON.stringify({
    "User-Agent": request.headers.get("User-Agent"),
    cf: request.cf,
  });
  VERSION_KV.put(key, value);

  // Construct the cache key from the cache URL
  const cacheKey = request.url.toString();
  const cache = caches.default;

  // Check whether the value is already available in the cache
  // if not, we need to fetch it from origin, and store it in the cache
  // for future access
  let response = await cache.match(cacheKey);

  if (!response) {
    console.log(
      `Response for request url: ${request.url} not present in cache. Fetching and caching request.`
    );
    try {
      const pkg = await fetch("https://registry.npmjs.org/" + name).then(
        (response) => response.json()
      );
      if (typeof pkg === "object" && "dist-tags" in pkg) {
        const distTags = pkg["dist-tags"];
        if (
          typeof distTags === "object" &&
          "latest" in distTags &&
          typeof distTags.latest === "string" &&
          distTags.latest !== ""
        ) {
          response = new Response(distTags.latest);

          // Cache API respects Cache-Control headers. Setting s-max-age to 300
          // will limit the response to be in cache for 300 seconds max
          // maxage is for users, s-maxage is for CDNs

          // Any changes made to the response here will be reflected in the cached value
          response.headers.append("Cache-Control", "max-age=300, s-maxage=300");

          // Store the fetched response as cacheKey
          // Use waitUntil so we return the response without blocking on
          // writing to cache
          event.waitUntil(cache.put(cacheKey, response.clone()));
        }
      }
    } catch (e) {
      console.error(e);
    }

    if (!response) {
      return new Response("500 Internal Server Error", {
        status: 500,
        statusText: "Internal Server Error",
      });
    }
  } else {
    console.log(`Cache hit for: ${request.url}.`);
  }
  return response;
}

async function handleKeyQuery(event, key) {
  const request = event.request;
  // The "Authorization" header is sent when authenticated.
  if (isAuthenticated(request)) {
    // Only returns this response when no exception is thrown.
    const value = await VERSION_KV.get(key);
    return new Response(value, {
      status: 200,
      headers: {
        // tell the browser it is json
        "Content-Type": "application/json",
        // don't ever store this because it is private infos
        "Cache-Control": "no-store",
      },
    });
  }

  // Not authenticated.
  return makeAuthenticationRequiredResponse();
}

async function handleKeysQuery(event) {
  const request = event.request;
  // The "Authorization" header is sent when authenticated.
  if (isAuthenticated(request)) {
    // Only returns this response when no exception is thrown.
    const value = await VERSION_KV.list();
    return new Response(JSON.stringify(value.keys), {
      status: 200,
      headers: {
        // compress the response using gzip
        "Content-Encoding": "gzip",
        // tell the browser it is json
        "Content-Type": "application/json",
        // don't ever store this because it is private infos
        "Cache-Control": "no-store",
      },
    });
  }

  // Not authenticated.
  return makeAuthenticationRequiredResponse();
}

async function handleDashboardQuery(event) {
  const request = event.request;
  // The "Authorization" header is sent when authenticated.
  if (isAuthenticated(request)) {
    // Only returns this response when no exception is thrown.
    let body = "";
    const value = await VERSION_KV.list();
    const keys = value.keys;
    let earliest = Infinity;
    let latest = -Infinity;
    const pkgs = {};
    keys.forEach(({ name: key }) => {
      const [name, ip, timestamp] = key.split("|");
      const pkg =
        pkgs[name] ||
        (pkgs[name] = {
          max: -Infinity,
          earliest: Infinity,
          latest: -Infinity,
        });
      const date = new Date(EPOCH + +timestamp);
      date.setHours(0, 0, 0, 0); // set to midnight UTC
      const pingsOnDay = pkg[+date] || (pkg[+date] = 0);
      pkg[+date]++;
      pkg["earliest"] = date < pkg["earliest"] ? +date : pkg["earliest"];
      pkg["latest"] = date > pkg["latest"] ? +date : pkg["latest"];
      pkg["max"] = date > pkg["max"] ? pkg[+date] : pkg["max"];
    });
    for (const name in pkgs) {
      const pkg = pkgs[name];
      const max = pkg["max"];
      const earliest = pkg["earliest"];
      const numDays =
        Math.round((pkg["latest"] - earliest) / (1000 * 60 * 60 * 24)) + 1;
      const rows = Array.from(Array(numDays)).map((_, i) => {
        const date = new Date(earliest).setDate(
          new Date(earliest).getDate() + i
        );
        const count = pkg[+date] || 0;
        const progress =
          "<progress value=" +
          count +
          " max=" +
          max +
          ">" +
          count +
          "</progress>";
        return (
          "<tr><td>" +
          new Date(date).toISOString().split("T")[0] +
          "</td><td>" +
          progress +
          "</td><td align=right>" +
          count +
          " </td><td>"
        );
      });
      body +=
        "<h2>" +
        name +
        "</h2><table><thead><tr><th>Date</th><th>Pings</th><th align=right>#</th></tr></thead><tbody>" +
        rows.join("") +
        "</tbody></table>";
    }

    return new Response(
      `<!doctype html>
 <html class="no-js" lang="">
 
 <head>
   <meta charset="utf-8">
   <title>User Dashboard</title>
 </head>
 <body>
 ${body}
 </body>
 </html>
 `,
      {
        status: 200,
        headers: {
          // compress the response using gzip
          "Content-Encoding": "gzip",
          // tell the browser it is json
          "Content-Type": "text/html",
          // don't ever store this because it is private infos
          "Cache-Control": "no-store",
        },
      }
    );
  }

  // Not authenticated.
  return makeAuthenticationRequiredResponse();
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

function isAuthenticated(request) {
  if (request.headers.has("Authorization")) {
    // Throws exception when authorization fails.
    const { user, pass } = basicAuthentication(request);
    verifyCredentials(user, pass);
    return true;
  }
  return false;
}

async function handleRequest(event) {
  const request = event.request;
  console.log(request.url);
  const knownPackages = ["ganache", "truffle"];
  const { searchParams } = new URL(request.url);
  const name = searchParams.get("name");
  if (name && knownPackages.includes(name)) {
    return await handleNameQuery(event, name);
  } else if (searchParams.get("dashboard") === "1") {
    return await handleDashboardQuery(event);
  } else if (searchParams.get("keys") === "1") {
    return await handleKeysQuery(event);
  } else if (searchParams.get("epoch") === "1") {
    return new Response(EPOCH, {
      // 31536000 is one year in seconds
      "Cache-Control": "max-age=31536000, s-maxage=31536000",
    });
  } else if (typeof searchParams.get("key") === "string") {
    return await handleKeyQuery(event, searchParams.get("key"));
  } else {
    return new Response("400 Bad Request", {
      status: 400,
      statusText: "Bad Request",
    });
  }
}

/**
 * Throws exception on verification failure.
 * @param {string} user
 * @param {string} pass
 * @throws {UnauthorizedException}
 */
function verifyCredentials(user, pass) {
  if (ADMIN_USER !== user) {
    throw new UnauthorizedException("Invalid username.");
  }

  if (ADMIN_PASS !== pass) {
    throw new UnauthorizedException("Invalid password.");
  }
}

/**
 * Parse HTTP Basic Authorization value.
 * @param {Request} request
 * @throws {BadRequestException}
 * @returns {{ user: string, pass: string }}
 */
function basicAuthentication(request) {
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
