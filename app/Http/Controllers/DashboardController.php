<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Models\Subscription;
use App\Models\Transaction;
use App\Models\Budget;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class DashboardController extends Controller
{

    public function index()
    {
        
        $currentMonth = date('m');
        $currentYear = date('Y');
        $previousMonth = Carbon::now()->subMonth()->format('m');
        $previousYear = Carbon::now()->subMonth()->format('Y');
        
        $currentMonthSpent = Transaction::whereMonth('date', $currentMonth)
            ->whereYear('date', $currentYear)
            ->where('status', 'completed')
            ->sum('amount');
            
        $previousMonthSpent = Transaction::whereMonth('date', $previousMonth)
            ->whereYear('date', $previousYear)
            ->where('status', 'completed')
            ->sum('amount');
            
        $monthlyChangePercent = $previousMonthSpent > 0 
            ? (($currentMonthSpent - $previousMonthSpent) / $previousMonthSpent) * 100 
            : 0;
            
        $activeSubscriptions = Subscription::where('is_active', true)
            ->count();
            
        $upcomingThisWeek = Subscription::where('is_active', true)
            ->whereBetween('next_payment_date', [
                Carbon::now()->startOfWeek(),
                Carbon::now()->endOfWeek()
            ])
            ->count();
            
        $averageSubscriptionPrice = Subscription::where('is_active', true)
            ->avg('price');
            
        $upcomingPayments = Subscription::where('is_active', true)
            ->whereBetween('next_payment_date', [
                Carbon::now(),
                Carbon::now()->addDays(7)
            ])
            ->with('category')
            ->orderBy('next_payment_date')
            ->limit(5)
            ->get()
            ->map(function($subscription) {
                return [
                    'id' => $subscription->id,
                    'name' => $subscription->name,
                    'date' => Carbon::parse($subscription->next_payment_date)->format('d M'),
                    'amount' => $subscription->price,
                    'logo_url' => $subscription->logo_url,
                    'category_name' => $subscription->category->name ?? null,
                    'icon' => strtoupper(substr($subscription->name, 0, 1)),
                ];
            });
            
        $sixMonthsAgo = Carbon::now()->subMonths(5)->startOfMonth();
        
        $monthlyExpenses = Transaction::select(
                DB::raw('YEAR(date) as year'),
                DB::raw('MONTH(date) as month'),
                DB::raw('SUM(amount) as total')
            )
            ->where('status', 'completed')
            ->where('date', '>=', $sixMonthsAgo)
            ->groupBy('year', 'month')
            ->orderBy('year', 'asc')
            ->orderBy('month', 'asc')
            ->get()
            ->map(function($item) {
                $monthNames = [
                    1 => 'Янв', 2 => 'Фев', 3 => 'Мар', 4 => 'Апр',
                    5 => 'Май', 6 => 'Июн', 7 => 'Июл', 8 => 'Авг',
                    9 => 'Сен', 10 => 'Окт', 11 => 'Ноя', 12 => 'Дек'
                ];
                
                return [
                    'name' => $monthNames[$item->month] ?? $item->month,
                    'total' => (float) $item->total,
                    'year' => $item->year,
                    'month' => $item->month
                ];
            });
            
        $fullMonthlyData = [];
        for ($i = 5; $i >= 0; $i--) {
            $date = Carbon::now()->subMonths($i);
            $month = $date->format('n');
            $year = $date->format('Y');
            $monthName = [
                1 => 'Янв', 2 => 'Фев', 3 => 'Мар', 4 => 'Апр',
                5 => 'Май', 6 => 'Июн', 7 => 'Июл', 8 => 'Авг',
                9 => 'Сен', 10 => 'Окт', 11 => 'Ноя', 12 => 'Дек'
            ][$month];
            
            $found = $monthlyExpenses->first(function($item) use ($month, $year) {
                return $item['month'] == $month && $item['year'] == $year;
            });
            
            $fullMonthlyData[] = [
                'name' => $monthName,
                'total' => $found['total'] ?? 0,
            ];
        }
        
        $categoryStats = Transaction::select(
                'categories.name',
                'categories.color',
                DB::raw('SUM(transactions.amount) as total')
            )
            ->join('subscriptions', 'transactions.subscription_id', '=', 'subscriptions.id')
            ->join('categories', 'subscriptions.category_id', '=', 'categories.id')
            ->where('transactions.status', 'completed')
            ->whereMonth('transactions.date', $currentMonth)
            ->whereYear('transactions.date', $currentYear)
            ->groupBy('categories.id', 'categories.name', 'categories.color')
            ->orderBy('total', 'desc')
            ->limit(5)
            ->get()
            ->map(function($item) {
                return [
                    'name' => $item->name,
                    'total' => (float) $item->total,
                    'color' => $item->color,
                ];
            });
        
        $quickStats = [
            'total_yearly' => Transaction::whereYear('date', $currentYear)
                ->where('status', 'completed')
                ->sum('amount'),
            'savings_this_month' => $this->calculateSavings( $currentMonth, $currentYear),
            'most_expensive_subscription' => Subscription::where('is_active', true)
                ->orderBy('price', 'desc')
                ->first(['name', 'price']),
            'subscriptions_by_status' => [
                'active' => Subscription::where('is_active', true)->count(),
                'inactive' => Subscription::where('is_active', false)->count(),
                'pending' => Subscription::where('status', 'pending')->count(),
            ]
        ];

        return response()->json([
            'success' => true,
            'data' => [
                'stats' => [
                    'monthly_spent' => [
                        'current' => (float) $currentMonthSpent,
                        'previous' => (float) $previousMonthSpent,
                        'change_percent' => round($monthlyChangePercent, 1),
                        'change_direction' => $monthlyChangePercent >= 0 ? 'up' : 'down',
                    ],
                    'active_subscriptions' => [
                        'count' => $activeSubscriptions,
                        'upcoming_this_week' => $upcomingThisWeek,
                    ],
                    'average_check' => [
                        'amount' => (float) $averageSubscriptionPrice,
                        'change_percent' => -1.2, // Можно рассчитать динамику
                    ],
                ],
                'upcoming_payments' => $upcomingPayments,
                'monthly_expenses' => $fullMonthlyData,
                'category_stats' => $categoryStats,
                'quick_stats' => $quickStats,
                'currency' => $user->preferences->currency ?? 'USD',
                'current_month_name' => Carbon::now()->translatedFormat('F Y'),
            ]
        ]);
    }
    
    private function calculateSavings($month, $year)
    {
        $previousMonth = Carbon::create($year, $month, 1)->subMonth();
        
        $currentMonthSpent = Transaction::whereMonth('date', $month)
            ->whereYear('date', $year)
            ->where('status', 'completed')
            ->sum('amount');
            
        $previousMonthSpent = Transaction::whereMonth('date', $previousMonth->format('m'))
            ->whereYear('date', $previousMonth->format('Y'))
            ->where('status', 'completed')
            ->sum('amount');
            
        return $previousMonthSpent > 0 
            ? $previousMonthSpent - $currentMonthSpent 
            : 0;
    }
    

    public function notifications()
    {
        
        $notifications = [];
        
        $budgets = Budget::where('is_active', true)
            ->where('month', date('m'))
            ->where('year', date('Y'))
            ->with('category')
            ->get();
            
        foreach ($budgets as $budget) {
            if ($budget->current_spent > 0 && $budget->limit_amount > 0) {
                $percentage = ($budget->current_spent / $budget->limit_amount) * 100;
                
                if ($percentage >= 90) {
                    $notifications[] = [
                        'type' => 'warning',
                        'title' => 'Превышение бюджета',
                        'message' => "Категория '{$budget->category->name}' достигла {$percentage}% лимита",
                        'icon' => 'alert-triangle',
                        'action' => '/budget',
                    ];
                }
            }
        }
        
        $tomorrowPayments = Subscription::where('is_active', true)
            ->whereDate('next_payment_date', Carbon::tomorrow())
            ->count();
            
        if ($tomorrowPayments > 0) {
            $notifications[] = [
                'type' => 'info',
                'title' => 'Завтрашние платежи',
                'message' => "{$tomorrowPayments} подписк(а/и) будут списаны завтра",
                'icon' => 'credit-card',
                'action' => '/subscriptions',
            ];
        }
        
        $todayTransactions = Transaction::whereDate('date', Carbon::today())
            ->where('status', 'completed')
            ->count();
            
        if ($todayTransactions > 0) {
            $notifications[] = [
                'type' => 'success',
                'title' => 'Сегодняшние транзакции',
                'message' => "{$todayTransactions} нов(ая/ых) транзакция(ий) сегодня",
                'icon' => 'check-circle',
                'action' => '/transactions',
            ];
        }
        
        return response()->json([
            'success' => true,
            'data' => $notifications
        ]);
    }
    
    public function summary(Request $request)
    {
        $validated = $request->validate([
            'period' => 'required|in:today,week,month,year',
        ]);
        
        $period = $validated['period'];
        
        $query = Transaction::where('status', 'completed');
            
        switch ($period) {
            case 'today':
                $query->whereDate('date', Carbon::today());
                break;
            case 'week':
                $query->whereBetween('date', [
                    Carbon::now()->startOfWeek(),
                    Carbon::now()->endOfWeek()
                ]);
                break;
            case 'month':
                $query->whereMonth('date', date('m'))
                    ->whereYear('date', date('Y'));
                break;
            case 'year':
                $query->whereYear('date', date('Y'));
                break;
        }
        
        $total = $query->sum('amount');
        $count = $query->count();
        $average = $count > 0 ? $total / $count : 0;
        
        $mostExpensive = $query->orderBy('amount', 'desc')
            ->first(['id', 'amount', 'date']);
            
        $dailyData = $query->select(
                DB::raw('DATE(date) as day'),
                DB::raw('SUM(amount) as total')
            )
            ->groupBy('day')
            ->orderBy('day')
            ->get();
            
        return response()->json([
            'success' => true,
            'data' => [
                'period' => $period,
                'total' => (float) $total,
                'count' => $count,
                'average' => (float) $average,
                'most_expensive' => $mostExpensive,
                'daily_data' => $dailyData,
                'currency' => $user->preferences->currency ?? 'USD',
            ]
        ]);
    }
}