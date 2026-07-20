import { createHash, randomInt } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const accountEmailDomain = "j-tag-indol.vercel.app";
const genericSuccess = {
  message: "Se o ID estiver vinculado a uma família, o responsável verá o pedido.",
};

function isValidAccountId(value: string) {
  return /^[a-z0-9][a-z0-9._-]{2,30}[a-z0-9]$/.test(value);
}

function hashCode(requestId: string, code: string) {
  return createHash("sha256").update(`${requestId}:${code}`).digest("hex");
}

function getAdminClient() {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return null;
  }
  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function getAuthenticatedUser(request: Request) {
  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }
  const authorization = request.headers.get("authorization");
  const accessToken = authorization?.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!accessToken) {
    return null;
  }
  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data } = await authClient.auth.getUser(accessToken);
  return data.user ?? null;
}

export async function POST(request: Request) {
  const adminClient = getAdminClient();
  if (!adminClient) {
    return NextResponse.json({ error: "Recuperação temporariamente indisponível." }, { status: 503 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    action?: "request" | "complete";
    accountId?: string;
    code?: string;
    password?: string;
  };
  const accountId = body.accountId?.trim().toLowerCase() ?? "";
  if (!isValidAccountId(accountId)) {
    return NextResponse.json({ error: "ID de acesso inválido." }, { status: 400 });
  }

  const { data: targetAccess } = await adminClient
    .from("account_access")
    .select("user_id")
    .eq("handle", accountId)
    .maybeSingle();

  if (body.action === "complete") {
    if (!targetAccess?.user_id || !/^\d{6}$/.test(body.code ?? "") || (body.password?.length ?? 0) < 6) {
      return NextResponse.json({ error: "Código inválido ou expirado." }, { status: 400 });
    }
    const { data: recoveryRequest } = await adminClient
      .from("password_recovery_requests")
      .select("id,attempt_count,code_hash,expires_at")
      .eq("target_user_id", targetAccess.user_id)
      .eq("status", "approved")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!recoveryRequest) {
      return NextResponse.json({ error: "Código inválido ou expirado." }, { status: 400 });
    }
    if (hashCode(recoveryRequest.id, body.code ?? "") !== recoveryRequest.code_hash) {
      const attemptCount = (recoveryRequest.attempt_count ?? 0) + 1;
      await adminClient
        .from("password_recovery_requests")
        .update({
          attempt_count: attemptCount,
          code_hash: attemptCount >= 5 ? null : recoveryRequest.code_hash,
          status: attemptCount >= 5 ? "cancelled" : "approved",
          updated_at: new Date().toISOString(),
        })
        .eq("id", recoveryRequest.id);
      return NextResponse.json(
        { error: attemptCount >= 5 ? "Código bloqueado após muitas tentativas." : "Código inválido ou expirado." },
        { status: 400 },
      );
    }

    const { error: updateError } = await adminClient.auth.admin.updateUserById(targetAccess.user_id, {
      password: body.password,
    });
    if (updateError) {
      return NextResponse.json({ error: "Não foi possível alterar a senha agora." }, { status: 500 });
    }
    await adminClient
      .from("password_recovery_requests")
      .update({ code_hash: null, status: "completed", updated_at: new Date().toISOString() })
      .eq("id", recoveryRequest.id);
    return NextResponse.json({ message: "Senha alterada. Você já pode entrar." });
  }

  if (!targetAccess?.user_id) {
    return NextResponse.json(genericSuccess);
  }
  const { data: membership } = await adminClient
    .from("household_members")
    .select("household_id")
    .eq("user_id", targetAccess.user_id)
    .limit(1)
    .maybeSingle();
  if (!membership?.household_id) {
    return NextResponse.json(genericSuccess);
  }

  const { data: activeRequest } = await adminClient
    .from("password_recovery_requests")
    .select("id,status")
    .eq("target_user_id", targetAccess.user_id)
    .in("status", ["pending", "approved"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (activeRequest?.status === "pending") {
    return NextResponse.json(genericSuccess);
  }

  await adminClient
    .from("password_recovery_requests")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("target_user_id", targetAccess.user_id)
    .in("status", ["pending", "approved"]);
  const { error } = await adminClient.from("password_recovery_requests").insert({
    household_id: membership.household_id,
    target_user_id: targetAccess.user_id,
    status: "pending",
  });
  if (error) {
    console.error("Password recovery request failed", error);
    return NextResponse.json({ error: "Não foi possível criar o pedido agora." }, { status: 500 });
  }
  return NextResponse.json(genericSuccess);
}

export async function GET(request: Request) {
  const adminClient = getAdminClient();
  const user = await getAuthenticatedUser(request);
  if (!adminClient || !user) {
    return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
  }
  const { data: ownedHouseholds } = await adminClient
    .from("household_members")
    .select("household_id")
    .eq("user_id", user.id)
    .eq("role", "owner");
  const householdIds = (ownedHouseholds ?? []).map((item) => item.household_id);
  if (!householdIds.length) {
    return NextResponse.json({ requests: [] });
  }
  const { data: recoveryRequests, error } = await adminClient
    .from("password_recovery_requests")
    .select("id,household_id,target_user_id,status,created_at,expires_at")
    .in("household_id", householdIds)
    .in("status", ["pending", "approved"])
    .order("created_at", { ascending: false });
  if (error) {
    return NextResponse.json({ error: "Não foi possível carregar os pedidos." }, { status: 500 });
  }
  const userIds = [...new Set((recoveryRequests ?? []).map((item) => item.target_user_id))];
  const { data: accounts } = userIds.length
    ? await adminClient.from("account_access").select("user_id,handle").in("user_id", userIds)
    : { data: [] };
  const handles = new Map((accounts ?? []).map((account) => [account.user_id, account.handle]));
  return NextResponse.json({
    requests: (recoveryRequests ?? []).map((item) => ({
      ...item,
      accountId: handles.get(item.target_user_id) ?? "conta",
    })),
  });
}

export async function PATCH(request: Request) {
  const adminClient = getAdminClient();
  const user = await getAuthenticatedUser(request);
  if (!adminClient || !user) {
    return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as { requestId?: string };
  const { data: recoveryRequest } = await adminClient
    .from("password_recovery_requests")
    .select("id,household_id,status")
    .eq("id", body.requestId ?? "")
    .eq("status", "pending")
    .maybeSingle();
  if (!recoveryRequest) {
    return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
  }
  const { data: ownerMembership } = await adminClient
    .from("household_members")
    .select("user_id")
    .eq("household_id", recoveryRequest.household_id)
    .eq("user_id", user.id)
    .eq("role", "owner")
    .maybeSingle();
  if (!ownerMembership) {
    return NextResponse.json({ error: "Somente o dono da casa pode aprovar." }, { status: 403 });
  }

  const code = String(randomInt(100000, 1000000));
  const expiresAt = new Date(Date.now() + 15 * 60_000).toISOString();
  const { error } = await adminClient
    .from("password_recovery_requests")
    .update({
      approved_by_user_id: user.id,
      attempt_count: 0,
      code_hash: hashCode(recoveryRequest.id, code),
      expires_at: expiresAt,
      status: "approved",
      updated_at: new Date().toISOString(),
    })
    .eq("id", recoveryRequest.id);
  if (error) {
    return NextResponse.json({ error: "Não foi possível aprovar o pedido." }, { status: 500 });
  }
  return NextResponse.json({ code, expiresAt });
}
