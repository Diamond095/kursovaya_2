import { useState, useEffect } from "react"
import { Layout } from "@/components/layout"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts"
import { AlertTriangle, TrendingDown, Wallet, Plus, CreditCard, Loader2 } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "@/hooks/use-toast"


const createBudgetService = () => {
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

    getBudgetData() {
      return this.request('/budget')
    },

    setBudgetLimit(data) {
      return this.request('/budget', {
        method: 'POST',
        body: JSON.stringify(data),
      })
    },

    updateTotalBudget(amount) {
      return this.request('/budget/total', {
        method: 'PUT',
        body: JSON.stringify({ monthly_budget: amount }),
      })
    },

    getCategories() {
      return this.request('/budget/categories')
    },

    getTransactions(params = {}) {
      const queryParams = new URLSearchParams()
      Object.entries(params).forEach(([key, value]) => {
        if (value && value !== 'all' && value !== null) {
          queryParams.append(key, value)
        }
      })
      
      const queryString = queryParams.toString()
      const endpoint = `/budget/transactions${queryString ? `?${queryString}` : ''}`
      return this.request(endpoint)
    },

    getAnalytics(params = {}) {
      const queryParams = new URLSearchParams()
      Object.entries(params).forEach(([key, value]) => {
        if (value && value !== 'all' && value !== null) {
          queryParams.append(key, value)
        }
      })
      
      const queryString = queryParams.toString()
      const endpoint = `/budget/analytics${queryString ? `?${queryString}` : ''}`
      return this.request(endpoint)
    },
  }
}

const budgetService = createBudgetService()

export default function Budget() {
  const [open, setOpen] = useState(false)
  const [formData, setFormData] = useState({
    category_id: null,
    name: "",
    limit_amount: "",
    period: "monthly",
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
  })

  const [budget, setBudget] = useState({})
  const [categories, setCategories] = useState([])
  const [chartData, setChartData] = useState([])
  const [alerts, setAlerts] = useState([])
  const [budgetCategories, setBudgetCategories] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
    loadBudgetData()
  }, [])

  const loadBudgetData = async () => {
    setIsLoading(true)
    setHasError(false)
    try {
      const data = await budgetService.getBudgetData()
      setBudget(data.data || {})
      setCategories(data.data?.categories || [])
      setChartData(data.data?.chart_data || [])
      setAlerts(data.data?.alerts || [])
      
      // Загружаем категории отдельно
      await loadCategories()
    } catch (error) {
      setHasError(true)
      toast({
        title: "Ошибка",
        description: "Не удалось загрузить данные бюджета",
        variant: "destructive",
      })
      console.error(error)
    } finally {
      setIsLoading(false)
    }
  }

  const loadCategories = async () => {
    try {
      const data = await budgetService.getCategories()
      setBudgetCategories(data.data || [])
    } catch (error) {
      console.error('Ошибка загрузки категорий:', error)
    }
  }

  const handleSaveBudget = async () => {
    if (!formData.limit_amount) {
      toast({
        title: "Ошибка",
        description: "Введите сумму лимита",
        variant: "destructive",
      })
      return
    }

    setIsSaving(true)
    try {
      await budgetService.setBudgetLimit(formData)
      
      await loadBudgetData()
      
      toast({
        title: "Успешно!",
        description: "Лимит бюджета сохранен",
      })
      
      setOpen(false)
      setFormData({
        category_id: null,
        name: "",
        limit_amount: "",
        period: "monthly",
        year: new Date().getFullYear(),
        month: new Date().getMonth() + 1,
      })
    } catch (error) {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось сохранить бюджет",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleUpdateTotalBudget = async (amount) => {
    try {
      await budgetService.updateTotalBudget(amount)
      await loadBudgetData()
      toast({
        title: "Успешно!",
        description: "Общий бюджет обновлен",
      })
    } catch (error) {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось обновить бюджет",
        variant: "destructive",
      })
    }
  }

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
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
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold tracking-tight">Бюджетирование</h2>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                Настроить лимит
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Настройка бюджета</DialogTitle>
                <DialogDescription>
                  Установите месячный лимит расходов для категорий или общий бюджет.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="category" className="text-right">
                    Категория
                  </Label>
                  <Select 
                    value={formData.category_id || "all"} 
                    onValueChange={(value) => handleInputChange('category_id', value === "all" ? null : parseInt(value))}
                  >
                    <SelectTrigger className="col-span-3">
                      <SelectValue placeholder="Выберите категорию" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Общий бюджет</SelectItem>
                      {budgetCategories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id?.toString() || "uncategorized"}>
                          {cat.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="amount" className="text-right">
                    Лимит ({budget?.currency || 'USD'})
                  </Label>
                  <Input
                    id="amount"
                    value={formData.limit_amount}
                    onChange={(e) => handleInputChange('limit_amount', e.target.value)}
                    className="col-span-3"
                    type="number"
                    placeholder="0.00"
                    step="0.01"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="period" className="text-right">
                    Период
                  </Label>
                  <Select 
                    value={formData.period} 
                    onValueChange={(value) => handleInputChange('period', value)}
                  >
                    <SelectTrigger className="col-span-3">
                      <SelectValue placeholder="Период списания" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Ежемесячно</SelectItem>
                      <SelectItem value="yearly">Ежегодно</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)} disabled={isSaving}>
                  Отмена
                </Button>
                <Button 
                  onClick={handleSaveBudget} 
                  disabled={isSaving || !formData.limit_amount}
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  Сохранить
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="md:col-span-2 shadow-sm border-primary/20 bg-gradient-to-br from-card to-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="w-5 h-5 text-primary" />
                Общий бюджет на {budget?.current_month || 'Текущий месяц'}
              </CardTitle>
              <CardDescription>Осталось {budget?.currency || '$'}{budget?.remaining || 0} до лимита</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-end">
                  <div>
                    <span className="text-4xl font-bold font-mono">{budget?.currency || '$'}{budget?.current_spent || 0}</span>
                    <span className="text-muted-foreground ml-2">/ {budget?.currency || '$'}{budget?.total_budget || 0}</span>
                  </div>
                  <Badge variant="outline" className={`${budget?.percentage >= 90 ? 'text-red-600 border-red-200 bg-red-50' : 'text-emerald-600 border-emerald-200 bg-emerald-50'}`}>
                    {budget?.percentage >= 90 ? 'Превышение' : 'В пределах нормы'}
                  </Badge>
                </div>
                <Progress value={budget?.percentage || 0} className="h-3" />
                <p className="text-sm text-muted-foreground">
                  Вы потратили {budget?.percentage?.toFixed(1) || 0}% от вашего месячного бюджета.
                </p>
              </div>
            </CardContent>
          </Card>

          {alerts.length > 0 ? (
            <Card className="shadow-sm border-amber-200 bg-amber-50/50 dark:bg-amber-950/10">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-500">
                  <AlertTriangle className="w-5 h-5" />
                  Внимание
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Ваши расходы на категорию <strong>"{alerts[0].category}"</strong> 
                  приближаются к установленному лимиту ({alerts[0].percentage?.toFixed(1)}%).
                </p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full border-amber-200 text-amber-700 hover:bg-amber-100 hover:text-amber-800 dark:border-amber-800 dark:text-amber-500 dark:hover:bg-amber-900/50"
                  onClick={() => setOpen(true)}
                >
                  Пересмотреть лимиты
                </Button>
              </CardContent>
            </Card>
          ) : null}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Лимиты по категориям</CardTitle>
              <CardDescription>Расход vs Бюджет</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {categories.map((cat, i) => (
                <div key={i} className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full`} style={{ backgroundColor: cat.color || '#3B82F6' }} />
                      {cat.name}
                    </span>
                    <span className="font-mono text-muted-foreground">
                      {budget?.currency || '$'}{cat.spent} / {budget?.currency || '$'}{cat.limit}
                    </span>
                  </div>
                  <Progress value={cat.percentage || 0} className="h-2" />
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Структура расходов</CardTitle>
            </CardHeader>
            <CardContent className="h-[300px] flex items-center justify-center">
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value) => [`${budget?.currency || '$'}${value}`, 'Сумма']}
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--popover))', 
                        borderColor: 'hsl(var(--border))',
                        borderRadius: 'var(--radius)' 
                      }} 
                      itemStyle={{ color: 'hsl(var(--popover-foreground))' }}
                    />
                    <Legend verticalAlign="bottom" height={36}/>
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center text-muted-foreground">
                  <CreditCard className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Нет данных для отображения</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  )
}