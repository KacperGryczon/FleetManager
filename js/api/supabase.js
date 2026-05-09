const { createClient } = supabase;

const supabaseUrl = "https://ljgaynalrpmhqagqucdb.supabase.co";
const supabaseKey = "sb_publishable_fI4hiqkxxSqxFp0gx9E7OA_GCKQPwPt";

export const client = createClient(supabaseUrl, supabaseKey);
