/**
 * Mock OAuth callback server for e2e tests.
 * This server listens on port 3001 and handles OAuth redirect callbacks.
 * It simply displays the received query parameters (code, state, error, etc.)
 */

const server = Bun.serve({
  port: 3001,
  fetch(req) {
    const url = new URL(req.url);

    if (url.pathname === "/callback") {
      const params = Object.fromEntries(url.searchParams.entries());

      // Return an HTML page showing the callback parameters
      const html = `
<!DOCTYPE html>
<html>
<head>
  <title>OAuth Callback</title>
</head>
<body>
  <h1>OAuth Callback Received</h1>
  <pre>${JSON.stringify(params, null, 2)}</pre>
</body>
</html>`;

      return new Response(html, {
        headers: { "Content-Type": "text/html" },
      });
    }

    // Health check endpoint
    if (url.pathname === "/health") {
      return new Response("OK", { status: 200 });
    }

    return new Response("Not Found", { status: 404 });
  },
});

console.log(`Mock OAuth callback server running on http://localhost:${server.port}`);
