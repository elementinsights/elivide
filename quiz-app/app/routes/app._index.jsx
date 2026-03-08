import { useState } from "react";
import { useLoaderData, useSubmit, useNavigation, useSearchParams } from "@remix-run/react";
import { json } from "@remix-run/node";
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
  EmptyState,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const loader = async ({ request }) => {
  const { session, admin } = await authenticate.admin(request);
  const shop = session.shop;

  const url = new URL(request.url);
  const editId = url.searchParams.get("edit");

  // Always load quiz list
  const quizzes = await db.quiz.findMany({
    where: { shop },
    include: {
      questions: { select: { id: true } },
      products: { select: { id: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // If editing, load full quiz data
  let editQuiz = null;
  if (editId) {
    editQuiz = await db.quiz.findFirst({
      where: { id: editId, shop },
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
  }

  // Fetch store products from Shopify for the product picker
  let shopProducts = [];
  try {
    const response = await admin.graphql(
      `#graphql
        query {
          products(first: 100) {
            edges {
              node {
                id
                title
                handle
                featuredImage {
                  url
                }
                variants(first: 1) {
                  edges {
                    node {
                      price
                    }
                  }
                }
              }
            }
          }
        }
      `
    );
    const { data } = await response.json();
    shopProducts = (data?.products?.edges || []).map(({ node }) => ({
      shopifyProductId: node.id,
      title: node.title,
      handle: node.handle,
      imageUrl: node.featuredImage?.url || "",
      price: node.variants.edges[0]?.node?.price
        ? `£${parseFloat(node.variants.edges[0].node.price).toFixed(2)}`
        : "",
    }));
  } catch (e) {
    console.error("Failed to fetch shop products:", e);
  }

  return json({ quizzes, editQuiz, shop, shopProducts });
};

export const action = async ({ request }) => {
  const { session, admin } = await authenticate.admin(request);
  const shop = session.shop;
  const formData = await request.formData();
  const actionType = formData.get("actionType");

  if (actionType === "create") {
    const quiz = await db.quiz.create({
      data: {
        shop,
        title: "New Quiz",
        subtitle: "",
        active: false,
      },
    });
    return json({ created: quiz.id });
  }

  if (actionType === "delete") {
    const quizId = formData.get("quizId");
    await db.quiz.delete({ where: { id: quizId } });
    return json({ deleted: true });
  }

  if (actionType === "toggleActive") {
    const quizId = formData.get("quizId");
    const quiz = await db.quiz.findUnique({ where: { id: quizId } });
    if (quiz) {
      await db.quiz.update({
        where: { id: quizId },
        data: { active: !quiz.active },
      });
    }
    return json({ toggled: true });
  }

  if (actionType === "saveQuiz") {
    const quizId = formData.get("quizId");
    const data = JSON.parse(formData.get("quizData"));

    await db.quiz.update({
      where: { id: quizId },
      data: {
        title: data.title,
        subtitle: data.subtitle,
        introTitle: data.introTitle,
        introSubtitle: data.introSubtitle,
        introBody: data.introBody,
        resultsTitle: data.resultsTitle,
        resultsSubtitle: data.resultsSubtitle,
        imageUrl: data.imageUrl,
        active: data.active ?? false,
      },
    });

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
            tooltipHtml: p.tooltipHtml || "",
            order: i,
          },
        });
      }
    }

    const products = await db.quizProduct.findMany({
      where: { quizId },
      orderBy: { order: "asc" },
    });

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

// ─── Quiz List View ───
function QuizList({ quizzes, onEdit, onDelete, onToggle, onCreate, isSubmitting }) {
  return (
    <Page>
      <TitleBar title="Quizzes">
        <button variant="primary" onClick={onCreate} disabled={isSubmitting}>
          Create Quiz
        </button>
      </TitleBar>

      <BlockStack gap="500">
        {quizzes.length === 0 ? (
          <Card>
            <EmptyState
              heading="Create your first quiz"
              action={{ content: "Create Quiz", onAction: onCreate }}
              image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
            >
              <p>Build product recommendation quizzes to help customers find the right product.</p>
            </EmptyState>
          </Card>
        ) : (
          <BlockStack gap="300">
            {quizzes.map((quiz) => {
              const questionCount = quiz.questions.length;
              const productCount = quiz.products.length;

              return (
                <Card key={quiz.id}>
                  <InlineStack align="space-between" blockAlign="center" wrap={false}>
                    <BlockStack gap="100">
                      <InlineStack gap="200" blockAlign="center">
                        <Text variant="bodyMd" fontWeight="bold">{quiz.title}</Text>
                        <Badge tone={quiz.active ? "success" : "default"}>
                          {quiz.active ? "Active" : "Draft"}
                        </Badge>
                      </InlineStack>
                      <Text variant="bodySm" tone="subdued">
                        {questionCount} question{questionCount !== 1 ? "s" : ""} &middot;{" "}
                        {productCount} product{productCount !== 1 ? "s" : ""}
                      </Text>
                    </BlockStack>
                    <InlineStack gap="200">
                      <Button size="slim" onClick={() => onEdit(quiz.id)}>Edit</Button>
                      <Button size="slim" onClick={() => onToggle(quiz.id)}>
                        {quiz.active ? "Deactivate" : "Activate"}
                      </Button>
                      <Button size="slim" tone="critical" variant="plain" onClick={() => onDelete(quiz.id)}>
                        Delete
                      </Button>
                    </InlineStack>
                  </InlineStack>
                </Card>
              );
            })}
          </BlockStack>
        )}

        <Banner tone="info">
          <p>Only one quiz can be active at a time on the storefront.</p>
        </Banner>
      </BlockStack>
    </Page>
  );
}

// ─── Quiz Editor View ───
function QuizEditor({ initialQuiz, onBack, submit, isSaving, shopProducts }) {
  const [title, setTitle] = useState(initialQuiz.title || "");
  const [subtitle, setSubtitle] = useState(initialQuiz.subtitle || "");
  const [introTitle, setIntroTitle] = useState(initialQuiz.introTitle || "");
  const [introSubtitle, setIntroSubtitle] = useState(initialQuiz.introSubtitle || "");
  const [introBody, setIntroBody] = useState(initialQuiz.introBody || "");
  const [resultsTitle, setResultsTitle] = useState(initialQuiz.resultsTitle || "");
  const [resultsSubtitle, setResultsSubtitle] = useState(initialQuiz.resultsSubtitle || "");
  const [imageUrl, setImageUrl] = useState(initialQuiz.imageUrl || "");
  const [active, setActive] = useState(initialQuiz.active);
  const [saved, setSaved] = useState(false);

  const defaultProducts = initialQuiz.products?.length
    ? initialQuiz.products.map((p) => ({
        title: p.title,
        shopifyProductId: p.shopifyProductId,
        imageUrl: p.imageUrl,
        price: p.price,
        handle: p.handle,
        tooltipHtml: p.tooltipHtml || "",
      }))
    : [];
  const [products, setProducts] = useState(defaultProducts);

  const defaultQuestions = initialQuiz.questions?.length
    ? initialQuiz.questions.map((q) => ({
        title: q.title,
        subtitle: q.subtitle,
        answers: q.answers.map((a) => ({
          text: a.text,
          points: defaultProducts.map((_, pi) => {
            const pt = a.points.find(
              (p) => initialQuiz.products[pi] && p.quizProduct.id === initialQuiz.products[pi].id
            );
            return { productIndex: pi, points: pt?.points || 0 };
          }),
        })),
      }))
    : [];
  const [questions, setQuestions] = useState(defaultQuestions);

  const addProductFromShopify = (shopifyProduct) => {
    setProducts([...products, { ...shopifyProduct, tooltipHtml: "" }]);
    setQuestions(questions.map((q) => ({
      ...q,
      answers: q.answers.map((a) => ({
        ...a,
        points: [...a.points, { productIndex: products.length, points: 0 }],
      })),
    })));
  };

  const removeProduct = (index) => {
    if (products.length <= 1) return;
    setProducts(products.filter((_, i) => i !== index));
    setQuestions(questions.map((q) => ({
      ...q,
      answers: q.answers.map((a) => ({
        ...a,
        points: a.points
          .filter((p) => p.productIndex !== index)
          .map((p) => ({ ...p, productIndex: p.productIndex > index ? p.productIndex - 1 : p.productIndex })),
      })),
    })));
  };

  const addQuestion = () => {
    setQuestions([
      ...questions,
      {
        title: "",
        subtitle: "",
        answers: [
          { text: "", points: products.map((_, i) => ({ productIndex: i, points: 0 })) },
          { text: "", points: products.map((_, i) => ({ productIndex: i, points: 0 })) },
          { text: "", points: products.map((_, i) => ({ productIndex: i, points: 0 })) },
        ],
      },
    ]);
  };

  const removeQuestion = (qi) => setQuestions(questions.filter((_, i) => i !== qi));

  const updateQuestion = (qi, field, value) => {
    const updated = [...questions];
    updated[qi] = { ...updated[qi], [field]: value };
    setQuestions(updated);
  };

  const addAnswer = (qi) => {
    const updated = [...questions];
    updated[qi] = {
      ...updated[qi],
      answers: [...updated[qi].answers, { text: "", points: products.map((_, i) => ({ productIndex: i, points: 0 })) }],
    };
    setQuestions(updated);
  };

  const removeAnswer = (qi, ai) => {
    if (questions[qi].answers.length <= 2) return;
    const updated = [...questions];
    updated[qi] = { ...updated[qi], answers: updated[qi].answers.filter((_, i) => i !== ai) };
    setQuestions(updated);
  };

  const updateAnswer = (qi, ai, field, value) => {
    const updated = [...questions];
    updated[qi].answers[ai] = { ...updated[qi].answers[ai], [field]: value };
    setQuestions(updated);
  };

  const updateAnswerPoints = (qi, ai, productIndex, points) => {
    const updated = [...questions];
    const ptIndex = updated[qi].answers[ai].points.findIndex((p) => p.productIndex === productIndex);
    if (ptIndex >= 0) updated[qi].answers[ai].points[ptIndex].points = parseInt(points) || 0;
    setQuestions(updated);
  };

  const handleSave = () => {
    const formData = new FormData();
    formData.set("actionType", "saveQuiz");
    formData.set("quizId", initialQuiz.id);
    formData.set("quizData", JSON.stringify({ title, subtitle, introTitle, introSubtitle, introBody, resultsTitle, resultsSubtitle, imageUrl, active, products, questions }));
    submit(formData, { method: "POST" });
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <Page title={title || "Edit Quiz"}>
      <TitleBar title="Edit Quiz">
        <button onClick={onBack}>Back</button>
        <button variant="primary" onClick={handleSave} disabled={isSaving}>
          {isSaving ? "Saving..." : "Save Quiz"}
        </button>
      </TitleBar>

      <BlockStack gap="500">
        {saved && (
          <Banner tone="success" onDismiss={() => setSaved(false)}>
            Quiz saved successfully!
          </Banner>
        )}

        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">Quiz Settings</Text>
                <TextField label="Title" value={title} onChange={setTitle} />
                <TextField label="Subtitle" value={subtitle} onChange={setSubtitle} />
                <TextField label="Start screen image URL" value={imageUrl} onChange={setImageUrl} />
                <Checkbox label="Active" checked={active} onChange={setActive} />
              </BlockStack>
            </Card>
          </Layout.Section>
          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">Intro Page</Text>
                <TextField label="Intro heading" value={introTitle} onChange={setIntroTitle} />
                <TextField label="Intro subtitle" value={introSubtitle} onChange={setIntroSubtitle} placeholder="Just so you know" />
                <TextField label="Intro body (HTML)" value={introBody} onChange={setIntroBody} multiline={6} />
                <Divider />
                <Text variant="headingMd" as="h3">Results Page</Text>
                <TextField label="Results heading" value={resultsTitle} onChange={setResultsTitle} placeholder="Our top picks for you" />
                <TextField label="Results description" value={resultsSubtitle} onChange={setResultsSubtitle} multiline={3} placeholder="You will see a scoring system below..." />
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>

        <Card>
          <BlockStack gap="400">
            <BlockStack gap="100">
              <Text as="h2" variant="headingMd">Products (Quiz Results)</Text>
              <Text as="p" variant="bodyMd" tone="subdued">Select products that will be recommended based on quiz answers.</Text>
            </BlockStack>

            {/* Add product picker */}
            <Select
              label="Add a product"
              options={[
                { label: "— Select a product to add —", value: "" },
                ...shopProducts
                  .filter((sp) => !products.some((p) => p.shopifyProductId === sp.shopifyProductId))
                  .map((sp) => ({ label: sp.title, value: sp.shopifyProductId })),
              ]}
              value=""
              onChange={(productId) => {
                const sp = shopProducts.find((p) => p.shopifyProductId === productId);
                if (sp) addProductFromShopify(sp);
              }}
            />

            {products.map((p, i) => (
              <Card key={i}>
                <BlockStack gap="300">
                  <InlineStack align="space-between" blockAlign="center">
                    <InlineStack gap="300" blockAlign="center">
                      {p.imageUrl && (
                        <img src={p.imageUrl} alt={p.title} style={{ width: 48, height: 48, objectFit: "cover", borderRadius: 6 }} />
                      )}
                      <BlockStack gap="050">
                        <Text variant="bodyMd" fontWeight="bold">{p.title}</Text>
                        <Text variant="bodySm" tone="subdued">{p.price}</Text>
                      </BlockStack>
                    </InlineStack>
                    <Button tone="critical" variant="plain" size="slim" onClick={() => removeProduct(i)}>Remove</Button>
                  </InlineStack>
                  <TextField
                    label="Tooltip HTML (shown on results page)"
                    value={p.tooltipHtml || ""}
                    onChange={(v) => {
                      const updated = [...products];
                      updated[i] = { ...updated[i], tooltipHtml: v };
                      setProducts(updated);
                    }}
                    multiline={3}
                    helpText="HTML content displayed when hovering the match score badge"
                  />
                </BlockStack>
              </Card>
            ))}
          </BlockStack>
        </Card>

        <Card>
          <BlockStack gap="400">
            <InlineStack align="space-between">
              <Text as="h2" variant="headingMd">Questions ({questions.length})</Text>
              <Button onClick={addQuestion}>Add Question</Button>
            </InlineStack>

            {questions.map((q, qi) => (
              <Card key={qi}>
                <BlockStack gap="400">
                  <InlineStack align="space-between">
                    <Badge tone="info">{`Question ${qi + 1}`}</Badge>
                    <Button tone="critical" variant="plain" onClick={() => removeQuestion(qi)}>Remove</Button>
                  </InlineStack>

                  <TextField label="Question" value={q.title} onChange={(v) => updateQuestion(qi, "title", v)} />
                  <TextField label="Subtitle / hint" value={q.subtitle} onChange={(v) => updateQuestion(qi, "subtitle", v)} multiline={2} />

                  <Divider />

                  {q.answers.map((a, ai) => (
                    <Box key={ai} padding="300" background="bg-surface-secondary" borderRadius="200">
                      <BlockStack gap="300">
                        <InlineStack align="space-between" blockAlign="center">
                          <Text as="h4" variant="headingSm">Answer {ai + 1}</Text>
                          {q.answers.length > 2 && (
                            <Button tone="critical" variant="plain" size="slim" onClick={() => removeAnswer(qi, ai)}>Remove answer</Button>
                          )}
                        </InlineStack>
                        <TextField label="Answer text" value={a.text} onChange={(v) => updateAnswer(qi, ai, "text", v)} />
                        <Text variant="bodySm" tone="subdued">Points per product:</Text>
                        <InlineStack gap="300" wrap>
                          {products.map((p, pi) => (
                            <TextField
                              key={pi}
                              label={p.title || `Product ${pi + 1}`}
                              type="number"
                              min="0"
                              value={String(a.points?.[pi]?.points || 0)}
                              onChange={(v) => updateAnswerPoints(qi, ai, pi, v)}
                            />
                          ))}
                        </InlineStack>
                      </BlockStack>
                    </Box>
                  ))}

                  {q.answers.length < 6 && (
                    <Button size="slim" onClick={() => addAnswer(qi)}>+ Add Answer</Button>
                  )}
                </BlockStack>
              </Card>
            ))}
          </BlockStack>
        </Card>
      </BlockStack>
    </Page>
  );
}

// ─── Main Component ───
export default function QuizApp() {
  const { quizzes, editQuiz, shopProducts } = useLoaderData();
  const submit = useSubmit();
  const navigation = useNavigation();
  const [searchParams, setSearchParams] = useSearchParams();
  const isSubmitting = navigation.state === "submitting";

  const editId = searchParams.get("edit");

  const handleCreate = () => {
    const formData = new FormData();
    formData.set("actionType", "create");
    submit(formData, { method: "POST" });
  };

  const handleDelete = (quizId) => {
    if (!confirm("Delete this quiz? This cannot be undone.")) return;
    const formData = new FormData();
    formData.set("actionType", "delete");
    formData.set("quizId", quizId);
    submit(formData, { method: "POST" });
  };

  const handleToggle = (quizId) => {
    const formData = new FormData();
    formData.set("actionType", "toggleActive");
    formData.set("quizId", quizId);
    submit(formData, { method: "POST" });
  };

  const handleEdit = (quizId) => {
    setSearchParams({ edit: quizId });
  };

  const handleBack = () => {
    setSearchParams({});
  };

  if (editId && editQuiz) {
    return (
      <QuizEditor
        initialQuiz={editQuiz}
        onBack={handleBack}
        submit={submit}
        isSaving={isSubmitting}
        shopProducts={shopProducts || []}
      />
    );
  }

  return (
    <QuizList
      quizzes={quizzes}
      onEdit={handleEdit}
      onDelete={handleDelete}
      onToggle={handleToggle}
      onCreate={handleCreate}
      isSubmitting={isSubmitting}
    />
  );
}
