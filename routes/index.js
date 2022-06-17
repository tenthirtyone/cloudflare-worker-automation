import { authenticateRoute } from "./middleware";
import { packageVersionRoute } from "./public";
import { dashboardRoute, keysRoute, keyRoute, epochRoute } from "./private";

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
    return await authenticateRoute(request, await dashboardRoute());
  } else if (pathname === "/keys") {
    return await authenticateRoute(request, await keysRoute());
  } else if (pathname === "/key") {
    return await authenticateRoute(request, await keyRoute(event));
  } else if (pathname === "/epoch") {
    return await authenticateRoute(request, await epochRoute());
  }

  return new Response("400 Bad Request", {
    status: 400,
    statusText: "Bad Request",
  });
}
