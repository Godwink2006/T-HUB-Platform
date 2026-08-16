const SUPABASE_URL = "https://xlwrdsrjdgzfqpbigphv.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhsd3Jkc3JqZGd6ZnFwYmlncGh2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU2ODkyMjIsImV4cCI6MjEwMTI2NTIyMn0.53HUz-sMEdBLpH4OehUA0_50r0wgEmo-pYgDnTMzYbY";

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
);

window.supabaseClient = supabaseClient;