import {
  app,
  type HttpRequest,
  type HttpResponseInit,
  type InvocationContext,
} from "@azure/functions";
import { authenticate, deleteIdentity } from "./auth.js";
import { ApiError } from "./service.js";
import { transaction } from "./store.js";
export async function handler(
  req: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  const headers = {
    "Cache-Control": "no-store",
    "Content-Type": "application/json",
    "X-Content-Type-Options": "nosniff",
  };
  try {
    const subject = await authenticate(req.headers.get("authorization"));
    const path = req.params.path || "me",
      method = req.method;
    let body: Record<string, unknown> = {};
    if (["POST", "PUT"].includes(method)) {
      const raw = await req.text();
      if (raw.length > 12000)
        throw new ApiError(413, "This detail is too long.");
      try {
        body = JSON.parse(raw);
        if (!body || typeof body !== "object" || Array.isArray(body))
          throw new Error();
      } catch {
        throw new ApiError(400, "Send a valid JSON object.");
      }
    }
    if (path === "me" && method === "DELETE") {
      if (
        !process.env.AUTH0_MANAGEMENT_CLIENT_ID ||
        !process.env.AUTH0_MANAGEMENT_CLIENT_SECRET
      )
        throw new ApiError(
          503,
          "Account deletion needs server configuration. Please contact the app owner.",
        );
      await transaction((s) => s.deleteAccount(subject));
      try {
        await deleteIdentity(subject);
      } catch {
        throw new ApiError(
          503,
          "Your Usfolio data has been removed. Identity deletion is still pending. Press Delete account again to retry, or contact the app owner.",
        );
      }
      return { status: 200, headers, jsonBody: { deleted: true } };
    }
    const result = await transaction((s) => {
      if (path === "me" && method === "GET") return s.snapshot(subject);
      if (path === "me" && method === "PUT") s.profile(subject, body);
      else if (path === "invitations" && method === "POST")
        return s.invite(subject);
      else if (path === "invitations" && method === "DELETE") s.revoke(subject);
      else if (path === "invitations/accept" && method === "POST")
        s.accept(subject, body.code);
      else if (path === "partnership" && method === "DELETE")
        s.disconnect(subject);
      else if (path === "details" && method === "POST")
        s.detail(subject, String(body.ownerId), body);
      else if (/^details\/[^/]+$/.test(path) && method === "PUT")
        s.detail(subject, String(body.ownerId), body, path.split("/")[1]);
      else if (/^details\/[^/]+$/.test(path) && method === "DELETE")
        s.deleteDetail(subject, path.split("/")[1]);
      else throw new ApiError(404, "Not found.");
      return s.snapshot(subject);
    });
    return { status: 200, headers, jsonBody: result };
  } catch (error) {
    const known = error instanceof ApiError;
    if (!known)
      context.error(
        "Usfolio request failed",
        error instanceof Error ? error.name : "UnknownError",
      );
    return {
      status: known ? error.status : 500,
      headers,
      jsonBody: {
        error: known
          ? error.message
          : "Something went wrong. Please try again.",
      },
    };
  }
}
app.http("usfolio", {
  methods: ["GET", "POST", "PUT", "DELETE"],
  authLevel: "anonymous",
  route: "{*path}",
  handler,
});
