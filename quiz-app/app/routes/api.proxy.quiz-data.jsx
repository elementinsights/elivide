import { json } from "@remix-run/node";
import db from "../db.server";

// GET /api/proxy/quiz-data — returns quiz config for storefront
export async function loader({ request }) {
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");
  const quizId = url.searchParams.get("quizId");

  if (!shop) {
    return json({ error: "Missing shop" }, { status: 400 });
  }

  const where = quizId
    ? { id: quizId, shop, active: true }
    : { shop, active: true };

  const quiz = await db.quiz.findFirst({
    where,
    orderBy: { updatedAt: "desc" },
    include: {
      questions: {
        orderBy: { order: "asc" },
        include: {
          answers: {
            orderBy: { order: "asc" },
            include: {
              points: {
                include: { quizProduct: true },
              },
            },
          },
        },
      },
      products: {
        orderBy: { order: "asc" },
      },
    },
  });

  if (!quiz) {
    return json({ error: "No active quiz found" }, { status: 404 });
  }

  const data = {
    id: quiz.id,
    title: quiz.title,
    subtitle: quiz.subtitle,
    introTitle: quiz.introTitle,
    introSubtitle: quiz.introSubtitle,
    introBody: quiz.introBody,
    resultsTitle: quiz.resultsTitle,
    resultsSubtitle: quiz.resultsSubtitle,
    imageUrl: quiz.imageUrl,
    questions: quiz.questions.map((q) => ({
      id: q.id,
      order: q.order,
      title: q.title,
      subtitle: q.subtitle,
      answers: q.answers.map((a) => ({
        id: a.id,
        order: a.order,
        text: a.text,
        points: a.points.map((p) => ({
          productId: p.quizProductId,
          points: p.points,
        })),
      })),
    })),
    products: quiz.products.map((p) => ({
      id: p.id,
      shopifyProductId: p.shopifyProductId,
      title: p.title,
      imageUrl: p.imageUrl,
      price: p.price,
      handle: p.handle,
      tooltipHtml: p.tooltipHtml || "",
    })),
  };

  return json(data, {
    headers: {
      "Access-Control-Allow-Origin": "*",
    },
  });
}
