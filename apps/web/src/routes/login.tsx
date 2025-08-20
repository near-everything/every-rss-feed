import SignInForm from "@/components/sign-in-form";
import { createFileRoute } from "@tanstack/react-router";
import z from "zod";

const searchSchema = z.object({
  redirect: z.string().optional(),
});

export const Route = createFileRoute("/login")({
  component: RouteComponent,
  validateSearch: searchSchema,
});

function RouteComponent() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8">
      <div className="w-full">
        <SignInForm />
      </div>
    </div>
  );
}
