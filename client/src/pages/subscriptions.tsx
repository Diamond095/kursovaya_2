import { useState, useEffect } from "react"
import { Layout } from "@/components/layout"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { MoreHorizontal, ExternalLink, Plus, Filter, SortAsc, Loader2 } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { toast } from "@/hooks/use-toast"
import { format } from "date-fns"

const createApiService = () => {
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

    getSubscriptions(params = {}) {
      const queryParams = new URLSearchParams()
      Object.entries(params).forEach(([key, value]) => {
        if (value && value !== 'all' && value !== null) {
          queryParams.append(key, value)
        }
      })
      
      const queryString = queryParams.toString()
      const endpoint = `/subscriptions${queryString ? `?${queryString}` : ''}`
      return this.request(endpoint)
    },

    createSubscription(data) {
      return this.request('/subscriptions', {
        method: 'POST',
        body: JSON.stringify(data),
      })
    },

    deleteSubscription(id) {
      return this.request(`/subscriptions/${id}`, {
        method: 'DELETE',
      })
    },

    toggleStatus(id) {
      return this.request(`/subscriptions/${id}/toggle-status`, {
        method: 'POST',
      })
    },

    getCategories() {
      return this.request('/subscriptions/categories')
    },
  }
}

const subscriptionService = createApiService()

export default function Subscriptions() {
  const [filters, setFilters] = useState({
    status: 'all',
    search: '',
    sort_by: 'next_payment_date',
    sort_order: 'asc',
  })

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [newSubscription, setNewSubscription] = useState({
    name: '',
    plan_name: '',
    price: '',
    billing_cycle: 'monthly',
    next_payment_date: format(new Date(), 'yyyy-MM-dd'),
    category_id: null,
    description: '',
    logo_url: '',
    is_auto_renew: true,
    status: 'active',
  })

  const [subscriptions, setSubscriptions] = useState([])
  const [stats, setStats] = useState({})
  const [categories, setCategories] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isToggling, setIsToggling] = useState(false)

  useEffect(() => {
    loadSubscriptions()
    loadCategories()
  }, [filters])

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };


const sortSubscriptions = (subscriptionsList, sortBy, sortOrder) => {
  const sorted = [...subscriptionsList];
  
  sorted.sort((a, b) => {
    let valueA, valueB;
    
    switch (sortBy) {
      case 'name':
        valueA = a.name?.toLowerCase() || '';
        valueB = b.name?.toLowerCase() || '';
        return sortOrder === 'asc' 
          ? valueA.localeCompare(valueB)
          : valueB.localeCompare(valueA);
      
      case 'price':
        valueA = parseFloat(a.price) || 0;
        valueB = parseFloat(b.price) || 0;
        return sortOrder === 'asc' 
          ? valueA - valueB
          : valueB - valueA;
      
      case 'next_payment_date':
        valueA = a.nextPayment ? new Date(a.nextPayment).getTime() : 0;
        valueB = b.nextPayment ? new Date(b.nextPayment).getTime() : 0;
        return sortOrder === 'asc' 
          ? valueA - valueB
          : valueB - valueA;
      
      default:
        valueA = a.nextPayment ? new Date(a.nextPayment).getTime() : 0;
        valueB = b.nextPayment ? new Date(b.nextPayment).getTime() : 0;
        return sortOrder === 'asc' 
          ? valueA - valueB
          : valueB - valueA;
    }
  });
  
  return sorted;
};
  const loadSubscriptions = async () => {
    setIsLoading(true)
    try {
      const data = await subscriptionService.getSubscriptions(filters)
      setSubscriptions(data.data?.subscriptions || [])
      setStats(data.data?.stats || {})
    } catch (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось загрузить подписки",
        variant: "destructive",
      })
      console.error(error)
    } finally {
      setIsLoading(false)
    }
  }

  const loadCategories = async () => {
    try {
      const data = await subscriptionService.getCategories()
      setCategories(data.data || [])
    } catch (error) {
      console.error('Ошибка загрузки категорий:', error)
    }
  }

  const handleCreateSubscription = async () => {
    setIsCreating(true)
    try {
      await subscriptionService.createSubscription(newSubscription)

      await loadSubscriptions()
      

      setNewSubscription({
        name: '',
        plan_name: '',
        price: '',
        billing_cycle: 'monthly',
        next_payment_date: format(new Date(), 'yyyy-MM-dd'),
        category_id: null,
        description: '',
        logo_url: '',
        is_auto_renew: true,
        status: 'active',
      })
      
      setIsAddDialogOpen(false)
      toast({
        title: "Успешно!",
        description: "Подписка создана",
      })
    } catch (error) {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось создать подписку",
        variant: "destructive",
      })
    } finally {
      setIsCreating(false)
    }
  }

  const handleDeleteSubscription = async (id) => {
    if (!window.confirm('Вы уверены, что хотите удалить эту подписку?')) return

    setIsDeleting(true)
    try {
      await subscriptionService.deleteSubscription(id)
      
      await loadSubscriptions()
      
      toast({
        title: "Успешно!",
        description: "Подписка удалена",
      })
    } catch (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось удалить подписку",
        variant: "destructive",
      })
    } finally {
      setIsDeleting(false)
    }
  }

  const handleToggleStatus = async (id) => {
    setIsToggling(true)
    try {
      await subscriptionService.toggleStatus(id)

      await loadSubscriptions()
      
      toast({
        title: "Успешно!",
        description: "Статус подписки изменен",
      })
    } catch (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось изменить статус",
        variant: "destructive",
      })
    } finally {
      setIsToggling(false)
    }
  }

  const getStatusBadge = (status, isActive) => {
    if (!isActive) {
      return (
        <Badge variant="secondary" className="bg-gray-100 text-gray-600 hover:bg-gray-200 border-gray-200">
          Неактивна
        </Badge>
      )
    }

    switch (status) {
      case 'active':
        return (
          <Badge variant="default" className="bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/25 border-emerald-200">
            Активна
          </Badge>
        )
      case 'paused':
        return (
          <Badge variant="outline" className="text-amber-600 border-amber-200">
            Приостановлена
          </Badge>
        )
      case 'cancelled':
        return (
          <Badge variant="outline" className="text-red-600 border-red-200">
            Отменена
          </Badge>
        )
      default:
        return (
          <Badge variant="outline">
            {status}
          </Badge>
        )
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

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Ваши подписки</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {stats.total || 0} подписок • {stats.active || 0} активных • ${stats.monthly_cost?.toFixed(2) || '0.00'}/мес
            </p>
          </div>
          <div className="flex gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Filter className="w-4 h-4" />
                  Фильтр
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56">
                <DropdownMenuLabel>Статус</DropdownMenuLabel>
                <Select
                  value={filters.status}
                  onValueChange={(value) => handleFilterChange('status', value)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Все статусы" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Все</SelectItem>
                    <SelectItem value="active">Активные</SelectItem>
                    <SelectItem value="paused">Приостановленные</SelectItem>
                    <SelectItem value="cancelled">Отмененные</SelectItem>
                  </SelectContent>
                </Select>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Категория</DropdownMenuLabel>
                <Select
                  value={filters.category_id || 'all'}
                  onValueChange={(value) => handleFilterChange('category_id', value === 'all' ? null : parseInt(value))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Все категории" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Все категории</SelectItem>
                    {categories.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value?.toString() || "uncategorized"}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <SortAsc className="w-4 h-4" />
                  Сортировка
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem
                  onClick={() => handleFilterChange('sort_by', 'next_payment_date')}
                >
                  По дате списания
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleFilterChange('sort_by', 'price')}
                >
                  По цене
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleFilterChange('sort_by', 'name')}
                >
                  По названию
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="w-4 h-4" />
                  Добавить
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>Добавить подписку</DialogTitle>
                  <DialogDescription>
                    Введите информацию о новой подписке
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Название *</Label>
                      <Input
                        id="name"
                        value={newSubscription.name}
                        onChange={(e) => setNewSubscription(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="Netflix, Spotify и т.д."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="plan">Тариф</Label>
                      <Input
                        id="plan"
                        value={newSubscription.plan_name}
                        onChange={(e) => setNewSubscription(prev => ({ ...prev, plan_name: e.target.value }))}
                        placeholder="Premium, Basic и т.д."
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="price">Цена *</Label>
                      <Input
                        id="price"
                        type="number"
                        step="0.01"
                        value={newSubscription.price}
                        onChange={(e) => setNewSubscription(prev => ({ ...prev, price: e.target.value }))}
                        placeholder="0.00"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="billing">Цикл оплаты *</Label>
                      <Select
                        value={newSubscription.billing_cycle}
                        onValueChange={(value) => setNewSubscription(prev => ({ ...prev, billing_cycle: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Выберите цикл" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="monthly">Ежемесячно</SelectItem>
                          <SelectItem value="yearly">Ежегодно</SelectItem>
                          <SelectItem value="weekly">Еженедельно</SelectItem>
                          <SelectItem value="quarterly">Квартально</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="next_payment">Следующее списание *</Label>
                    <Input
                      id="next_payment"
                      type="date"
                      value={newSubscription.next_payment_date}
                      onChange={(e) => setNewSubscription(prev => ({ ...prev, next_payment_date: e.target.value }))}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="category">Категория</Label>
                    <Select
                      value={newSubscription.category_id?.toString() || "none"}
                      onValueChange={(value) => setNewSubscription(prev => ({ 
                        ...prev, 
                        category_id: value === "none" ? null : parseInt(value)
                      }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Выберите категорию" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Без категории</SelectItem>
                        {categories.map((cat) => (
                          <SelectItem key={cat.value} value={cat.value?.toString() || "uncategorized"}>
                            {cat.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="auto-renew"
                      checked={newSubscription.is_auto_renew}
                      onCheckedChange={(checked) => setNewSubscription(prev => ({ ...prev, is_auto_renew: checked }))}
                    />
                    <Label htmlFor="auto-renew">Автопродление</Label>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                    Отмена
                  </Button>
                  <Button
                    onClick={handleCreateSubscription}
                    disabled={isCreating || !newSubscription.name || !newSubscription.price}
                  >
                    {isCreating ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : null}
                    Создать
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="grid gap-4">
          {subscriptions.length === 0 ? (
            <Card className="text-center py-12">
              <CardContent>
                <ExternalLink className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Подписок пока нет</h3>
                <p className="text-muted-foreground mb-4">
                  Добавьте свою первую подписку, чтобы начать отслеживание расходов
                </p>
                <Button onClick={() => setIsAddDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Добавить подписку
                </Button>
              </CardContent>
            </Card>
          ) : (
            subscriptions.map((sub) => (
              <Card key={sub.id} className="overflow-hidden hover:border-primary/50 transition-colors group">
                <CardContent className="p-0">
                  <div className="flex items-center p-4 sm:p-6 gap-4 sm:gap-6">
                    <div className="w-12 h-12 sm:w-16 sm:h-16 flex-shrink-0 bg-white rounded-xl border border-border p-2 flex items-center justify-center">
                      {sub.logo ? (
                        <img src={sub.logo} alt={sub.name} className="w-full h-full object-contain" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-primary/10 rounded-lg">
                          <span className="text-lg font-bold text-primary">
                            {sub.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0 grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
                      <div className="md:col-span-1">
                        <h3 className="font-semibold text-lg truncate">{sub.name}</h3>
                        <p className="text-sm text-muted-foreground truncate">{sub.plan}</p>
                      </div>
                      
                      <div className="flex flex-col md:items-center">
                        <span className="text-xs text-muted-foreground uppercase tracking-wider">Цена</span>
                        <span className="font-mono font-medium">
                          ${sub.price}/{sub.billing === "Yearly" ? "год" : "мес"}
                        </span>
                      </div>

                      <div className="flex flex-col md:items-center">
                        <span className="text-xs text-muted-foreground uppercase tracking-wider">Списание</span>
                        <span className="text-sm">
                          {new Date(sub.nextPayment).toLocaleDateString('ru-RU', { 
                            day: 'numeric', 
                            month: 'long',
                            year: 'numeric'
                          })}
                        </span>
                      </div>

                      <div className="flex items-center justify-end gap-3">
                        {getStatusBadge(sub.status, sub.is_active)}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Действия</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => handleToggleStatus(sub.id)} disabled={isToggling}>
                              {isToggling ? 'Изменение...' : (sub.is_active ? 'Приостановить' : 'Активировать')}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              className="text-red-600" 
                              onClick={() => handleDeleteSubscription(sub.id)}
                              disabled={isDeleting}
                            >
                              {isDeleting ? 'Удаление...' : 'Удалить'}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </div>
                  <div className="bg-muted/30 px-6 py-2 border-t border-border flex justify-between items-center text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity h-0 group-hover:h-auto">
                    <span>ID: #{sub.id} • {sub.category?.name || 'Без категории'}</span>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </Layout>
  )
}