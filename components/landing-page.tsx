'use client'

import { useState, useRef, useEffect } from 'react'
import posthog from 'posthog-js'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
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
} from 'lucide-react'

export function LandingPage() {
  const [email, setEmail] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      const response = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to subscribe')
      }

      // Identify user and capture successful submission
      posthog.identify(email, { email })
      posthog.capture('waitlist-form-submitted', { email })

      setIsSubmitted(true)
      setEmail('')
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Something went wrong'
      posthog.capture('waitlist-form-error', {
        error: errorMessage,
      })
      setError(errorMessage)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="bg-background min-h-screen">
      {/* Navigation */}
      <nav className="border-border border-b">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            <ChefHat className="text-primary h-8 w-8" />
            <span className="text-2xl font-bold">PantryIQ</span>
          </div>
          <Button variant="outline" asChild>
            <a
              href="#notify"
              onClick={() => posthog.capture('early-access-link-clicked')}
            >
              Get Early Access
            </a>
          </Button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 lg:py-32">
        <div className="mx-auto max-w-4xl text-center">
          <div className="bg-primary/10 text-primary mb-6 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium">
            <Sparkles className="h-4 w-4" />
            AI-Powered Restaurant Intelligence
          </div>
          <h1 className="mb-6 text-4xl font-bold tracking-tight md:text-6xl">
            Stop Over-Ordering.{' '}
            <span className="text-primary">Reduce Spoilage.</span> Increase
            Profits.
          </h1>
          <p className="text-muted-foreground mx-auto mb-8 max-w-2xl text-xl">
            Our restaurant forecasting software uses AI to minimize food waste,
            optimize inventory, and help donate surplus to those in need.
          </p>

          {/* Email Signup */}
          <div id="notify" className="mx-auto max-w-md">
            {isSubmitted ? (
              <div className="bg-primary/10 text-primary flex items-center justify-center gap-2 rounded-lg p-4">
                <Check className="h-5 w-5" />
                <span>Thanks! We&apos;ll notify you when we launch.</span>
              </div>
            ) : (
              <form
                onSubmit={handleSubmit}
                className="flex flex-col gap-3 sm:flex-row"
              >
                <Input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="flex-1"
                />
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Joining...' : 'Get Early Access'}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </form>
            )}
            {error && <p className="text-destructive mt-2 text-sm">{error}</p>}
            <p className="text-muted-foreground mt-3 text-sm">
              Join the waitlist for exclusive early access and launch pricing.
            </p>
          </div>
        </div>
      </section>

      {/* Problem Section */}
      <section className="bg-muted/50 py-20">
        <div className="container mx-auto px-4">
          <h2 className="mb-4 text-center text-3xl font-bold md:text-4xl">
            The Food Waste Problem
          </h2>
          <p className="text-muted-foreground mx-auto mb-12 max-w-2xl text-center text-lg">
            Restaurants lose thousands every month to over-ordering, spoilage,
            and poor demand forecasting. Meanwhile, perfectly good food ends up
            in landfills.
          </p>
          <div className="mx-auto grid max-w-5xl gap-8 md:grid-cols-3">
            <Card className="text-center">
              <CardHeader>
                <div className="bg-destructive/10 mx-auto mb-2 w-fit rounded-full p-3">
                  <TrendingDown className="text-destructive h-8 w-8" />
                </div>
                <CardTitle>$162 Billion</CardTitle>
                <CardDescription>
                  Annual food waste cost in US restaurants
                </CardDescription>
              </CardHeader>
            </Card>
            <Card className="text-center">
              <CardHeader>
                <div className="bg-destructive/10 mx-auto mb-2 w-fit rounded-full p-3">
                  <ShoppingCart className="text-destructive h-8 w-8" />
                </div>
                <CardTitle>4-10%</CardTitle>
                <CardDescription>
                  Average food waste as percentage of food purchased
                </CardDescription>
              </CardHeader>
            </Card>
            <Card className="text-center">
              <CardHeader>
                <div className="bg-destructive/10 mx-auto mb-2 w-fit rounded-full p-3">
                  <Leaf className="text-destructive h-8 w-8" />
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
          <h2 className="mb-4 text-center text-3xl font-bold md:text-4xl">
            AI That Understands Your Kitchen
          </h2>
          <p className="text-muted-foreground mx-auto mb-12 max-w-2xl text-center text-lg">
            Ask questions in plain English. Get actionable insights from your
            transaction data.
          </p>
          <div className="mx-auto grid max-w-6xl gap-6 md:grid-cols-2 lg:grid-cols-3">
            <FeatureCard
              icon={<BarChart3 className="h-6 w-6" />}
              title="Demand Forecasting"
              description="Predict busy days, slow periods, and seasonal trends based on your historical data."
              questions={[
                'What days do I regularly overstaff?',
                'Which holidays surprise us every year?',
              ]}
            />
            <FeatureCard
              icon={<ShoppingCart className="h-6 w-6" />}
              title="Inventory Optimization"
              description="Know exactly what to order and when to minimize waste without running out."
              questions={[
                'What ingredients do I consistently over-buy?',
                'What should I buy less of next month?',
              ]}
            />
            <FeatureCard
              icon={<ChefHat className="h-6 w-6" />}
              title="Menu Intelligence"
              description="Understand which items drive profit and which ones hurt your margins."
              questions={[
                'What items sell great but destroy margins?',
                'If I cut one menu item, which one hurts the least?',
              ]}
            />
            <FeatureCard
              icon={<TrendingDown className="h-6 w-6" />}
              title="Spoilage Reduction"
              description="Identify patterns in what spoils most often and when."
              questions={[
                'What items spoil the most, and on which days?',
                'If I reduce beef orders by 8%, what sells out instead?',
              ]}
            />
            <FeatureCard
              icon={<Heart className="h-6 w-6" />}
              title="Donation Planning"
              description="Turn potential waste into community impact with smart donation forecasting."
              questions={[
                'Which days will we likely have surplus food?',
                'How much food could we donate without risk?',
              ]}
            />
            <FeatureCard
              icon={<MessageSquare className="h-6 w-6" />}
              title="Natural Conversations"
              description="No complex dashboards. Just ask questions and get answers."
              questions={[
                'How did weather affect staffing needs last year?',
                'What impact did donating have on waste last month?',
              ]}
            />
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="bg-muted/50 py-20">
        <div className="container mx-auto px-4">
          <h2 className="mb-12 text-center text-3xl font-bold md:text-4xl">
            How It Works
          </h2>
          <div className="mx-auto grid max-w-4xl gap-8 md:grid-cols-3">
            <div className="text-center">
              <div className="bg-primary text-primary-foreground mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full text-xl font-bold">
                1
              </div>
              <h3 className="mb-2 text-xl font-semibold">Connect Your POS</h3>
              <p className="text-muted-foreground">
                Import transaction data from Square, Cisco, and more. We handle
                the integration.
              </p>
            </div>
            <div className="text-center">
              <div className="bg-primary text-primary-foreground mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full text-xl font-bold">
                2
              </div>
              <h3 className="mb-2 text-xl font-semibold">Ask Questions</h3>
              <p className="text-muted-foreground">
                Use natural language to ask about trends, predictions, and
                recommendations.
              </p>
            </div>
            <div className="text-center">
              <div className="bg-primary text-primary-foreground mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full text-xl font-bold">
                3
              </div>
              <h3 className="mb-2 text-xl font-semibold">Take Action</h3>
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
          <h2 className="mb-4 text-center text-3xl font-bold md:text-4xl">
            Simple, Transparent Pricing
          </h2>
          <p className="text-muted-foreground mx-auto mb-12 max-w-2xl text-center text-lg">
            Start with a free trial. No credit card required.
          </p>
          <div className="mx-auto grid max-w-3xl gap-8 md:grid-cols-2">
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
          <div className="mx-auto max-w-3xl text-center">
            <Heart className="mx-auto mb-6 h-12 w-12" />
            <h2 className="mb-4 text-3xl font-bold md:text-4xl">
              Our Charitable Mission
            </h2>
            <p className="mb-8 text-xl opacity-90">
              We believe good food shouldn&apos;t go to waste. PantryIQ helps
              coordinate the transfer of surplus food to local organizations
              serving people in need. When you reduce waste, you&apos;re also
              helping feed your community.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <div className="bg-primary-foreground/10 rounded-full px-6 py-3">
                <span className="font-semibold">Less food in landfills</span>
              </div>
              <div className="bg-primary-foreground/10 rounded-full px-6 py-3">
                <span className="font-semibold">
                  More meals for those in need
                </span>
              </div>
              <div className="bg-primary-foreground/10 rounded-full px-6 py-3">
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
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="mb-4 text-3xl font-bold md:text-4xl">
              Ready to Reduce Waste and Increase Profits?
            </h2>
            <p className="text-muted-foreground mb-8 text-lg">
              Join the waitlist for early access and be among the first to
              transform your restaurant operations.
            </p>
            {isSubmitted ? (
              <div className="bg-primary/10 text-primary inline-flex items-center gap-2 rounded-lg p-4">
                <Check className="h-5 w-5" />
                <span>
                  You&apos;re on the list! We&apos;ll be in touch soon.
                </span>
              </div>
            ) : (
              <form
                onSubmit={handleSubmit}
                className="mx-auto flex max-w-md flex-col gap-3 sm:flex-row"
              >
                <Input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="flex-1"
                />
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Joining...' : 'Join Waitlist'}
                </Button>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-border border-t py-12">
        <div className="container mx-auto px-4">
          <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
            <div className="flex items-center gap-2">
              <ChefHat className="text-primary h-6 w-6" />
              <span className="text-lg font-bold">PantryIQ</span>
            </div>
            <p className="text-muted-foreground text-sm">
              &copy; {new Date().getFullYear()} PantryIQ. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}

function FeatureCard({
  icon,
  title,
  description,
  questions,
}: {
  icon: React.ReactNode
  title: string
  description: string
  questions: string[]
}) {
  return (
    <Card>
      <CardHeader>
        <div className="bg-primary/10 mb-2 w-fit rounded-lg p-2">{icon}</div>
        <CardTitle className="text-lg">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {questions.map((question, i) => (
            <div
              key={i}
              className="bg-muted text-muted-foreground rounded-md px-3 py-2 text-sm"
            >
              &ldquo;{question}&rdquo;
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function PricingFeature({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-2">
      <Check className="text-primary h-4 w-4" />
      <span>{children}</span>
    </li>
  )
}
