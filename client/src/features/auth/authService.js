import { supabase } from "../../services/supabase";

export async function signInWithGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: "http://localhost:5173",
    },
  });

  return { data, error };
}

export async function signOutUser() {
  return await supabase.auth.signOut();
}
