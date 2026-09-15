import { redirect } from "next/navigation";

// proxy.ts already bounces signed-out visitors to /login.
export default function Home() {
  redirect("/dashboard");
}
