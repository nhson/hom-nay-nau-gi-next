import { Suspense } from "react";
import { LoginScreen } from "@/components/admin/login-screen";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginScreen />
    </Suspense>
  );
}
