import { json } from "@remix-run/node";
import db from "../db.server";

// POST /api/proxy/quiz-session — create session and save responses
export async function action({ request }) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  const body = await request.json();
  const { shop, quizId, visitorId, answers, completed } = body;

  if (!shop || !quizId || !visitorId) {
    return json({ error: "Missing required fields" }, { status: 400 });
  }

  // Create or update session
  let session = await db.quizSession.findFirst({
    where: { visitorId, quizId, completedAt: null },
  });

  if (!session) {
    session = await db.quizSession.create({
      data: {
        quizId,
        shop,
        visitorId,
      },
    });
  }

  // Save responses
  if (answers && answers.length > 0) {
    // Clear previous responses for this session
    await db.quizResponse.deleteMany({
      where: { quizSessionId: session.id },
    });

    // Save new responses
    await db.quizResponse.createMany({
      data: answers.map((answerId) => ({
        quizSessionId: session.id,
        answerId,
      })),
    });
  }

  // Mark as completed
  if (completed) {
    await db.quizSession.update({
      where: { id: session.id },
      data: { completedAt: new Date() },
    });
  }

  return json({ sessionId: session.id }, {
    headers: { "Access-Control-Allow-Origin": "*" },
  });
}

export async function loader({ request }) {
  return json(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
