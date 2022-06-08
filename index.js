addEventListener("fetch", (event) => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  return new Response("Did this PR automate the build?!", {
    headers: { "content-type": "text/plain" },
  });
}
