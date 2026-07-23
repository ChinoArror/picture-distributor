import http from "node:http";
import { renderDashboardPage, renderLandingPage } from "../worker/homepage5.js";

const port = Number(process.env.PORT || 8791);

const classes = [
  { id: "class-10a", name: "Class 10A Graduation", is_open: true, photo_count: 120, created_at: "2025-05-21T14:35:00Z" },
  { id: "grade-5-room-101", name: "Grade 5 - Room 101", is_open: true, photo_count: 1248, created_at: "2025-04-24T09:00:00Z" },
  { id: "kindergarten-room-2", name: "Kindergarten - Room 2", is_open: true, photo_count: 956, created_at: "2025-04-22T09:00:00Z" },
  { id: "grade-3-room-305", name: "Grade 3 - Room 305", is_open: true, photo_count: 1102, created_at: "2025-04-18T09:00:00Z" },
  { id: "grade-4-room-204", name: "Grade 4 - Room 204", is_open: false, photo_count: 1350, created_at: "2025-04-16T09:00:00Z" },
  { id: "grade-2-room-202", name: "Grade 2 - Room 202", is_open: true, photo_count: 890, created_at: "2025-04-14T09:00:00Z" },
];

const photos = Array.from({ length: 24 }, (_, index) => ({
  id: `preview-photo-${index + 1}`,
  name: `IMG_${String(487 + index).padStart(4, "0")}.JPG`,
  className: "Advanced Photography 101",
  match: Math.max(87, 98 - index),
}));

function json(res, body, status = 200) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(JSON.stringify(body));
}

function html(res, body) {
  res.writeHead(200, {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(body);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url || "/", `http://127.0.0.1:${port}`);
  if (url.pathname === "/") return html(res, renderLandingPage());
  if (url.pathname === "/user") return html(res, renderDashboardPage("user"));
  if (url.pathname === "/admin") return html(res, renderDashboardPage("admin"));

  if (url.pathname === "/api/me") {
    const referer = req.headers.referer || "";
    const isAdmin = referer.includes("/admin");
    return json(res, { user: { id: "preview-user", name: isAdmin ? "Alex Admin" : "Emma Chen", kind: "preview" } });
  }
  if (url.pathname === "/api/auth/temp") return json(res, { user: { id: "guest", name: "Guest", kind: "temp" } });
  if (url.pathname === "/api/auth/logout") return json(res, { ok: true });
  if (url.pathname === "/api/auth/login-url") return json(res, { url: url.searchParams.get("next") || "/" });
  if (url.pathname === "/api/classes") return json(res, { classes });
  if (/^\/api\/classes\/[^/]+\/photos$/.test(url.pathname)) return json(res, { photos });
  if (url.pathname === "/api/search") return json(res, { taskId: "preview-task" });
  if (url.pathname === "/api/status/preview-task") return json(res, { status: "completed", results: photos });

  if (req.method === "POST" || req.method === "PATCH" || req.method === "DELETE") return json(res, { ok: true });
  json(res, { error: "Not found" }, 404);
});

server.listen(port, "127.0.0.1", () => {
  console.log(`SnapClass UI preview running at http://127.0.0.1:${port}/`);
});
