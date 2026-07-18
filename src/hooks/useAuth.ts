import { useAppSelector } from "@/app/hooks";

export function useAuth() {
  const { user, accessToken } = useAppSelector((s) => s.auth);
  return {
    user,
    isAuthenticated: Boolean(accessToken && user),
    role: user?.role,
  };
}
