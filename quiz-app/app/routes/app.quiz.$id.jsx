import { useState } from "react";
import { useLoaderData, useSubmit, useNavigation, useNavigate } from "@remix-run/react";
import { json, redirect } from "@remix-run/node";
import {
  Page,
  Layout,
  Card,
  Text,
  BlockStack,
  InlineStack,
  TextField,
  Button,
  Badge,
  Divider,
  Box,
  Select,
  Banner,
  FormLayout,
  Checkbox,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const loader = async ({ request, params }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const quizId = params.id;

  console.log("QUIZ LOADER — shop:", shop, "quizId:", quizId);
  const quiz = await db.quiz.findFirst({
    where: { id: quizId, shop },
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
    throw new Response("Quiz not found", { status: 404 });
  }

  return json({ quiz, shop });
};

export const action = async ({ request, params }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const quizId = params.id;
  const formData = await request.formData();
  const actionType = formData.get("actionType");

  if (actionType === "saveQuiz") {
    const data = JSON.parse(formData.get("quizData"));

    // Update quiz
    await db.quiz.update({
      where: { id: quizId },
      data: {
        title: data.title,
        subtitle: data.subtitle,
        introTitle: data.introTitle,
        introBody: data.introBody,
        imageUrl: data.imageUrl,
        active: data.active ?? false,
      },
    });

    // Save products
    if (data.products) {
      await db.quizProduct.deleteMany({ where: { quizId } });

      for (let i = 0; i < data.products.length; i++) {
        const p = data.products[i];
        await db.quizProduct.create({
          data: {
            quizId,
            shopifyProductId: p.shopifyProductId || "",
            title: p.title,
            imageUrl: p.imageUrl || "",
            price: p.price || "",
            handle: p.handle || "",
            order: i,
          },
        });
      }
    }

    // Reload products for question saving
    const products = await db.quizProduct.findMany({
      where: { quizId },
      orderBy: { order: "asc" },
    });

    // Save questions
    if (data.questions) {
      await db.question.deleteMany({ where: { quizId } });

      for (let qi = 0; qi < data.questions.length; qi++) {
        const q = data.questions[qi];
        const question = await db.question.create({
          data: {
            quizId,
            order: qi + 1,
            title: q.title,
            subtitle: q.subtitle || "",
          },
        });

        if (q.answers) {
          for (let ai = 0; ai < q.answers.length; ai++) {
            const a = q.answers[ai];
            const answer = await db.answer.create({
              data: {
                questionId: question.id,
                order: ai + 1,
                text: a.text,
              },
            });

            if (a.points) {
              for (const pt of a.points) {
                const product = products[pt.productIndex];
                if (product) {
                  await db.answerPoint.create({
                    data: {
                      answerId: answer.id,
                      quizProductId: product.id,
                      points: pt.points || 0,
                    },
                  });
                }
              }
            }
          }
        }
      }
    }

    return json({ success: true });
  }

  return json({ error: "Unknown action" }, { status: 400 });
};

export default function QuizEditor() {
  const { quiz } = useLoaderData();

  return (
    <Page title={quiz?.title || "Quiz"}>
      <Card>
        <Text as="p">Quiz ID: {quiz?.id}</Text>
        <Text as="p">Title: {quiz?.title}</Text>
        <Text as="p">Questions: {quiz?.questions?.length || 0}</Text>
        <Text as="p">Products: {quiz?.products?.length || 0}</Text>
      </Card>
    </Page>
  );
}
