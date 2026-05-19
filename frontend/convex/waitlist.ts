import { v } from "convex/values";
import { mutation, query, action } from "./_generated/server";

// ---------------------------------------------------------------------------
// Mutation: add an email to the waitlist
// ---------------------------------------------------------------------------
export const join = mutation({
  args: {
    email: v.string(),
    turnstileToken: v.string(),
  },
  handler: async (ctx, { email }) => {
    const normalised = email.trim().toLowerCase();

    // Check if already on waitlist
    const existing = await ctx.db
      .query("waitlist")
      .withIndex("by_email", (q) => q.eq("email", normalised))
      .first();

    if (existing) {
      return { success: true, alreadyJoined: true };
    }

    await ctx.db.insert("waitlist", {
      email: normalised,
      joinedAt: Date.now(),
    });

    return { success: true, alreadyJoined: false };
  },
});

// ---------------------------------------------------------------------------
// Query: get total waitlist count (for social proof)
// ---------------------------------------------------------------------------
export const getCount = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("waitlist").collect();
    return all.length;
  },
});

// ---------------------------------------------------------------------------
// Action: send confirmation email via Resend
// ---------------------------------------------------------------------------
export const sendConfirmationEmail = action({
  args: { email: v.string() },
  handler: async (_ctx, { email }) => {
    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      console.warn("RESEND_API_KEY not set — skipping confirmation email");
      return { sent: false };
    }

    const fromAddress = process.env.RESEND_FROM_EMAIL ?? "Predensity <hello@predensity.com>";

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromAddress,
        to: [email],
        subject: "You're on the Predensity waitlist!",
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px; background: #0a0a0a; color: #ffffff;">
            <div style="text-align: center; margin-bottom: 32px;">
              <h1 style="font-size: 24px; font-weight: 700; margin: 0 0 8px;">Welcome to Predensity</h1>
              <div style="width: 40px; height: 3px; background: #c8ff00; margin: 0 auto;"></div>
            </div>
            <p style="color: #a0a0a0; font-size: 15px; line-height: 1.6; margin-bottom: 24px;">
              You've secured your spot on the waitlist. We'll notify you as soon as Predensity launches.
            </p>
            <p style="color: #a0a0a0; font-size: 15px; line-height: 1.6; margin-bottom: 24px;">
              <strong style="color: #ffffff;">The prediction market that doesn't care if you're right or wrong.</strong> Monetize your boldness.
            </p>
            <div style="text-align: center; margin: 32px 0;">
              <a href="https://predensity.com" style="display: inline-block; padding: 12px 32px; background: #c8ff00; color: #000000; font-weight: 600; text-decoration: none; border-radius: 8px; font-size: 14px;">Visit Predensity</a>
            </div>
            <hr style="border: none; border-top: 1px solid #222; margin: 32px 0;" />
            <p style="color: #666; font-size: 12px; text-align: center;">
              &copy; ${new Date().getFullYear()} Predensity. All rights reserved.
            </p>
          </div>
        `,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("Resend error:", err);
      return { sent: false, error: err };
    }

    return { sent: true };
  },
});
