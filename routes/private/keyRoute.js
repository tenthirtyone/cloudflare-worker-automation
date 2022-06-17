export async function keyRoute(event) {
  const request = event.request;
  const { searchParams } = new URL(request.url);
  const key = searchParams.get("key");

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
