import { NextRequest, NextResponse } from "next/server";

const sessionCookie = "taskflow_session";
const noStore = { "Cache-Control": "no-store" };

function failure(status: number, detail: string) {
  return NextResponse.json({ detail }, { status, headers: noStore });
}

function emptyResponse() {
  return new NextResponse(null, { status: 204, headers: noStore });
}

async function handle(request: NextRequest, context: RouteContext<"/api/[...path]">) {
  const { path } = await context.params;
  const endpoint = path.join("/");
  const { method } = request;
  const isLogin = method === "POST" && endpoint === "auth/login";
  const isRegister = method === "POST" && endpoint === "auth/register";
  const isLogout = method === "POST" && endpoint === "auth/logout";
  const isProfile = method === "GET" && endpoint === "auth/me";
  const isTaskCollection = endpoint === "tasks" && ["GET", "POST"].includes(method);
  const isTask = /^tasks\/[1-9][0-9]*$/.test(endpoint) && ["GET", "PUT", "DELETE"].includes(method);

  const isProjectCollection = endpoint === "projects" && ["GET", "POST"].includes(method);
  const isProject = /^projects\/[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(endpoint)
    && ["PUT", "DELETE"].includes(method);
  const allowed = isLogin || isRegister || isLogout || isProfile
    || isTaskCollection || isTask || isProjectCollection || isProject;
  if (!allowed) {
    return failure(404, "Rota não encontrada.");
  }
  if (method !== "GET" && request.headers.get("origin") !== request.nextUrl.origin) {
    return failure(403, "Origem do pedido inválida.");
  }

  const cookieOptions = {
    httpOnly: true,
    sameSite: "strict" as const,
    secure: request.nextUrl.protocol === "https:",
    path: "/",
  };

  if (isLogout) {
    const response = emptyResponse();
    response.cookies.set(sessionCookie, "", { ...cookieOptions, maxAge: 0 });
    return response;
  }

  const headers = new Headers();
  if (!(isLogin || isRegister)) {
    const token = request.cookies.get(sessionCookie)?.value;
    if (!token) return failure(401, "Inicia sessão para continuar.");
    headers.set("Authorization", `Bearer ${token}`);
  }
  const hasBody = method === "POST" || method === "PUT";
  if (hasBody) {
    headers.set("Content-Type", request.headers.get("content-type") ?? "application/json");
  }

  const apiUrl = (
    process.env.TASKFLOW_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"
  ).replace(/\/+$/, "");
  let upstream: Response;
  try {
    const url = new URL(`${apiUrl}/${endpoint}`);
    const projectId = request.nextUrl.searchParams.get("project_id");
    if (isTaskCollection && method === "GET" && projectId !== null) {
      url.searchParams.set("project_id", projectId);
    }
    upstream = await fetch(url, {
      method,
      headers,
      body: hasBody ? await request.text() : undefined,
      cache: "no-store",
      redirect: "error",
      signal: request.signal,
    });
  } catch {
    return failure(502, "Não foi possível contactar a API.");
  }

  if (isLogin && upstream.ok) {
    const data = await upstream.json().catch(() => null);
    if (typeof data?.access_token !== "string") {
      return failure(502, "A API devolveu uma resposta inválida.");
    }
    const response = emptyResponse();
    response.cookies.set(sessionCookie, data.access_token, { ...cookieOptions, maxAge: 30 * 60 });
    return response;
  }

  const responseHeaders = new Headers(noStore);
  const contentType = upstream.headers.get("content-type");
  if (contentType) responseHeaders.set("Content-Type", contentType);
  return new NextResponse(upstream.body, { status: upstream.status, headers: responseHeaders });
}

export { handle as GET, handle as POST, handle as PUT, handle as DELETE };
