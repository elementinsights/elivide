import { json } from "@remix-run/node";
import db from "../db.server";

// POST /api/proxy/analytics — track quiz events from storefront
export async function action({ request }) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  const body = await request.json();
  const { shop, sessionId, eventType, productId, productTitle, metadata } = body;

  if (!shop || !eventType) {
    return json({ error: "Missing required fields" }, { status: 400 });
  }

  const validEvents = ["view", "start", "complete", "add_to_cart"];
  if (!validEvents.includes(eventType)) {
    return json({ error: "Invalid event type" }, { status: 400 });
  }

  await db.analyticsEvent.create({
    data: {
      shop,
      quizSessionId: sessionId || null,
      eventType,
      productId: productId || null,
      productTitle: productTitle || null,
      metadata: metadata ? JSON.stringify(metadata) : null,
    },
  });

  return json({ success: true }, {
    headers: { "Access-Control-Allow-Origin": "*" },
  });
}

// Handle CORS preflight
export async function loader({ request }) {
  return json(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
