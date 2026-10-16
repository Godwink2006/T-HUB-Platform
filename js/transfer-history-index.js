window.getStudentTransferHistoryIndex = async function (client = window.supabaseClient) {
  if (!client) throw new Error("Database client is unavailable.");
  if (window.studentTransferHistoryIndex) return window.studentTransferHistoryIndex;

  const { data, error } = await client.rpc("get_my_transfer_history");
  if (error) throw error;

  const { data: { user }, error: userError } = await client.auth.getUser();
  if (userError || !user) throw userError || new Error("Sign in to view school records.");
  const { data: profile, error: profileError } = await client
    .from("profiles")
    .select("school_id")
    .eq("id", user.id)
    .single();
  if (profileError) throw profileError;
  if (!profile?.school_id) throw new Error("Your student profile is not linked to a school.");

  const index = {
    transfers: Array.isArray(data) ? data : [],
    currentSchoolId: profile?.school_id ? String(profile.school_id).toLowerCase() : null,
    recordIds: {
      attendance: new Set(),
      grade: new Set(),
      fee: new Set(),
      payment: new Set(),
    },
  };

  for (const transfer of index.transfers) {
    if (String(transfer.source_school_id || "").toLowerCase() === index.currentSchoolId) continue;
    for (const record of Array.isArray(transfer.records) ? transfer.records : []) {
      const type = String(record.record_type || "").toLowerCase();
      const id = record.record_snapshot?.id || record.source_record_id;
      if (index.recordIds[type] && id != null) {
        index.recordIds[type].add(String(id));
      }
    }
  }

  window.studentTransferHistoryIndex = index;
  return index;
};
