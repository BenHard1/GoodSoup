export type ActionState = {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
};

export const initialActionState: ActionState = { status: "idle" };

export const fail = (message: string, fieldErrors?: ActionState["fieldErrors"]): ActionState => ({
  status: "error",
  message,
  fieldErrors,
});

export const ok = (message?: string): ActionState => ({ status: "success", message });
