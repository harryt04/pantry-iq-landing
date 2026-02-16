import { NextRequest, NextResponse } from "next/server";
import { PostHog } from "posthog-node";

export async function POST(request: NextRequest) {
  try {
    const posthog = new PostHog(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
      host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    });
    const { email } = await request.json();

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 },
      );
    }

    // Forward to the external API
    posthog.capture({
      distinctId: email,
      event: "launch-signup",
    });
    await posthog.shutdown();
    await fetch("https://harryt.dev/api/user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        usesApps: ["pantryiq"],
        status: "activeCustomer",
      }),
    }).catch(() => {
      // Ignore errors from external call as specified
    });

    return NextResponse.json(
      { message: "Successfully subscribed!" },
      { status: 200 },
    );
  } catch {
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 },
    );
  }
}
