const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
};

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: JSON_HEADERS,
  });
}

function getSupabaseConfig(env) {
  const url = String(env.SUPABASE_URL || "").replace(/\/$/, "");
  const key = String(env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY || "");

  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY/SUPABASE_SECRET_KEY");
  }

  return { url, key };
}

function getAdminToken(request) {
  const headerToken = request.headers.get("x-admin-token") || "";
  const authHeader = request.headers.get("authorization") || "";
  if (authHeader.toLowerCase().startsWith("bearer ")) {
    return authHeader.slice(7).trim();
  }
  return headerToken.trim();
}

function requireAdmin(request, env) {
  const expectedToken = String(env.ADMIN_TOKEN || "").trim();
  if (!expectedToken) {
    return json({ error: "Missing ADMIN_TOKEN" }, 500);
  }

  if (getAdminToken(request) !== expectedToken) {
    return json({ error: "Unauthorized" }, 401);
  }

  return null;
}

async function parseBody(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

async function supabaseRequest(env, path, options = {}) {
  const { url, key } = getSupabaseConfig(env);
  const response = await fetch(`${url}${path}`, {
    ...options,
    headers: {
      apikey: key,
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `Supabase error ${response.status}`);
  }

  if (response.status === 204) return null;
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

function mapInvite(row) {
  return {
    id: row.id,
    name: row.name,
    url: row.url,
    createdAt: row.created_at,
  };
}

export async function onRequestOptions() {
  return new Response(null, { status: 204 });
}

export async function onRequestGet({ request, env }) {
  const adminError = requireAdmin(request, env);
  if (adminError) return adminError;

  try {
    const rows = await supabaseRequest(
      env,
      "/rest/v1/invites?select=id,name,url,created_at&order=created_at.desc"
    );
    return json((rows || []).map(mapInvite));
  } catch (error) {
    return json({ error: error.message }, 500);
  }
}

export async function onRequestPost({ request, env }) {
  const adminError = requireAdmin(request, env);
  if (adminError) return adminError;

  try {
    const body = await parseBody(request);
    const name = String(body.name || "").trim();
    const url = String(body.url || "").trim();

    if (!name || !url) {
      return json({ error: "Missing invite name or URL" }, 400);
    }

    const rows = await supabaseRequest(env, "/rest/v1/invites", {
      method: "POST",
      headers: { prefer: "return=representation" },
      body: JSON.stringify({ name, url }),
    });

    return json(mapInvite(rows[0]), 201);
  } catch (error) {
    return json({ error: error.message }, 500);
  }
}

export async function onRequestDelete({ request, env }) {
  const adminError = requireAdmin(request, env);
  if (adminError) return adminError;

  try {
    await supabaseRequest(env, "/rest/v1/invites?id=not.is.null", {
      method: "DELETE",
      headers: { prefer: "return=minimal" },
    });
    return json([]);
  } catch (error) {
    return json({ error: error.message }, 500);
  }
}
