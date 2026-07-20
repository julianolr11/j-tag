import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function getAdminClient() {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return null;
  }
  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function getUser(request: Request) {
  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }
  const authorization = request.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!token) {
    return null;
  }
  const client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data } = await client.auth.getUser(token);
  return data.user ?? null;
}

export async function POST(request: Request) {
  const adminClient = getAdminClient();
  const user = await getUser(request);
  if (!adminClient || !user) {
    return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as { code?: string };
  const code = body.code?.trim().toUpperCase().replace(/[^A-Z0-9]/g, "") ?? "";
  if (code.length < 4) {
    return NextResponse.json({ error: "Código da casa inválido." }, { status: 400 });
  }
  const { data: household } = await adminClient
    .from("households")
    .select("id,name,code")
    .eq("code", code)
    .maybeSingle();
  if (!household) {
    return NextResponse.json({ error: "Código da casa não encontrado." }, { status: 404 });
  }
  const { data: membership } = await adminClient
    .from("household_members")
    .select("household_id")
    .eq("household_id", household.id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (membership) {
    return NextResponse.json({ household, status: "approved" });
  }
  const { data: existing } = await adminClient
    .from("household_join_requests")
    .select("id,status")
    .eq("household_id", household.id)
    .eq("requester_user_id", user.id)
    .in("status", ["pending", "approved"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing) {
    if (existing.status === "approved") {
      const { error: membershipError } = await adminClient.from("household_members").upsert(
        { household_id: household.id, role: "member", user_id: user.id },
        { onConflict: "household_id,user_id" },
      );
      if (membershipError) {
        return NextResponse.json({ error: "Não foi possível liberar o acesso." }, { status: 500 });
      }
    }
    return NextResponse.json({ household: { id: household.id, name: household.name }, requestId: existing.id, status: existing.status });
  }
  const { data: created, error } = await adminClient
    .from("household_join_requests")
    .insert({ household_id: household.id, requester_user_id: user.id, status: "pending" })
    .select("id")
    .single();
  if (error) {
    return NextResponse.json({ error: "Não foi possível enviar a solicitação." }, { status: 500 });
  }
  return NextResponse.json({
    household: { id: household.id, name: household.name },
    requestId: created.id,
    status: "pending",
  });
}

export async function GET(request: Request) {
  const adminClient = getAdminClient();
  const user = await getUser(request);
  if (!adminClient || !user) {
    return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
  }
  const { data: ownRequests } = await adminClient
    .from("household_join_requests")
    .select("id,household_id,status,created_at,updated_at")
    .eq("requester_user_id", user.id)
    .in("status", ["pending", "approved"])
    .order("created_at", { ascending: false });
  const { data: owned } = await adminClient
    .from("household_members")
    .select("household_id")
    .eq("user_id", user.id)
    .eq("role", "owner");
  const ownedIds = (owned ?? []).map((item) => item.household_id);
  const { data: incoming } = ownedIds.length
    ? await adminClient
        .from("household_join_requests")
        .select("id,household_id,requester_user_id,status,created_at")
        .in("household_id", ownedIds)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
    : { data: [] };
  const requesterIds = [...new Set((incoming ?? []).map((item) => item.requester_user_id))];
  const { data: accounts } = requesterIds.length
    ? await adminClient.from("account_access").select("user_id,handle").in("user_id", requesterIds)
    : { data: [] };
  const handles = new Map((accounts ?? []).map((account) => [account.user_id, account.handle]));
  return NextResponse.json({
    incoming: (incoming ?? []).map((item) => ({ ...item, accountId: handles.get(item.requester_user_id) ?? "conta" })),
    own: ownRequests ?? [],
  });
}

export async function PATCH(request: Request) {
  const adminClient = getAdminClient();
  const user = await getUser(request);
  if (!adminClient || !user) {
    return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as { requestId?: string; approve?: boolean };
  const { data: joinRequest } = await adminClient
    .from("household_join_requests")
    .select("id,household_id,requester_user_id,status")
    .eq("id", body.requestId ?? "")
    .eq("status", "pending")
    .maybeSingle();
  if (!joinRequest) {
    return NextResponse.json({ error: "Solicitação não encontrada." }, { status: 404 });
  }
  const { data: owner } = await adminClient
    .from("household_members")
    .select("user_id")
    .eq("household_id", joinRequest.household_id)
    .eq("user_id", user.id)
    .eq("role", "owner")
    .maybeSingle();
  if (!owner) {
    return NextResponse.json({ error: "Somente o dono da casa pode responder." }, { status: 403 });
  }
  await adminClient
    .from("household_join_requests")
    .update({
      decided_by_user_id: user.id,
      status: body.approve ? "approved" : "rejected",
      updated_at: new Date().toISOString(),
    })
    .eq("id", joinRequest.id);
  return NextResponse.json({ status: body.approve ? "approved" : "rejected" });
}
