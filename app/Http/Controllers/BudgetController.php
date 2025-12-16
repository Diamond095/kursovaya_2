<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Models\Budget;
use App\Models\Category;
use App\Models\Transaction;
use App\Models\UserPreference;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class BudgetController extends Controller
{
    public function index(Request $request)
    {

        $currentMonth = date('m');
        $currentYear = date('Y');
        
        $totalBudget = $user->preferences->monthly_budget ?? 500;
        
        $currentSpent = Transaction::whereMonth('date', $currentMonth)
            ->whereYear('date', $currentYear)
            ->where('status', 'completed')
            ->sum('amount');
            
        $percentage = $totalBudget > 0 ? ($currentSpent / $totalBudget) * 100 : 0;
        
        $categories = Category::with(['budgets' => function($query) use ($currentMonth, $currentYear) {
                $query->where('month', $currentMonth)
                    ->where('year', $currentYear)
                    ->where('period', 'monthly');
            }])
            ->get()
            ->map(function($category) use ($currentMonth, $currentYear) {
                $spent = Transaction::whereHas('subscription', function($query) use ($category) {
                        $query->where('category_id', $category->id);
                    })
                    ->whereMonth('date', $currentMonth)
                    ->whereYear('date', $currentYear)
                    ->where('status', 'completed')
                    ->sum('amount');
                    
                $budget = $category->budgets->first();
                $limit = $budget->limit_amount ?? 0;
                
                return [
                    'id' => $category->id,
                    'name' => $category->name,
                    'spent' => (float) $spent,
                    'limit' => (float) $limit,
                    'color' => $category->color,
                    'percentage' => $limit > 0 ? ($spent / $limit) * 100 : 0
                ];
            });
        
        $chartData = Transaction::select('categories.name', DB::raw('SUM(transactions.amount) as value'))
            ->join('subscriptions', 'transactions.subscription_id', '=', 'subscriptions.id')
            ->join('categories', 'subscriptions.category_id', '=', 'categories.id')
            ->whereMonth('transactions.date', $currentMonth)
            ->whereYear('transactions.date', $currentYear)
            ->where('transactions.status', 'completed')
            ->groupBy('categories.id', 'categories.name')
            ->get()
            ->map(function($item, $index) {
                $colors = [
                    'hsl(var(--chart-1))',
                    'hsl(var(--chart-2))',
                    'hsl(var(--chart-3))',
                    'hsl(var(--chart-4))',
                    'hsl(var(--chart-5))',
                ];
                
                return [
                    'name' => $item->name,
                    'value' => (float) $item->value,
                    'color' => $colors[$index % count($colors)] ?? 'hsl(var(--primary))'
                ];
            });
    
        $alerts = [];
        foreach ($categories as $category) {
            if ($category['limit'] > 0 && $category['percentage'] >= 90) {
                $alerts[] = [
                    'category' => $category['name'],
                    'percentage' => $category['percentage'],
                    'spent' => $category['spent'],
                    'limit' => $category['limit']
                ];
            }
        }
        
        return response()->json([
            'success' => true,
            'data' => [
                'total_budget' => (float) $totalBudget,
                'current_spent' => (float) $currentSpent,
                'percentage' => round($percentage, 1),
                'remaining' => (float) ($totalBudget - $currentSpent),
                'categories' => $categories,
                'chart_data' => $chartData,
                'alerts' => $alerts,
                'current_month' => date('F Y'),
                'currency' => $user->preferences->currency ?? 'USD'
            ]
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'category_id' => 'nullable|integer|exists:categories,id',
            'name' => 'nullable|string|max:255',
            'limit_amount' => 'required|numeric|min:0',
            'period' => 'required|in:monthly,yearly,weekly',
            'year' => 'nullable|integer',
            'month' => 'nullable|integer|min:1|max:12',
        ]);

        
        if (!empty($validated['category_id'])) {
            $category = Category::where('id', $validated['category_id'])
                ->firstOrFail();
        }
        
        if (empty($validated['year'])) {
            $validated['year'] = date('Y');
        }
        
        if ($validated['period'] === 'monthly' && empty($validated['month'])) {
            $validated['month'] = date('m');
        }

        $budget = Budget::updateOrCreate(
            [
                'category_id' => $validated['category_id'],
                'period' => $validated['period'],
                'year' => $validated['year'],
                'month' => $validated['month'] ?? null,
            ],
            [
                'name' => $validated['name'],
                'limit_amount' => $validated['limit_amount'],
                'current_spent' => 0, 
                'is_active' => true,
            ]
        );

        return response()->json([
            'success' => true,
            'message' => 'Бюджет успешно сохранен',
            'data' => $budget
        ], 201);
    }

    public function updateTotalBudget(Request $request)
    {
        $validated = $request->validate([
            'monthly_budget' => 'required|numeric|min:0',
        ]);

        
        UserPreference::first()->updateOrCreate(
            ['monthly_budget' => $validated['monthly_budget']]
        );

        return response()->json([
            'success' => true,
            'message' => 'Общий бюджет обновлен',
            'data' => [
                'monthly_budget' => (float) $validated['monthly_budget']
            ]
        ]);
    }

    public function categories()
    {
        $categories = Category::select('id', 'name', 'color')
            ->get()
            ->map(function($category) {
                return [
                    'value' => $category->id,
                    'label' => $category->name,
                    'color' => $category->color,
                    'id' => $category->id
                ];
            });

        return response()->json([
            'success' => true,
            'data' => $categories
        ]);
    }
    public function transactions(Request $request)
    {
        $validated = $request->validate([
            'month' => 'nullable|integer|min:1|max:12',
            'year' => 'nullable|integer',
            'category_id' => 'nullable|integer|exists:categories,id',
        ]);

        $month = $validated['month'] ?? date('m');
        $year = $validated['year'] ?? date('Y');
        
        $query = Transaction::with(['subscription.category'])
            ->whereMonth('date', $month)
            ->whereYear('date', $year)
            ->where('status', 'completed');

        if (!empty($validated['category_id'])) {
            $query->whereHas('subscription', function($q) use ($validated) {
                $q->where('category_id', $validated['category_id']);
            });
        }

        $transactions = $query->orderBy('date', 'desc')
            ->paginate($request->get('per_page', 20));

        return response()->json([
            'success' => true,
            'data' => $transactions,
            'summary' => [
                'total' => $transactions->sum('amount'),
                'count' => $transactions->count()
            ]
        ]);
    }

    public function analytics(Request $request)
    {
        $validated = $request->validate([
            'start_date' => 'required|date',
            'end_date' => 'required|date|after_or_equal:start_date',
        ]);


        $analytics = Transaction::select(
                DB::raw('DATE(date) as day'),
                DB::raw('SUM(amount) as total'),
                'categories.name as category_name',
                'categories.color as category_color'
            )
            ->join('subscriptions', 'transactions.subscription_id', '=', 'subscriptions.id')
            ->join('categories', 'subscriptions.category_id', '=', 'categories.id')
            ->whereBetween('date', [$validated['start_date'], $validated['end_date']])
            ->where('status', 'completed')
            ->groupBy('day', 'categories.id', 'categories.name', 'categories.color')
            ->orderBy('day')
            ->get();

        $dailyData = $analytics->groupBy('day')->map(function($dayTransactions) {
            return [
                'date' => $dayTransactions->first()->day,
                'total' => $dayTransactions->sum('total'),
                'transactions' => $dayTransactions->count()
            ];
        })->values();

        $categoryData = $analytics->groupBy('category_name')->map(function($catTransactions, $categoryName) {
            $first = $catTransactions->first();
            return [
                'name' => $categoryName,
                'value' => $catTransactions->sum('total'),
                'color' => $first->category_color
            ];
        })->values();

        return response()->json([
            'success' => true,
            'data' => [
                'daily' => $dailyData,
                'by_category' => $categoryData,
                'period_total' => $analytics->sum('total'),
                'average_daily' => $dailyData->count() > 0 ? $analytics->sum('total') / $dailyData->count() : 0
            ]
        ]);
    }
}