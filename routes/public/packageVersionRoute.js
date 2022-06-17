import { buf2hex } from "../../util";
import {
  EPOCH,
  SALT,
  RESPONSE_BAD_REQUEST,
  RESPONSE_CACHE_300,
  RESPONSE_INTERNAL_SERVER_ERROR,
} from "../../constants";

export async function packageVersionRoute(request) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get("name");
  const knownPackages = ["ganache", "truffle"];

  if (knownPackages.indexOf(name) === -1) {
    return new Response("400 Bad Request", RESPONSE_BAD_REQUEST);
  }

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
          response = new Response(distTags.latest, RESPONSE_CACHE_300);

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
      return new Response(
        "500 Internal Server Error",
        RESPONSE_INTERNAL_SERVER_ERROR
      );
    }
  } else {
    console.log(`Cache hit for: ${request.url}.`);
  }
  return response;
}
