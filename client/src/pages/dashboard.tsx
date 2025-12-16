import { useState, useEffect } from "react"
import { Layout } from "@/components/layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowUpRight, ArrowDownRight, TrendingUp, Calendar, CreditCard, Loader2, AlertTriangle } from "lucide-react"
import { Area, AreaChart, CartesianGrid, XAxis, ResponsiveContainer, Tooltip } from "recharts"


const createDashboardService = () => {
  const API_BASE = 'http://localhost:8000/api'
  
  return {
    async request(endpoint, options = {}) {
      try {
        const url = `${API_BASE}${endpoint}`
        const response = await fetch(url, {
          headers: {
            'Content-Type': 'application/json',
            ...options.headers,
          },
          ...options,
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.message || `Ошибка ${response.status}`)
        }

        return await response.json()
      } catch (error) {
        console.error('API Error:', error)
        throw error
      }
    },

    getDashboardData() {
      return this.request('/dashboard')
    },

    getNotifications() {
      return this.request('/dashboard/notifications')
    },

    getSummary(period) {
      const queryParams = new URLSearchParams()
      if (period) {
        queryParams.append('period', period)
      }
      
      const queryString = queryParams.toString()
      const endpoint = `/dashboard/summary${queryString ? `?${queryString}` : ''}`
      return this.request(endpoint)
    },
  }
}

const dashboardService = createDashboardService()

export default function Dashboard() {
  const [dashboard, setDashboard] = useState({})
  const [stats, setStats] = useState({})
  const [monthlyExpenses, setMonthlyExpenses] = useState([])
  const [upcomingPayments, setUpcomingPayments] = useState([])
  const [currency, setCurrency] = useState('$')
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
    loadDashboardData()
    
    const intervalId = setInterval(() => {
      loadDashboardData()
    }, 300000)

    return () => clearInterval(intervalId)
  }, [])

  const loadDashboardData = async () => {
    try {
      const data = await dashboardService.getDashboardData()
      setDashboard(data.data || {})
      setStats(data.data?.stats || {})
      setMonthlyExpenses(data.data?.monthly_expenses || [])
      setUpcomingPayments(data.data?.upcoming_payments || [])
      setCurrency(data.data?.currency || '$')
      setHasError(false)
    } catch (error) {
      setHasError(true)
      console.error('Ошибка загрузки данных дашборда:', error)
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    )
  }

  if (hasError) {
    return (
      <Layout>
        <div className="text-center py-10">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold">Ошибка загрузки данных</h3>
          <p className="text-muted-foreground">Попробуйте обновить страницу</p>
          <Button 
            onClick={loadDashboardData}
            className="mt-4"
            variant="outline"
          >
            Обновить
          </Button>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Общий расход (мес)
              </CardTitle>
              <CreditCard className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-mono">
                {currency}{stats.monthly_spent?.current?.toFixed(2) || '0.00'}
              </div>
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                <span className={`${stats.monthly_spent?.change_direction === 'up' ? 'text-emerald-500' : 'text-rose-500'} flex items-center`}>
                  {stats.monthly_spent?.change_direction === 'up' ? (
                    <ArrowUpRight className="h-3 w-3" />
                  ) : (
                    <ArrowDownRight className="h-3 w-3" />
                  )}
                  {stats.monthly_spent?.change_percent > 0 ? '+' : ''}
                  {stats.monthly_spent?.change_percent?.toFixed(1) || '0.0'}%
                </span>
                с прошлого месяца
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Активные подписки
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-mono">
                {stats.active_subscriptions?.count || 0}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.active_subscriptions?.upcoming_this_week || 0} сервис(а) обновляется на этой неделе
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Средний чек
              </CardTitle>
              <Calendar className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-mono">
                {currency}{stats.average_check?.amount?.toFixed(2) || '0.00'}
              </div>
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                <span className="text-rose-500 flex items-center">
                  <ArrowDownRight className="h-3 w-3" /> -1.2%
                </span>
                оптимизация
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2 shadow-sm">
            <CardHeader>
              <CardTitle>Динамика расходов</CardTitle>
            </CardHeader>
            <CardContent className="h-[300px]">
              {monthlyExpenses.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={monthlyExpenses}>
                    <defs>
                      <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis 
                      dataKey="name" 
                      stroke="hsl(var(--muted-foreground))" 
                      fontSize={12} 
                      tickLine={false} 
                      axisLine={false} 
                    />
                    <Tooltip 
                      formatter={(value) => [`${currency}${value.toFixed(2)}`, 'Сумма']}
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--popover))', 
                        borderColor: 'hsl(var(--border))',
                        borderRadius: 'var(--radius)' 
                      }} 
                      itemStyle={{ color: 'hsl(var(--popover-foreground))' }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="total" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2}
                      fillOpacity={1} 
                      fill="url(#colorTotal)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <Calendar className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>Нет данных для отображения</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Ближайшие списания</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {upcomingPayments.length > 0 ? (
                  upcomingPayments.map((item, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors group">
                      <div className="flex items-center gap-3">
                        {item.logo_url ? (
                          <div className="w-10 h-10 rounded-full bg-white border border-border overflow-hidden">
                            <img 
                              src={item.logo_url} 
                              alt={item.name} 
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.target.style.display = 'none'
                                e.target.parentElement.innerHTML = `
                                  <div class="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold group-hover:scale-110 transition-transform">
                                    ${item.name?.charAt(0).toUpperCase() || '?'}
                                  </div>
                                `
                              }}
                            />
                          </div>
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold group-hover:scale-110 transition-transform">
                            {item.name?.charAt(0).toUpperCase() || '?'}
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-sm">{item.name}</p>
                          <p className="text-xs text-muted-foreground">{item.date}</p>
                        </div>
                      </div>
                      <div className="font-mono font-medium text-sm">
                        {currency}{item.amount}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <CreditCard className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>Нет предстоящих списаний</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  )
}