export async function keysRoute() {
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
