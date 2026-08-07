'use client'

import { useEffect, useState } from 'react'
import { Building2, ShoppingCart, Upload as UploadIcon } from 'lucide-react'
import { useSession } from '@/lib/auth-client'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { ImportStatusCard } from '@/components/dashboard/import-status-card'
import { LocationOverviewCard } from '@/components/dashboard/location-overview-card'
import { QuickActionsCard } from '@/components/dashboard/quick-actions-card'
import { RecommendationAlertsCard } from '@/components/dashboard/recommendation-alerts-card'
import type { Recommendation } from '@/lib/recommendations/engine'

interface DashboardData {
  locations: Array<{
    id: string
    name: string
    type: string
    transactionCount: number
    csvUploadCount: number
    posConnectionStatus: string | null
    conversationId: string | null
  }>
  recentCsvUploads: Array<{
    id: string
    filename: string
    status: string
    uploadedAt: Date
    locationName: string
    locationId: string
    errorDetails: string | null
  }>
  totalLocations: number
  totalTransactions: number
  selectedLocationId: string | null
  walletImpact: number
  historyWeeks: number
  recommendations: Recommendation[]
}

interface PosConnection {
  locationId: string
  locationName: string
  syncState: string
  lastSync: Date | null
}

export default function DashboardPage() {
  const { data: session, isPending: isSessionPending } = useSession()
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!session?.user) {
      return
    }

    const fetchDashboardData = async () => {
      try {
        const response = await fetch('/api/dashboard')
        if (!response.ok) {
          throw new Error('Failed to fetch dashboard data')
        }
        const data = await response.json()
        setDashboardData(data)
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
        console.error('Error fetching dashboard data:', err)
      }
    }

    fetchDashboardData()
  }, [session?.user])

  if (isSessionPending) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="bg-muted h-10 w-32 rounded" />
        </div>
      </div>
    )
  }

  if (!session?.user) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-2">
            Please log in to view your dashboard.
          </p>
        </div>
      </div>
    )
  }

  if (error && !dashboardData) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="bg-destructive/10 border-destructive/20 rounded-lg border p-4">
              <p className="text-destructive text-sm font-medium">{error}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!dashboardData) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="bg-muted mb-4 h-10 w-32 rounded" />
          <div className="bg-muted h-6 w-64 rounded" />
        </div>
      </div>
    )
  }

  const stats = [
    {
      label: 'Total Locations',
      value: dashboardData.totalLocations,
      icon: Building2,
    },
    {
      label: 'Total Transactions',
      value: dashboardData.totalTransactions,
      icon: ShoppingCart,
    },
    {
      label: 'Recent Uploads',
      value: dashboardData.recentCsvUploads.length,
      icon: UploadIcon,
    },
  ]

  // Build POS connections from locations
  const posConnections: PosConnection[] = dashboardData.locations
    .filter((loc) => loc.posConnectionStatus)
    .map((loc) => ({
      locationId: loc.id,
      locationName: loc.name,
      syncState: loc.posConnectionStatus || 'pending',
      lastSync: null,
    }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Overview of your inventory and import activity.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <Card key={stat.label}>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Icon className="text-primary h-5 w-5" />
                  <CardTitle className="text-sm font-medium">
                    {stat.label}
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <RecommendationAlertsCard
            recommendations={dashboardData.recommendations}
            walletImpact={dashboardData.walletImpact}
            historyWeeks={dashboardData.historyWeeks}
            locationId={dashboardData.selectedLocationId}
            conversationId={
              dashboardData.locations.find(
                (location) => location.id === dashboardData.selectedLocationId,
              )?.conversationId
            }
          />
          <LocationOverviewCard locations={dashboardData.locations} />
          <ImportStatusCard
            csvUploads={dashboardData.recentCsvUploads}
            posConnections={posConnections}
          />
        </div>

        <div>
          <QuickActionsCard hasLocations={dashboardData.totalLocations > 0} />
        </div>
      </div>
    </div>
  )
}
