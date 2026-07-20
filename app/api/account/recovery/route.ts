import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const resendApiKey = process.env.RESEND_API_KEY;
const recoveryEmailFrom = process.env.RECOVERY_EMAIL_FROM;
const accountEmailDomain = "j-tag-indol.vercel.app";
const genericSuccess = {
  message: "Se o ID estiver vinculado a uma família, o responsável receberá as instruções.",
};

type Membership = {
  household_id: string;
  role: "owner" | "member";
};

function isValidAccountId(value: string) {
  return /^[a-z0-9][a-z0-9._-]{2,30}[a-z0-9]$/.test(value);
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return entities[character];
  });
}

export async function POST(request: Request) {
  if (!supabaseUrl || !supabaseServiceRoleKey || !resendApiKey || !recoveryEmailFrom) {
    return NextResponse.json({ error: "Recuperação de acesso não configurada no servidor." }, { status: 503 });
  }

  const body = (await request.json().catch(() => ({}))) as { accountId?: string };
  const accountId = body.accountId?.trim().toLowerCase() ?? "";
  if (!isValidAccountId(accountId)) {
    return NextResponse.json({ error: "ID de acesso inválido." }, { status: 400 });
  }

  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: targetAccess } = await adminClient
    .from("account_access")
    .select("user_id")
    .eq("handle", accountId)
    .maybeSingle();
  if (!targetAccess?.user_id) {
    return NextResponse.json(genericSuccess);
  }

  const { data: memberships } = await adminClient
    .from("household_members")
    .select("household_id,role")
    .eq("user_id", targetAccess.user_id);
  const targetMemberships = (memberships ?? []) as Membership[];

  let ownerEmail = "";
  let householdName = "sua família";
  for (const membership of targetMemberships) {
    const { data: ownerMembership } = await adminClient
      .from("household_members")
      .select("user_id")
      .eq("household_id", membership.household_id)
      .eq("role", "owner")
      .maybeSingle();
    if (!ownerMembership?.user_id) {
      continue;
    }

    const { data: ownerAccess } = await adminClient
      .from("account_access")
      .select("recovery_email")
      .eq("user_id", ownerMembership.user_id)
      .maybeSingle();
    if (!ownerAccess?.recovery_email) {
      continue;
    }

    const { data: household } = await adminClient
      .from("households")
      .select("name")
      .eq("id", membership.household_id)
      .maybeSingle();
    ownerEmail = ownerAccess.recovery_email;
    householdName = household?.name || householdName;
    break;
  }

  if (!ownerEmail) {
    return NextResponse.json(genericSuccess);
  }

  const origin = new URL(request.url).origin;
  const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
    email: `${accountId}@${accountEmailDomain}`,
    options: { redirectTo: origin },
    type: "recovery",
  });
  if (linkError || !linkData.properties?.action_link) {
    console.error("Password recovery link generation failed", linkError);
    return NextResponse.json({ error: "Não foi possível preparar a recuperação agora." }, { status: 500 });
  }

  const emailResponse = await fetch("https://api.resend.com/emails", {
    body: JSON.stringify({
      from: recoveryEmailFrom,
      html: [
        `<p>Um administrador da família <strong>${escapeHtml(householdName)}</strong> pediu para recuperar o acesso.</p>`,
        `<p>ID da conta: <strong>${escapeHtml(accountId)}</strong></p>`,
        `<p><a href="${escapeHtml(linkData.properties.action_link)}">Criar uma nova senha</a></p>`,
        "<p>Se você não reconhece o pedido, ignore esta mensagem.</p>",
      ].join(""),
      subject: `Recuperação de acesso — ${householdName}`,
      to: [ownerEmail],
    }),
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  if (!emailResponse.ok) {
    console.error("Password recovery email failed", emailResponse.status, await emailResponse.text());
    return NextResponse.json({ error: "Não foi possível enviar o pedido agora." }, { status: 502 });
  }

  return NextResponse.json(genericSuccess);
}
