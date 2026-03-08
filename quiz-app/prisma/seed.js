import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SHOP = "quiz-app-492.myshopify.com";

const introBody = `<p>Magnesium is one of the most essential minerals in the human body, playing a pivotal role in both energy production and nervous system regulation. It acts as a cofactor for ATP, the molecule your cells use for energy. In fact, ATP is only biologically active when bound to magnesium (as Mg-ATP), making this mineral critical for every single process in the body.</p>

<p>When magnesium levels are optimal, your mitochondria (the energy factories of your cells) operate more efficiently, supporting sustained daytime energy, mental clarity, and metabolic function. At the same time, magnesium plays a calming role by modulating neurotransmitters and regulating the stress response system, helping your body to relax.</p>

<p>This dual action makes magnesium unique: it doesn't act as a stimulant or a sedative, but rather supports the natural rhythm of your body. However, not all forms of magnesium are the same, and individual responses can vary.</p>

<p>Because magnesium affects so many systems, people often experience different results depending on the form they take. One person may feel energised with magnesium malate but overstimulated at night. Another might find deep relaxation and improved sleep with bisglycinate, while someone with a sensitive gut might only tolerate specific forms.</p>

<p>That's why personal experimentation is so valuable when it comes to magnesium. There's no one-size-fits-all answer. Factors like your stress load, digestion, hormonal status, energy demands, and even your genetics can affect how you respond to different forms. By tuning into how each form makes you feel \u2013 in terms of energy, mood, digestion, sleep, and physical tension you begin to build a clearer picture of what your body truly needs.</p>

<p>If you have any health condition or are taking any medication, we always suggest checking with your healthcare provider or practitioner first as they will be able to guide you on what is appropriate.</p>

<p>Well done for making it this far! Now onto a quick quiz.</p>`;

// Products: [0] Taurate, [1] Bisglycinate, [2] Malate
const products = [
  {
    title: "Magnesium Taurate",
    handle: "magnesium-taurate",
    price: "\u00a332.00",
    shopifyProductId: "",
    imageUrl: "",
  },
  {
    title: "Magnesium Bisglycinate with Coconut Water",
    handle: "magnesium-bisglycinate-with-coconut-water",
    price: "\u00a332.00",
    shopifyProductId: "",
    imageUrl: "",
  },
  {
    title: "Magnesium Malate with Coconut Water",
    handle: "magnesium-malate-with-coconut-water",
    price: "\u00a332.00",
    shopifyProductId: "",
    imageUrl: "",
  },
];

// Points format: [Taurate, Bisglycinate, Malate]
const questions = [
  {
    title: "What is your top wellness goal right now?",
    subtitle:
      "Stress burns through magnesium \u2013 The more stressed you are, the faster your body depletes magnesium.",
    answers: [
      { text: "Boost daily energy and reduce fatigue", points: [0, 1, 2] },
      { text: "Support heart health, blood pressure or stress", points: [2, 1, 0] },
      { text: "Improve sleep, calm the nervous system or reduce tension", points: [1, 2, 0] },
    ],
  },
  {
    title: "How are your energy levels during the day?",
    subtitle:
      "Magnesium helps regulate blood sugar \u2013 It improves insulin sensitivity, making it a quiet but powerful player in metabolic and hormonal health.",
    answers: [
      { text: "I often feel tired or sluggish", points: [0, 1, 2] },
      { text: "I have steady energy but feel mentally wired or anxious", points: [2, 1, 0] },
      { text: "I'm tired and tense, especially at night", points: [1, 2, 0] },
    ],
  },
  {
    title: "Do you struggle with sleep?",
    subtitle:
      "Magnesium calms your nervous system \u2013 It helps regulate GABA, a key calming neurotransmitter, making it essential for relaxation, mood, and sleep.",
    answers: [
      { text: "Yes, falling or staying asleep is hard", points: [1, 2, 0] },
      { text: "Not really, my sleep is okay", points: [1, 0, 1] },
      { text: "I sleep fine but wake unrefreshed", points: [0, 1, 2] },
    ],
  },
  {
    title: "Do you experience muscle cramps, tension or headaches?",
    subtitle:
      "Low magnesium can cause muscle twitches \u2013 Tingling, spasms, and eyelid twitches are classic signs your cells may be magnesium-starved.",
    answers: [
      { text: "Yes but mostly muscle cramps", points: [0, 1, 2] },
      { text: "Yes but mostly general tension", points: [1, 2, 0] },
      { text: "Yes but mostly headaches", points: [2, 1, 0] },
    ],
  },
  {
    title: "How active are you on a weekly basis?",
    subtitle:
      "Your bones store 60% of your magnesium \u2013 It's not just about calcium, magnesium is crucial for bone density and protecting against age-related bone loss.",
    answers: [
      { text: "Rarely active, maybe once a week", points: [1, 2, 0] },
      { text: "I keep active occasionally during the week", points: [1, 1, 1] },
      { text: "I'm very active throughout the week", points: [1, 0, 2] },
    ],
  },
  {
    title: "Are you looking to support hormone balance or PMS symptoms?",
    subtitle:
      "Magnesium is nature's original calcium channel blocker \u2013 It helps relax blood vessels, regulate heart rhythm, and prevent excessive calcium buildup.",
    answers: [
      { text: "Yes, especially around my cycle or mood", points: [1, 2, 0] },
      { text: "Not specifically", points: [1, 1, 1] },
      { text: "I'm unsure", points: [1, 1, 1] },
    ],
  },
  {
    title: "How is your digestion and gut health?",
    subtitle:
      "Magnesium supports smooth muscle movement in the gut \u2013 It helps regulate peristalsis, the wave-like contractions that move food through your digestive tract.",
    answers: [
      { text: "I have a very sensitive gut and react easily", points: [1, 2, 0] },
      { text: "My digestion is generally fine", points: [1, 1, 1] },
      {
        text: "I'm sensitive to acidic forms but tolerate calming nutrients well",
        points: [1, 2, 0],
      },
    ],
  },
];

async function seed() {
  console.log("Seeding quiz data...");

  // Delete existing quiz for this shop
  const existing = await prisma.quiz.findFirst({ where: { shop: SHOP } });
  if (existing) {
    await prisma.quiz.delete({ where: { id: existing.id } });
    console.log("Deleted existing quiz.");
  }

  // Create quiz
  const quiz = await prisma.quiz.create({
    data: {
      shop: SHOP,
      title: "Confused about which magnesium is best for you?",
      subtitle: "We're here to offer some guidance.",
      introTitle: "But before we start, here's the lowdown on magnesium",
      introSubtitle: "Just so you know",
      introBody,
      imageUrl: "",
      active: true,
    },
  });
  console.log(`Created quiz: ${quiz.id}`);

  // Create products
  const createdProducts = [];
  for (let i = 0; i < products.length; i++) {
    const p = await prisma.quizProduct.create({
      data: {
        quizId: quiz.id,
        title: products[i].title,
        handle: products[i].handle,
        price: products[i].price,
        shopifyProductId: products[i].shopifyProductId,
        imageUrl: products[i].imageUrl,
        order: i,
      },
    });
    createdProducts.push(p);
    console.log(`  Product ${i}: ${p.title}`);
  }

  // Create questions
  for (let qi = 0; qi < questions.length; qi++) {
    const q = questions[qi];
    const question = await prisma.question.create({
      data: {
        quizId: quiz.id,
        order: qi + 1,
        title: q.title,
        subtitle: q.subtitle,
      },
    });
    console.log(`  Q${qi + 1}: ${q.title}`);

    // Create answers
    for (let ai = 0; ai < q.answers.length; ai++) {
      const a = q.answers[ai];
      const answer = await prisma.answer.create({
        data: {
          questionId: question.id,
          order: ai + 1,
          text: a.text,
        },
      });

      // Create points for each product
      for (let pi = 0; pi < a.points.length; pi++) {
        await prisma.answerPoint.create({
          data: {
            answerId: answer.id,
            quizProductId: createdProducts[pi].id,
            points: a.points[pi],
          },
        });
      }
      console.log(`    A${ai + 1}: "${a.text}" → [${a.points.join(", ")}]`);
    }
  }

  console.log("\nSeeding complete!");
}

seed()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
