import { useState } from "react";
import { useLoaderData, useSubmit, useNavigation } from "@remix-run/react";
import { json } from "@remix-run/node";
import {
  Page,
  Card,
  Text,
  BlockStack,
  InlineStack,
  Select,
  Box,
  InlineGrid,
  Divider,
  Button,
  Banner,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import db from "../db.server";

function getDateRange(days) {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const start = new Date();
  start.setDate(start.getDate() - days);
  start.setHours(0, 0, 0, 0);
  const prevEnd = new Date(start.getTime() - 1);
  prevEnd.setHours(23, 59, 59, 999);
  const prevStart = new Date(prevEnd);
  prevStart.setDate(prevStart.getDate() - days);
  prevStart.setHours(0, 0, 0, 0);
  return { start, end, prevStart, prevEnd };
}

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const url = new URL(request.url);
  const days = parseInt(url.searchParams.get("days") || "30");
  const selectedQuizId = url.searchParams.get("quizId") || "all";
  const { start, end, prevStart, prevEnd } = getDateRange(days);

  // Fetch all quizzes for the selector
  const quizzes = await db.quiz.findMany({
    where: { shop },
    select: { id: true, title: true },
    orderBy: { createdAt: "desc" },
  });

  // Build session filter for quiz-specific analytics
  const sessionFilter = selectedQuizId !== "all" ? { quizId: selectedQuizId } : {};

  // Get session IDs for this quiz (if filtered)
  let sessionIds = null;
  if (selectedQuizId !== "all") {
    const sessions = await db.quizSession.findMany({
      where: { shop, ...sessionFilter },
      select: { id: true },
    });
    sessionIds = sessions.map((s) => s.id);
  }

  // Build event filter
  const eventFilter = {
    shop,
    createdAt: { gte: start, lte: end },
    ...(sessionIds ? { quizSessionId: { in: sessionIds } } : {}),
  };
  const prevEventFilter = {
    shop,
    createdAt: { gte: prevStart, lte: prevEnd },
    ...(sessionIds ? { quizSessionId: { in: sessionIds } } : {}),
  };

  const currentEvents = await db.analyticsEvent.findMany({
    where: eventFilter,
    orderBy: { createdAt: "asc" },
  });

  const prevEvents = await db.analyticsEvent.findMany({
    where: prevEventFilter,
  });

  const count = (events, type) => events.filter((e) => e.eventType === type).length;

  const metrics = {
    views: { current: count(currentEvents, "view"), previous: count(prevEvents, "view") },
    engagements: { current: count(currentEvents, "start"), previous: count(prevEvents, "start") },
    completions: { current: count(currentEvents, "complete"), previous: count(prevEvents, "complete") },
    addToCart: { current: count(currentEvents, "add_to_cart"), previous: count(prevEvents, "add_to_cart") },
  };

  // Daily breakdown for charts
  const dailyData = {};
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const key = d.toISOString().split("T")[0];
    dailyData[key] = { view: 0, start: 0, complete: 0, add_to_cart: 0 };
  }
  currentEvents.forEach((e) => {
    const key = e.createdAt.toISOString().split("T")[0];
    if (dailyData[key]) dailyData[key][e.eventType]++;
  });

  const prevDailyData = {};
  for (let d = new Date(prevStart); d <= prevEnd; d.setDate(d.getDate() + 1)) {
    const key = d.toISOString().split("T")[0];
    prevDailyData[key] = { view: 0, start: 0, complete: 0, add_to_cart: 0 };
  }
  prevEvents.forEach((e) => {
    const key = e.createdAt.toISOString().split("T")[0];
    if (prevDailyData[key]) prevDailyData[key][e.eventType]++;
  });

  const chartData = {
    current: Object.entries(dailyData).map(([date, counts]) => ({ date, ...counts })),
    previous: Object.entries(prevDailyData).map(([date, counts]) => ({ date, ...counts })),
  };

  // Top recommended products
  const completedSessionFilter = {
    shop,
    completedAt: { not: null },
    startedAt: { gte: start, lte: end },
    ...sessionFilter,
  };

  const completedSessions = await db.quizSession.findMany({
    where: completedSessionFilter,
    include: {
      responses: {
        include: {
          answer: {
            include: {
              points: { include: { quizProduct: true } },
            },
          },
        },
      },
    },
  });

  const productRecommendations = {};
  completedSessions.forEach((s) => {
    const scores = {};
    s.responses.forEach((resp) => {
      resp.answer.points.forEach((pt) => {
        const title = pt.quizProduct.title;
        scores[title] = (scores[title] || 0) + pt.points;
      });
    });
    Object.keys(scores).forEach((title) => {
      if (!productRecommendations[title]) {
        productRecommendations[title] = { count: 0, title };
      }
      productRecommendations[title].count++;
    });
  });

  const topRecommended = Object.values(productRecommendations)
    .sort((a, b) => b.count - a.count)
    .map((p) => ({
      ...p,
      percentage: completedSessions.length
        ? Math.round((p.count / completedSessions.length) * 100)
        : 0,
    }));

  const prevCompletedSessions = await db.quizSession.findMany({
    where: {
      shop,
      completedAt: { not: null },
      startedAt: { gte: prevStart, lte: prevEnd },
      ...sessionFilter,
    },
  });
  const prevCompletedCount = prevCompletedSessions.length;

  // Top products added to cart
  const addToCartEvents = currentEvents.filter((e) => e.eventType === "add_to_cart" && e.productTitle);
  const cartProducts = {};
  addToCartEvents.forEach((e) => {
    if (!cartProducts[e.productTitle]) {
      cartProducts[e.productTitle] = { title: e.productTitle, count: 0 };
    }
    cartProducts[e.productTitle].count++;
  });
  const topAddedToCart = Object.values(cartProducts).sort((a, b) => b.count - a.count);

  const prevAddToCartEvents = prevEvents.filter((e) => e.eventType === "add_to_cart" && e.productTitle);
  const prevCartProducts = {};
  prevAddToCartEvents.forEach((e) => {
    if (!prevCartProducts[e.productTitle]) {
      prevCartProducts[e.productTitle] = { title: e.productTitle, count: 0 };
    }
    prevCartProducts[e.productTitle].count++;
  });

  return json({
    metrics,
    chartData,
    topRecommended,
    topAddedToCart,
    prevCartProducts,
    prevCompletedCount,
    totalCompleted: completedSessions.length,
    days,
    quizzes,
    selectedQuizId,
  });
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const formData = await request.formData();
  const actionType = formData.get("actionType");

  if (actionType === "clearAnalytics") {
    await db.analyticsEvent.deleteMany({ where: { shop } });
    await db.quizResponse.deleteMany({
      where: { session: { shop } },
    });
    await db.quizSession.deleteMany({ where: { shop } });
    return json({ cleared: true });
  }

  return json({ error: "Unknown action" }, { status: 400 });
};

function percentChange(current, previous) {
  if (previous === 0 && current === 0) return 0;
  if (previous === 0) return 100;
  return Math.round(((current - previous) / previous) * 100);
}

function SparkLine({ data, prevData, dates, height = 120, width = 400 }) {
  if (!data || data.length === 0) return null;

  const max = Math.max(...data, ...(prevData || []), 1);
  const paddingTop = 10;
  const paddingBottom = 22;
  const paddingLeft = 30;
  const paddingRight = 10;
  const chartW = width - paddingLeft - paddingRight;
  const chartH = height - paddingTop - paddingBottom;

  const toPath = (values) => {
    if (!values || values.length === 0) return "";
    return values
      .map((v, i) => {
        const x = paddingLeft + (i / Math.max(values.length - 1, 1)) * chartW;
        const y = paddingTop + chartH - (v / max) * chartH;
        return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(" ");
  };

  // Y-axis gridlines
  const gridLines = 4;
  const yLabels = [];
  for (let i = 0; i <= gridLines; i++) {
    const val = Math.round((max / gridLines) * i);
    const y = paddingTop + chartH - (i / gridLines) * chartH;
    yLabels.push({ val, y });
  }

  // X-axis date labels (show ~5 evenly spaced)
  const xLabels = [];
  if (dates && dates.length > 0) {
    const step = Math.max(Math.floor(dates.length / 5), 1);
    for (let i = 0; i < dates.length; i += step) {
      const x = paddingLeft + (i / Math.max(dates.length - 1, 1)) * chartW;
      const d = new Date(dates[i]);
      const label = `${d.getDate()} ${d.toLocaleString('en', { month: 'short' })}`;
      xLabels.push({ label, x });
    }
  }

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
      {/* Grid lines */}
      {yLabels.map(({ val, y }, i) => (
        <g key={`g${i}`}>
          <line x1={paddingLeft} y1={y} x2={width - paddingRight} y2={y} stroke="#f0f0f0" strokeWidth="1" />
          <text x={paddingLeft - 4} y={y + 3} textAnchor="end" fontSize="9" fill="#999">{val}</text>
        </g>
      ))}
      {/* X-axis labels */}
      {xLabels.map(({ label, x }, i) => (
        <text key={`x${i}`} x={x} y={height - 4} textAnchor="middle" fontSize="9" fill="#999">{label}</text>
      ))}
      {/* Previous period line */}
      {prevData && (
        <path d={toPath(prevData)} fill="none" stroke="#D1D5DB" strokeWidth="1.5" strokeDasharray="4 3" />
      )}
      {/* Current period line */}
      <path d={toPath(data)} fill="none" stroke="#7C3AED" strokeWidth="2" />
      {/* Dots on current data points with values */}
      {data.map((v, i) => {
        if (v === 0) return null;
        const x = paddingLeft + (i / Math.max(data.length - 1, 1)) * chartW;
        const y = paddingTop + chartH - (v / max) * chartH;
        return <circle key={`d${i}`} cx={x} cy={y} r="3" fill="#7C3AED" />;
      })}
    </svg>
  );
}

function MetricCard({ title, value, change, chartData, prevChartData, dates, prefix = "" }) {
  const isUp = change > 0;
  const isDown = change < 0;
  const changeColor = isUp ? "success" : isDown ? "critical" : "subdued";
  const arrow = isUp ? "\u2191" : isDown ? "\u2193" : "";

  return (
    <Card>
      <BlockStack gap="200">
        <Text variant="bodySm" as="p" tone="subdued">{title}</Text>
        <InlineStack align="space-between" blockAlign="center">
          <Text variant="headingXl" as="h3">{prefix}{value}</Text>
          {change !== 0 ? (
            <Text variant="bodySm" tone={changeColor} fontWeight="semibold">
              {arrow} {Math.abs(change)}%
            </Text>
          ) : (
            <Text variant="bodySm" tone="subdued">&mdash;</Text>
          )}
        </InlineStack>
        <Box paddingBlockStart="200">
          <SparkLine data={chartData} prevData={prevChartData} dates={dates} />
        </Box>
        <InlineStack gap="300">
          <InlineStack gap="100" blockAlign="center">
            <div style={{ width: 8, height: 8, borderRadius: 4, background: "#7C3AED" }} />
            <Text variant="bodySm" tone="subdued">Current</Text>
          </InlineStack>
          <InlineStack gap="100" blockAlign="center">
            <div style={{ width: 8, height: 8, borderRadius: 4, border: "1.5px dashed #D1D5DB" }} />
            <Text variant="bodySm" tone="subdued">Previous</Text>
          </InlineStack>
        </InlineStack>
      </BlockStack>
    </Card>
  );
}

function FunnelRow({ label, count, percentage, change }) {
  const changeColor = change < 0 ? "critical" : change > 0 ? "success" : "subdued";
  const arrow = change < 0 ? "\u2193" : change > 0 ? "\u2191" : "";

  return (
    <Box paddingBlockStart="300" paddingBlockEnd="300">
      <InlineStack align="space-between" blockAlign="center">
        <BlockStack gap="050">
          <Text variant="bodyMd" fontWeight="semibold">{label}</Text>
          <Text variant="bodySm" tone="subdued">{count} sessions</Text>
        </BlockStack>
        <InlineStack gap="300" blockAlign="center">
          <Text variant="bodyMd">{percentage}%</Text>
          {change !== 0 ? (
            <Text variant="bodySm" tone={changeColor}>
              {arrow} {Math.abs(change)}%
            </Text>
          ) : (
            <Text variant="bodySm" tone="subdued">&mdash;</Text>
          )}
        </InlineStack>
      </InlineStack>
    </Box>
  );
}

export default function AnalyticsDashboard() {
  const {
    metrics,
    chartData,
    topRecommended,
    topAddedToCart,
    prevCartProducts,
    prevCompletedCount,
    totalCompleted,
    days: initialDays,
    quizzes,
    selectedQuizId: initialQuizId,
  } = useLoaderData();

  const submit = useSubmit();
  const navigation = useNavigation();
  const isClearing = navigation.state === "submitting";
  const [days, setDays] = useState(String(initialDays));
  const [quizId, setQuizId] = useState(initialQuizId);

  const handleClear = () => {
    if (!confirm("Clear all analytics data? This cannot be undone.")) return;
    const formData = new FormData();
    formData.set("actionType", "clearAnalytics");
    submit(formData, { method: "POST" });
  };

  const updateUrl = (newDays, newQuizId) => {
    const params = new URLSearchParams();
    params.set("days", newDays);
    if (newQuizId && newQuizId !== "all") params.set("quizId", newQuizId);
    window.location.search = params.toString();
  };

  const handleDaysChange = (value) => {
    setDays(value);
    updateUrl(value, quizId);
  };

  const handleQuizChange = (value) => {
    setQuizId(value);
    updateUrl(days, value);
  };

  const dateOptions = [
    { label: "Last 7 days", value: "7" },
    { label: "Last 30 days", value: "30" },
    { label: "Last 90 days", value: "90" },
  ];

  const quizOptions = [
    { label: "All quizzes", value: "all" },
    ...quizzes.map((q) => ({ label: q.title, value: q.id })),
  ];

  const chartDates = chartData.current.map((d) => d.date);
  const viewsChart = chartData.current.map((d) => d.view);
  const prevViewsChart = chartData.previous.map((d) => d.view);
  const engagementsChart = chartData.current.map((d) => d.start);
  const prevEngagementsChart = chartData.previous.map((d) => d.start);
  const completionsChart = chartData.current.map((d) => d.complete);
  const prevCompletionsChart = chartData.previous.map((d) => d.complete);
  const addToCartChart = chartData.current.map((d) => d.add_to_cart);
  const prevAddToCartChart = chartData.previous.map((d) => d.add_to_cart);

  // Conversion funnel
  const funnelViews = metrics.views.current;
  const funnelEngagements = metrics.engagements.current;
  const funnelCompletions = metrics.completions.current;
  const funnelAddToCart = metrics.addToCart.current;

  const funnelEngagementsPct = funnelViews ? Math.round((funnelEngagements / funnelViews) * 100) : 0;
  const funnelCompletionsPct = funnelViews ? Math.round((funnelCompletions / funnelViews) * 100) : 0;
  const funnelAddToCartPct = funnelViews ? Math.round((funnelAddToCart / funnelViews) * 100) : 0;

  const prevFunnelViews = metrics.views.previous;
  const prevFunnelEngagements = metrics.engagements.previous;
  const prevFunnelCompletions = metrics.completions.previous;
  const prevFunnelAddToCart = metrics.addToCart.previous;

  const prevEngPct = prevFunnelViews ? Math.round((prevFunnelEngagements / prevFunnelViews) * 100) : 0;
  const prevCompPct = prevFunnelViews ? Math.round((prevFunnelCompletions / prevFunnelViews) * 100) : 0;
  const prevAtcPct = prevFunnelViews ? Math.round((prevFunnelAddToCart / prevFunnelViews) * 100) : 0;

  const overallConversion = funnelViews ? Math.round((funnelAddToCart / funnelViews) * 100) : 0;
  const prevOverallConversion = prevFunnelViews ? Math.round((prevFunnelAddToCart / prevFunnelViews) * 100) : 0;

  return (
    <Page>
      <TitleBar title="Analytics" />

      <BlockStack gap="500">
        {/* Filters */}
        <InlineStack align="space-between" blockAlign="end">
          <Box minWidth="240px">
            <Select
              label="Quiz"
              options={quizOptions}
              value={quizId}
              onChange={handleQuizChange}
            />
          </Box>
          <InlineStack gap="300" blockAlign="end">
            <Box minWidth="180px">
              <Select
                label="Date range"
                options={dateOptions}
                value={days}
                onChange={handleDaysChange}
              />
            </Box>
            <Button tone="critical" variant="plain" onClick={handleClear} loading={isClearing}>
              Clear analytics
            </Button>
          </InlineStack>
        </InlineStack>

        {/* Metric cards */}
        <InlineGrid columns={{ xs: 1, sm: 2, lg: 2 }} gap="400">
          <MetricCard
            title="Engagements"
            value={metrics.engagements.current}
            change={percentChange(metrics.engagements.current, metrics.engagements.previous)}
            chartData={engagementsChart}
            prevChartData={prevEngagementsChart}
            dates={chartDates}
          />
          <MetricCard
            title="Completions"
            value={metrics.completions.current}
            change={percentChange(metrics.completions.current, metrics.completions.previous)}
            chartData={completionsChart}
            prevChartData={prevCompletionsChart}
            dates={chartDates}
          />
          <MetricCard
            title="Add to Cart"
            value={metrics.addToCart.current}
            change={percentChange(metrics.addToCart.current, metrics.addToCart.previous)}
            chartData={addToCartChart}
            prevChartData={prevAddToCartChart}
            dates={chartDates}
          />
          <MetricCard
            title="Views"
            value={metrics.views.current}
            change={percentChange(metrics.views.current, metrics.views.previous)}
            chartData={viewsChart}
            prevChartData={prevViewsChart}
            dates={chartDates}
          />
        </InlineGrid>

        {/* Conversion funnel */}
        <Card>
          <BlockStack gap="400">
            <InlineStack align="space-between" blockAlign="center">
              <Text variant="headingMd" as="h2">Flow conversion rate</Text>
              <InlineStack gap="200" blockAlign="center">
                <Text variant="headingXl" as="h3">{overallConversion}%</Text>
                {percentChange(overallConversion, prevOverallConversion) !== 0 && (
                  <Text
                    variant="bodySm"
                    tone={percentChange(overallConversion, prevOverallConversion) > 0 ? "success" : "critical"}
                    fontWeight="semibold"
                  >
                    {percentChange(overallConversion, prevOverallConversion) > 0 ? "\u2191" : "\u2193"}{" "}
                    {Math.abs(percentChange(overallConversion, prevOverallConversion))}%
                  </Text>
                )}
              </InlineStack>
            </InlineStack>

            <Divider />

            <BlockStack gap="0">
              <Text variant="headingSm" as="h3">Conversion funnel</Text>
              <FunnelRow
                label="Views"
                count={funnelViews}
                percentage={100}
                change={percentChange(funnelViews, prevFunnelViews)}
              />
              <Divider />
              <FunnelRow
                label="Engagements"
                count={funnelEngagements}
                percentage={funnelEngagementsPct}
                change={funnelEngagementsPct - prevEngPct}
              />
              <Divider />
              <FunnelRow
                label="Reached results"
                count={funnelCompletions}
                percentage={funnelCompletionsPct}
                change={funnelCompletionsPct - prevCompPct}
              />
              <Divider />
              <FunnelRow
                label="Sessions converted"
                count={funnelAddToCart}
                percentage={funnelAddToCartPct}
                change={funnelAddToCartPct - prevAtcPct}
              />
            </BlockStack>
          </BlockStack>
        </Card>

        {/* Bottom: Recommended + Added to cart */}
        <InlineGrid columns={{ xs: 1, sm: 2, lg: 2 }} gap="400">
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">Top recommended products</Text>
              {topRecommended.length === 0 ? (
                <Text tone="subdued">No quiz completions in this date range.</Text>
              ) : (
                <BlockStack gap="0">
                  {topRecommended.map((p, i) => (
                    <Box key={i} paddingBlockStart="300" paddingBlockEnd="300">
                      <InlineStack align="space-between" blockAlign="center">
                        <Text variant="bodyMd">{p.title}</Text>
                        <InlineStack gap="200" blockAlign="center">
                          <Text variant="bodyMd">
                            {p.count} ({p.percentage}%)
                          </Text>
                          {(() => {
                            const prev = prevCompletedCount > 0
                              ? Math.round(prevCompletedCount * (p.percentage / 100))
                              : 0;
                            const change = percentChange(p.count, prev);
                            if (change === 0) return <Text variant="bodySm" tone="subdued">&mdash;</Text>;
                            return (
                              <Text variant="bodySm" tone={change > 0 ? "success" : "critical"}>
                                {change > 0 ? "\u2191" : "\u2193"} {Math.abs(change)}%
                              </Text>
                            );
                          })()}
                        </InlineStack>
                      </InlineStack>
                      {i < topRecommended.length - 1 && <Box paddingBlockStart="300"><Divider /></Box>}
                    </Box>
                  ))}
                </BlockStack>
              )}
            </BlockStack>
          </Card>

          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">Top products added to cart</Text>
              {topAddedToCart.length === 0 ? (
                <Text tone="subdued">No add-to-cart events in this date range.</Text>
              ) : (
                <BlockStack gap="0">
                  {topAddedToCart.map((p, i) => (
                    <Box key={i} paddingBlockStart="300" paddingBlockEnd="300">
                      <InlineStack align="space-between" blockAlign="center">
                        <Text variant="bodyMd">{p.title}</Text>
                        <InlineStack gap="200" blockAlign="center">
                          <Text variant="bodyMd">{p.count}</Text>
                          {(() => {
                            const prev = prevCartProducts[p.title]?.count || 0;
                            const change = percentChange(p.count, prev);
                            if (change === 0) return <Text variant="bodySm" tone="subdued">&mdash;</Text>;
                            return (
                              <Text variant="bodySm" tone={change > 0 ? "success" : "critical"}>
                                {change > 0 ? "\u2191" : "\u2193"} {Math.abs(change)}%
                              </Text>
                            );
                          })()}
                        </InlineStack>
                      </InlineStack>
                      {i < topAddedToCart.length - 1 && <Box paddingBlockStart="300"><Divider /></Box>}
                    </Box>
                  ))}
                </BlockStack>
              )}
            </BlockStack>
          </Card>
        </InlineGrid>
      </BlockStack>
    </Page>
  );
}
