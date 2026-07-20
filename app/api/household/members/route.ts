import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function DELETE(request: Request) {
  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return NextResponse.json({ error: "Administração de membros indisponível." }, { status: 503 });
  }
  const authorization = request.headers.get("authorization");
  const accessToken = authorization?.startsWith("Bearer ") ? authorization.slice(7) : "";
  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: userData } = await authClient.auth.getUser(accessToken);
  if (!userData.user) {
    return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { residentId?: string };
  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: resident } = await adminClient
    .from("residents")
    .select("id,household_id,auth_user_id")
    .eq("id", body.residentId ?? "")
    .maybeSingle();
  if (!resident) {
    return NextResponse.json({ error: "Perfil não encontrado." }, { status: 404 });
  }
  const { data: ownerMembership } = await adminClient
    .from("household_members")
    .select("user_id")
    .eq("household_id", resident.household_id)
    .eq("user_id", userData.user.id)
    .eq("role", "owner")
    .maybeSingle();
  if (!ownerMembership) {
    return NextResponse.json({ error: "Somente o dono pode remover moradores." }, { status: 403 });
  }
  const { data: household } = await adminClient
    .from("households")
    .select("owner_resident_id")
    .eq("id", resident.household_id)
    .maybeSingle();
  if (household?.owner_resident_id === resident.id) {
    return NextResponse.json({ error: "O perfil do dono não pode ser removido." }, { status: 400 });
  }

  if (resident.auth_user_id) {
    const { error: membershipError } = await adminClient
      .from("household_members")
      .delete()
      .eq("household_id", resident.household_id)
      .eq("user_id", resident.auth_user_id)
      .eq("role", "member");
    if (membershipError) {
      return NextResponse.json({ error: "Não foi possível revogar o acesso." }, { status: 500 });
    }
  }
  const { error: residentError } = await adminClient.from("residents").delete().eq("id", resident.id);
  if (residentError) {
    return NextResponse.json({ error: "O acesso foi revogado, mas o perfil não pôde ser removido." }, { status: 500 });
  }
  return NextResponse.json({ removed: true });
}
