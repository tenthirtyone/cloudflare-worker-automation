addEventListener("fetch", (event) => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  return new Response("Hello worker again!", {
    headers: { "content-type": "text/plain" },
  });
}
