import { createClient } from "@/lib/supabase/server";
import { AuthUser } from "@/lib/auth/auth";

export interface AuditLogPayload {
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, any>;
}

export async function logAudit(user: AuthUser, payload: AuditLogPayload) {
  try {
    const supabase = await createClient();
    await supabase.from("audit_logs").insert({
      organization_id: user.organizationId,
      actor_id: user.profileId || user.id,
      actor_email: user.email,
      action: payload.action,
      entity_type: payload.entityType,
      entity_id: payload.entityId,
      metadata: payload.metadata || {},
    });
  } catch (err) {
    console.error("Gagal mencatat audit log:", err);
  }
}
