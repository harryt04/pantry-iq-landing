'use client'

import { ThemeToggle } from '@/components/theme-toggle'
import { LineChart, RankedBarChart } from '@/components/charts/chart-primitives'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@/components/ui/empty'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Toggle } from '@/components/ui/toggle'

function Section({
  children,
  title,
}: {
  children: React.ReactNode
  title: string
}) {
  return (
    <section className="gallery-section">
      <h2>{title}</h2>
      {children}
    </section>
  )
}

const chartBars = [
  { label: 'Salmon fillet', value: 840, valueLabel: '$840' },
  { label: 'Cream', value: 620, valueLabel: '$620' },
  { label: 'Romaine', value: 420, valueLabel: '$420' },
  { label: 'Bread', value: 240, valueLabel: '$240' },
  { label: 'Limes', value: 110, valueLabel: '$110' },
]

const chartLines = [
  {
    id: 'margin',
    label: 'Margin',
    points: [
      { label: 'Week 1', value: 31, valueLabel: '31%' },
      { label: 'Week 2', value: 34, valueLabel: '34%' },
      { label: 'Week 3', value: 32, valueLabel: '32%' },
      { label: 'Week 4', value: 38, valueLabel: '38%' },
    ],
  },
  {
    id: 'sell-through',
    label: 'Sell-through',
    points: [
      { label: 'Week 1', value: 24, valueLabel: '24%' },
      { label: 'Week 2', value: 28, valueLabel: '28%' },
      { label: 'Week 3', value: 27, valueLabel: '27%' },
      { label: 'Week 4', value: 30, valueLabel: '30%' },
    ],
  },
]

export default function GalleryPage() {
  return (
    <main className="gallery-page">
      <header className="gallery-header">
        <div>
          <p className="gallery-eyebrow">PantryIQ / component baseline</p>
          <h1>Round controls. Square paper.</h1>
          <p>
            Radix handles the behaviour. This gallery keeps the visual rules
            visible while features are built.
          </p>
        </div>
        <ThemeToggle />
      </header>

      <Section title="Controls">
        <div className="gallery-row">
          <Button>Primary action</Button>
          <Button variant="secondary">Secondary action</Button>
          <Button variant="destructive">Archive location</Button>
          <Button variant="ghost">Quiet action</Button>
          <Toggle aria-label="Toggle compact view">Compact view</Toggle>
        </div>
      </Section>

      <Section title="State is more than colour">
        <div className="gallery-row">
          <Badge className="gallery-badge--steady">● Steady</Badge>
          <Badge className="gallery-badge--watch">◆ Watch</Badge>
          <Badge className="gallery-badge--risk">▲ Act now</Badge>
        </div>
        <div className="gallery-card-grid">
          <Card className="state-edge--steady">
            <CardHeader>
              <CardTitle>Stable cost pattern</CardTitle>
              <CardDescription>
                Observed across the last four weeks.
              </CardDescription>
            </CardHeader>
            <CardContent className="figure gallery-figure">
              $2,420.00
            </CardContent>
          </Card>
          <Card className="state-edge--watch">
            <CardHeader>
              <CardTitle>Check this item</CardTitle>
              <CardDescription>
                We need another count to confirm the change.
              </CardDescription>
            </CardHeader>
            <CardContent className="figure gallery-figure">12.4%</CardContent>
          </Card>
          <Card className="state-edge--risk">
            <CardHeader>
              <CardTitle>Waste risk is rising</CardTitle>
              <CardDescription>
                Observed facts are separated from the estimate.
              </CardDescription>
            </CardHeader>
            <CardContent className="figure gallery-figure">$840.00</CardContent>
          </Card>
        </div>
      </Section>

      <Section title="Fields and decisions">
        <div className="gallery-form-grid">
          <div className="gallery-field">
            <Label htmlFor="gallery-name">Location name</Label>
            <Input id="gallery-name" placeholder="Downtown" />
          </div>
          <div className="gallery-field">
            <Label htmlFor="gallery-message">A note for the team</Label>
            <Textarea
              id="gallery-message"
              placeholder="What should we look at?"
            />
          </div>
          <div className="gallery-field">
            <Label htmlFor="gallery-import-type">Import type</Label>
            <Select defaultValue="transactions">
              <SelectTrigger id="gallery-import-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="transactions">Transactions</SelectItem>
                <SelectItem value="orders">Purchase orders</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="gallery-field">
            <p>Include archived items</p>
            <div className="gallery-row">
              <Switch aria-label="Include archived items" />
              <span>Off by default</span>
            </div>
          </div>
          <div className="gallery-field">
            <p>Data source</p>
            <RadioGroup defaultValue="csv" className="gallery-choice-row">
              <div className="gallery-choice-row">
                <RadioGroupItem id="gallery-csv" value="csv" />
                <Label htmlFor="gallery-csv">CSV</Label>
              </div>
              <div className="gallery-choice-row">
                <RadioGroupItem id="gallery-manual" value="manual" />
                <Label htmlFor="gallery-manual">Manual</Label>
              </div>
            </RadioGroup>
          </div>
          <div className="gallery-field">
            <div className="gallery-choice-row">
              <Checkbox id="gallery-mapping" />
              <Label htmlFor="gallery-mapping">I checked the mapping</Label>
            </div>
          </div>
        </div>
      </Section>

      <Section title="Disclosure and progress">
        <Accordion type="single" collapsible className="gallery-surface">
          <AccordionItem value="work">
            <AccordionTrigger>Show your work</AccordionTrigger>
            <AccordionContent>
              Uses imported transactions and purchase orders only.
            </AccordionContent>
          </AccordionItem>
        </Accordion>
        <Alert className="gallery-alert">
          <AlertTitle>Nothing was saved</AlertTitle>
          <AlertDescription>
            Your existing data is untouched while you review the file.
          </AlertDescription>
        </Alert>
        <Progress value={62} aria-label="Import progress: 62 percent" />
      </Section>

      <Section title="Tables, tabs, and loading">
        <Tabs defaultValue="observed">
          <TabsList>
            <TabsTrigger value="observed">Observed</TabsTrigger>
            <TabsTrigger value="predicted">Predicted</TabsTrigger>
          </TabsList>
          <TabsContent value="observed">
            Facts from your imported rows.
          </TabsContent>
          <TabsContent value="predicted">
            Predictions wait for four weeks of history.
          </TabsContent>
        </Tabs>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead className="text-right">Revenue</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell>Lobster pasta</TableCell>
              <TableCell className="figure text-right">$1,280.00</TableCell>
            </TableRow>
          </TableBody>
        </Table>
        <div className="gallery-skeletons">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-20 w-full" />
        </div>
      </Section>

      <Section title="Pattern-first charts">
        <RankedBarChart
          data={chartBars}
          ariaLabel="Estimated avoidable cost by item"
        />
        <LineChart
          series={chartLines}
          ariaLabel="Margin and sell-through by week"
        />
      </Section>

      <Section title="Empty and dialog states">
        <Empty className="gallery-empty">
          <EmptyHeader>
            <EmptyTitle>No imports yet</EmptyTitle>
            <EmptyDescription>
              Start with a CSV export from one location.
            </EmptyDescription>
          </EmptyHeader>
          <Button>Import a CSV</Button>
        </Empty>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline">Open confirmation</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Archive Downtown?</DialogTitle>
              <DialogDescription>
                Its existing data stays available for audit.
              </DialogDescription>
            </DialogHeader>
            <Button variant="destructive">Archive location</Button>
          </DialogContent>
        </Dialog>
      </Section>
    </main>
  )
}
