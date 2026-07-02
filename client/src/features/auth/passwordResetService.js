import { supabase } from "../../services/supabase";

export const requestPasswordReset = async (email) => {
  const trimmedEmail = String(email || "").trim().toLowerCase();

  if (!trimmedEmail) {
    throw new Error("Email is required.");
  }

  const redirectTo =
    typeof window !== "undefined"
      ? `${window.location.origin}/access`
      : undefined;

  const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
    redirectTo,
  });

  if (error) {
    throw new Error(
      "We could not process the request at this time. Please try again or contact the system administrator.",
    );
  }

  return {
    message:
      "If an account is associated with this email, password reset instructions will be sent.",
  };
};
