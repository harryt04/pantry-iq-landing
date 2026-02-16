"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  TrendingDown,
  Leaf,
  Heart,
  BarChart3,
  ShoppingCart,
  MessageSquare,
  ChefHat,
  ArrowRight,
  Check,
  Sparkles,
} from "lucide-react";

export function LandingPage() {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to subscribe");
      }

      setIsSubmitted(true);
      setEmail("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="border-b border-border">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ChefHat className="h-8 w-8 text-primary" />
            <span className="text-2xl font-bold">PantryIQ</span>
          </div>
          <Button variant="outline" asChild>
            <a href="#notify">Get Early Access</a>
          </Button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 lg:py-32">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium mb-6">
            <Sparkles className="h-4 w-4" />
            AI-Powered Restaurant Intelligence
          </div>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
            Stop Over-Ordering.{" "}
            <span className="text-primary">Reduce Spoilage.</span> Increase
            Profits.
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Our restaurant forecasting software uses AI to minimize food waste,
            optimize inventory, and help donate surplus to those in need.
          </p>

          {/* Email Signup */}
          <div id="notify" className="max-w-md mx-auto">
            {isSubmitted ? (
              <div className="bg-primary/10 text-primary p-4 rounded-lg flex items-center justify-center gap-2">
                <Check className="h-5 w-5" />
                <span>Thanks! We&apos;ll notify you when we launch.</span>
              </div>
            ) : (
              <form
                onSubmit={handleSubmit}
                className="flex flex-col sm:flex-row gap-3">
                <Input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="flex-1"
                />
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Joining..." : "Get Early Access"}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </form>
            )}
            {error && <p className="text-destructive text-sm mt-2">{error}</p>}
            <p className="text-sm text-muted-foreground mt-3">
              Join the waitlist for exclusive early access and launch pricing.
            </p>
          </div>
        </div>
      </section>

      {/* Problem Section */}
      <section className="bg-muted/50 py-20">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">
            The Food Waste Problem
          </h2>
          <p className="text-lg text-muted-foreground text-center max-w-2xl mx-auto mb-12">
            Restaurants lose thousands every month to over-ordering, spoilage,
            and poor demand forecasting. Meanwhile, perfectly good food ends up
            in landfills.
          </p>
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <Card className="text-center">
              <CardHeader>
                <div className="mx-auto bg-destructive/10 p-3 rounded-full w-fit mb-2">
                  <TrendingDown className="h-8 w-8 text-destructive" />
                </div>
                <CardTitle>$162 Billion</CardTitle>
                <CardDescription>
                  Annual food waste cost in US restaurants
                </CardDescription>
              </CardHeader>
            </Card>
            <Card className="text-center">
              <CardHeader>
                <div className="mx-auto bg-destructive/10 p-3 rounded-full w-fit mb-2">
                  <ShoppingCart className="h-8 w-8 text-destructive" />
                </div>
                <CardTitle>4-10%</CardTitle>
                <CardDescription>
                  Average food waste as percentage of food purchased
                </CardDescription>
              </CardHeader>
            </Card>
            <Card className="text-center">
              <CardHeader>
                <div className="mx-auto bg-destructive/10 p-3 rounded-full w-fit mb-2">
                  <Leaf className="h-8 w-8 text-destructive" />
                </div>
                <CardTitle>8%</CardTitle>
                <CardDescription>
                  Of global emissions come from food waste
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">
            AI That Understands Your Kitchen
          </h2>
          <p className="text-lg text-muted-foreground text-center max-w-2xl mx-auto mb-12">
            Ask questions in plain English. Get actionable insights from your
            transaction data.
          </p>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            <FeatureCard
              icon={<BarChart3 className="h-6 w-6" />}
              title="Demand Forecasting"
              description="Predict busy days, slow periods, and seasonal trends based on your historical data."
              questions={[
                "What days do I regularly overstaff?",
                "Which holidays surprise us every year?",
              ]}
            />
            <FeatureCard
              icon={<ShoppingCart className="h-6 w-6" />}
              title="Inventory Optimization"
              description="Know exactly what to order and when to minimize waste without running out."
              questions={[
                "What ingredients do I consistently over-buy?",
                "What should I buy less of next month?",
              ]}
            />
            <FeatureCard
              icon={<ChefHat className="h-6 w-6" />}
              title="Menu Intelligence"
              description="Understand which items drive profit and which ones hurt your margins."
              questions={[
                "What items sell great but destroy margins?",
                "If I cut one menu item, which one hurts the least?",
              ]}
            />
            <FeatureCard
              icon={<TrendingDown className="h-6 w-6" />}
              title="Spoilage Reduction"
              description="Identify patterns in what spoils most often and when."
              questions={[
                "What items spoil the most, and on which days?",
                "If I reduce beef orders by 8%, what sells out instead?",
              ]}
            />
            <FeatureCard
              icon={<Heart className="h-6 w-6" />}
              title="Donation Planning"
              description="Turn potential waste into community impact with smart donation forecasting."
              questions={[
                "Which days will we likely have surplus food?",
                "How much food could we donate without risk?",
              ]}
            />
            <FeatureCard
              icon={<MessageSquare className="h-6 w-6" />}
              title="Natural Conversations"
              description="No complex dashboards. Just ask questions and get answers."
              questions={[
                "How did weather affect staffing needs last year?",
                "What impact did donating have on waste last month?",
              ]}
            />
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="bg-muted/50 py-20">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
            How It Works
          </h2>
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="text-center">
              <div className="bg-primary text-primary-foreground w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">
                1
              </div>
              <h3 className="text-xl font-semibold mb-2">Connect Your POS</h3>
              <p className="text-muted-foreground">
                Import transaction data from Square, Cisco, and more. We handle
                the integration.
              </p>
            </div>
            <div className="text-center">
              <div className="bg-primary text-primary-foreground w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">
                2
              </div>
              <h3 className="text-xl font-semibold mb-2">Ask Questions</h3>
              <p className="text-muted-foreground">
                Use natural language to ask about trends, predictions, and
                recommendations.
              </p>
            </div>
            <div className="text-center">
              <div className="bg-primary text-primary-foreground w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">
                3
              </div>
              <h3 className="text-xl font-semibold mb-2">Take Action</h3>
              <p className="text-muted-foreground">
                Get actionable insights to reduce waste, optimize orders, and
                increase profits.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">
            Simple, Transparent Pricing
          </h2>
          <p className="text-lg text-muted-foreground text-center max-w-2xl mx-auto mb-12">
            Start with a free trial. No credit card required.
          </p>
          <div className="grid md:grid-cols-2 gap-8 max-w-3xl mx-auto">
            <Card className="relative">
              <CardHeader>
                <CardTitle>Restaurant</CardTitle>
                <CardDescription>
                  For brick-and-mortar locations
                </CardDescription>
                <div className="mt-4">
                  <span className="text-4xl font-bold">$20</span>
                  <span className="text-muted-foreground">/location/month</span>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  <PricingFeature>7-day free trial</PricingFeature>
                  <PricingFeature>AI-powered forecasting</PricingFeature>
                  <PricingFeature>POS integrations</PricingFeature>
                  <PricingFeature>Unlimited questions</PricingFeature>
                  <PricingFeature>Donation coordination</PricingFeature>
                </ul>
              </CardContent>
            </Card>
            <Card className="relative">
              <CardHeader>
                <CardTitle>Food Truck</CardTitle>
                <CardDescription>For mobile food businesses</CardDescription>
                <div className="mt-4">
                  <span className="text-4xl font-bold">$10</span>
                  <span className="text-muted-foreground">/truck/month</span>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  <PricingFeature>7-day free trial</PricingFeature>
                  <PricingFeature>AI-powered forecasting</PricingFeature>
                  <PricingFeature>POS integrations</PricingFeature>
                  <PricingFeature>Unlimited questions</PricingFeature>
                  <PricingFeature>Donation coordination</PricingFeature>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Mission Section */}
      <section className="bg-primary text-primary-foreground py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <Heart className="h-12 w-12 mx-auto mb-6" />
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Our Charitable Mission
            </h2>
            <p className="text-xl opacity-90 mb-8">
              We believe good food shouldn&apos;t go to waste. PantryIQ helps
              coordinate the transfer of surplus food to local organizations
              serving people in need. When you reduce waste, you&apos;re also
              helping feed your community.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <div className="bg-primary-foreground/10 px-6 py-3 rounded-full">
                <span className="font-semibold">Less food in landfills</span>
              </div>
              <div className="bg-primary-foreground/10 px-6 py-3 rounded-full">
                <span className="font-semibold">
                  More meals for those in need
                </span>
              </div>
              <div className="bg-primary-foreground/10 px-6 py-3 rounded-full">
                <span className="font-semibold">
                  Lower environmental impact
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Ready to Reduce Waste and Increase Profits?
            </h2>
            <p className="text-lg text-muted-foreground mb-8">
              Join the waitlist for early access and be among the first to
              transform your restaurant operations.
            </p>
            {isSubmitted ? (
              <div className="bg-primary/10 text-primary p-4 rounded-lg inline-flex items-center gap-2">
                <Check className="h-5 w-5" />
                <span>
                  You&apos;re on the list! We&apos;ll be in touch soon.
                </span>
              </div>
            ) : (
              <form
                onSubmit={handleSubmit}
                className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
                <Input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="flex-1"
                />
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Joining..." : "Join Waitlist"}
                </Button>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-12">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <ChefHat className="h-6 w-6 text-primary" />
              <span className="text-lg font-bold">PantryIQ</span>
            </div>
            <p className="text-sm text-muted-foreground">
              &copy; {new Date().getFullYear()} PantryIQ. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
  questions,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  questions: string[];
}) {
  return (
    <Card>
      <CardHeader>
        <div className="bg-primary/10 p-2 rounded-lg w-fit mb-2">{icon}</div>
        <CardTitle className="text-lg">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {questions.map((question, i) => (
            <div
              key={i}
              className="text-sm bg-muted px-3 py-2 rounded-md text-muted-foreground">
              &ldquo;{question}&rdquo;
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function PricingFeature({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-2">
      <Check className="h-4 w-4 text-primary" />
      <span>{children}</span>
    </li>
  );
}
