import { authenticateRequest } from "./middleware";
import { packageVersionRoute } from "./public";
import { dashboardRoute, keysRoute, keyRoute, epochRoute } from "./private";
import { RESPONSE_BAD_REQUEST } from "../constants";

export async function requestRouter(request) {
  const { pathname } = new URL(request.url);

  if (pathname === "/version") {
    return await packageVersionRoute(request);
  } else if (pathname === "/dashboard") {
    return await authenticateRequest(request, await dashboardRoute());
  } else if (pathname === "/keys") {
    return await authenticateRequest(request, await keysRoute());
  } else if (pathname === "/key") {
    return await authenticateRequest(request, await keyRoute(request));
  } else if (pathname === "/epoch") {
    return await authenticateRequest(request, await epochRoute());
  }

  return new Response("400 Bad Request", RESPONSE_BAD_REQUEST);
}
