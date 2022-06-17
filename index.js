import { buf2hex } from "./util";
import { EPOCH, SALT } from "./constants";
import { requestRouter } from "./routes";

addEventListener("fetch", (event) => {
  event.respondWith(requestRouter(event));
});

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
