import { createClient } from "@/lib/supabase/server";
import type { AccountRole } from "@/types/database";

export type CurrentProfile = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: AccountRole;
  client_id: string | null;
  approved: boolean;
  is_active: boolean;
  rejected_at: string | null;
};

export type AccountStatus = "pending" | "approved" | "rejected" | "disabled";

export function getAccountStatus(profile: Pick<CurrentProfile, "approved" | "is_active" | "rejected_at">): AccountStatus {
  if (!profile.is_active) return "disabled";
  if (profile.rejected_at) return "rejected";
  return profile.approved ? "approved" : "pending";
}

export async function getCurrentProfile() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return null;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id,full_name,email,role,client_id,approved,is_active,rejected_at")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile) return null;
  return {
    user,
    profile: profile as CurrentProfile,
    supabase
  };
}
