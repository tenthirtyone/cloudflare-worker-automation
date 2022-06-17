import { authenticateRoute } from "./middleware";
import { packageVersionRoute } from "./public";
import { dashboardRoute } from "./private";
const knownPackages = ["ganache", "truffle"];

export async function requestRouter(event) {
  const request = event.request;

  const { pathname } = new URL(request.url);
  /*
  const dashboard = searchParams.get("dashboard");
  const key = searchParams.get("key");
  const keys = searchParams.get("keys");
  const epoch = searchParams.get("epoch");
*/
  console.log(pathname);

  if (pathname === "/version") {
    return await packageVersionRoute(event);
  } else if (pathname === "/dashboard") {
    return authenticateRoute(request, await dashboardRoute(event));
  }

  /*else if (dashboard && isAuthenticated(request)) {
    ;
  } else if (keys && isAuthenticated(request)) {
    return await handleKeysQuery(event);
  } else if (epoch && isAuthenticated(request)) {
    return new Response(EPOCH, {
      // 31536000 is one year in seconds
      "Cache-Control": "max-age=31536000, s-maxage=31536000",
    });
  } else if (typeof key === "string") {
    return await handleKeyQuery(event, key);
  } else {
    
  }
*/
  return new Response("400 Bad Request", {
    status: 400,
    statusText: "Bad Request",
  });
}
