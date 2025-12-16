<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Jobs\GenerateSubscriptionTransactions;
use App\Models\Subscription;
use App\Models\Category;
use App\Models\Transaction;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Carbon\Carbon;

class SubscriptionController extends Controller
{
    public function index(Request $request)
    {
        
        $query = Subscription::with(['category'])->orderBy('next_payment_date', 'asc');
            
        if ($request->has('status')) {
            $query->where('status', $request->status);
        }
        
        if ($request->has('category_id')) {
            $query->where('category_id', $request->category_id);
        }
        
        if ($request->has('is_active')) {
            $query->where('is_active', $request->is_active === 'true');
        }
        
        if ($request->has('search')) {
            $query->where('name', 'like', '%' . $request->search . '%');
        }
        
        $sortBy = $request->get('sort_by', 'next_payment_date');
        $sortOrder = $request->get('sort_order', 'asc');
        $query->orderBy($sortBy, $sortOrder);
        
        if ($request->has('per_page')) {
            $subscriptions = $query->paginate($request->per_page);
        } else {
            $subscriptions = $query->get();
        }
        
        $formattedSubscriptions = $subscriptions->map(function($subscription) {
            return [
                'id' => $subscription->id,
                'name' => $subscription->name,
                'plan' => $subscription->plan_name,
                'price' => (float) $subscription->price,
                'billing' => $this->getBillingDisplay($subscription->billing_cycle),
                'status' => $subscription->status,
                'is_active' => (bool) $subscription->is_active,
                'nextPayment' => $subscription->next_payment_date->format('Y-m-d'),
                'logo' => $subscription->logo_url,
                'description' => $subscription->description,
                'category' => $subscription->category ? [
                    'id' => $subscription->category->id,
                    'name' => $subscription->category->name,
                    'color' => $subscription->category->color,
                ] : null,
                'notes' => $subscription->notes,
                'is_auto_renew' => (bool) $subscription->is_auto_renew,
            ];
        });
        
        $stats = [
            'total' => $subscriptions->count(),
            'active' => $subscriptions->where('is_active', true)->count(),
            'monthly_cost' => $subscriptions->where('is_active', true)->sum('price'),
            'upcoming_this_month' => $subscriptions->where('is_active', true)
                ->whereBetween('next_payment_date', [
                    Carbon::now(),
                    Carbon::now()->endOfMonth()
                ])->count(),
        ];
        
        return response()->json([
            'success' => true,
            'data' => [
                'subscriptions' => $formattedSubscriptions,
                'stats' => $stats,
                'pagination' => $request->has('per_page') ? [
                    'total' => $subscriptions->total(),
                    'per_page' => $subscriptions->perPage(),
                    'current_page' => $subscriptions->currentPage(),
                    'last_page' => $subscriptions->lastPage(),
                ] : null,
            ]
        ]);
    }
    
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'name' => ['required', 'string', 'max:255'],
            'category_id' => ['nullable', 'integer', 'exists:categories,id'],
            'plan_name' => ['nullable', 'string', 'max:255'],
            'price' => ['required', 'numeric', 'min:0'],
            'billing_cycle' => ['required', 'string', Rule::in(['monthly', 'yearly', 'weekly', 'quarterly'])],
            'start_date' => ['nullable', 'date'],
            'next_payment_date' => ['required', 'date'],
            'description' => ['nullable', 'string'],
            'logo_url' => ['nullable', 'url'],
            'notes' => ['nullable', 'string'],
            'is_auto_renew' => ['boolean'],
            'status' => ['string', Rule::in(['active', 'paused', 'cancelled'])],
        ]);
        
        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }
    
        $validated = $validator->validated();
        
        if (!empty($validated['category_id'])) {
            $category = Category::find($validated['category_id']);
        }
        
        $subscription = Subscription::create([
            'category_id' => $validated['category_id'] ?? null,
            'name' => $validated['name'],
            'plan_name' => $validated['plan_name'] ?? null,
            'price' => $validated['price'],
            'billing_cycle' => $validated['billing_cycle'],
            'start_date' => $validated['start_date'] ?? null,
            'next_payment_date' => $validated['next_payment_date'],
            'description' => $validated['description'] ?? null,
            'logo_url' => $validated['logo_url'] ?? null,
            'notes' => $validated['notes'] ?? null,
            'is_auto_renew' => $validated['is_auto_renew'] ?? true,
            'status' => $validated['status'] ?? 'active',
            'is_active' => ($validated['status'] ?? 'active') === 'active',
        ]);
            $nextPaymentDate = Carbon::parse($validated['next_payment_date']);
         if ($subscription->is_active && $nextPaymentDate->lte(now())) {
        GenerateSubscriptionTransactions::dispatch($nextPaymentDate, $subscription->id);
    } else {
        // Если дата в будущем - планируем на нужную дату
        GenerateSubscriptionTransactions::dispatch($nextPaymentDate, $subscription->id)
            ->delay($nextPaymentDate);
    }
        return response()->json([
            'success' => true,
            'message' => 'Подписка успешно создана',
            'data' => $subscription
        ], 201);
    }
    
    public function show($id)
    {
        $subscription = Subscription::with(['category', 'transactions' => function($query) {
            $query->orderBy('date', 'desc')->limit(10);
        }])->findOrFail($id);
            
        $transactions = $subscription->transactions->map(function($transaction) {
            return [
                'id' => $transaction->id,
                'amount' => (float) $transaction->amount,
                'date' => $transaction->date->format('Y-m-d'),
                'status' => $transaction->status,
            ];
        });
        
        $upcomingPayments = [];
        $currentDate = Carbon::parse($subscription->next_payment_date);
        
        for ($i = 0; $i < 6; $i++) {
            $upcomingPayments[] = [
                'date' => $currentDate->format('Y-m-d'),
                'amount' => $subscription->price,
                'is_next' => $i === 0,
            ];
            
            switch ($subscription->billing_cycle) {
                case 'monthly':
                    $currentDate->addMonth();
                    break;
                case 'yearly':
                    $currentDate->addYear();
                    break;
                case 'weekly':
                    $currentDate->addWeek();
                    break;
                case 'quarterly':
                    $currentDate->addMonths(3);
                    break;
            }
        }
        
        return response()->json([
            'success' => true,
            'data' => [
                'subscription' => [
                    'id' => $subscription->id,
                    'name' => $subscription->name,
                    'plan' => $subscription->plan_name,
                    'price' => (float) $subscription->price,
                    'billing' => $this->getBillingDisplay($subscription->billing_cycle),
                    'status' => $subscription->status,
                    'is_active' => (bool) $subscription->is_active,
                    'nextPayment' => $subscription->next_payment_date->format('Y-m-d'),
                    'logo' => $subscription->logo_url,
                    'description' => $subscription->description,
                    'category' => $subscription->category ? [
                        'id' => $subscription->category->id,
                        'name' => $subscription->category->name,
                        'color' => $subscription->category->color,
                    ] : null,
                    'notes' => $subscription->notes,
                    'is_auto_renew' => (bool) $subscription->is_auto_renew,
                    'start_date' => $subscription->start_date?->format('Y-m-d'),
                    'created_at' => $subscription->created_at->format('Y-m-d H:i'),
                ],
                'transactions' => $transactions,
                'upcoming_payments' => $upcomingPayments,
                'stats' => [
                    'total_paid' => $subscription->transactions->where('status', 'completed')->sum('amount'),
                    'transactions_count' => $subscription->transactions->count(),
                    'average_amount' => $subscription->transactions->avg('amount'),
                ]
            ]
        ]);
    }
    
    public function update(Request $request, $id)
    {
        $validator = Validator::make($request->all(), [
            'name' => ['sometimes', 'string', 'max:255'],
            'category_id' => ['nullable', 'integer', 'exists:categories,id'],
            'plan_name' => ['nullable', 'string', 'max:255'],
            'price' => ['sometimes', 'numeric', 'min:0'],
            'billing_cycle' => ['sometimes', 'string', Rule::in(['monthly', 'yearly', 'weekly', 'quarterly'])],
            'next_payment_date' => ['sometimes', 'date'],
            'description' => ['nullable', 'string'],
            'logo_url' => ['nullable', 'url'],
            'notes' => ['nullable', 'string'],
            'is_auto_renew' => ['boolean'],
            'status' => ['sometimes', 'string', Rule::in(['active', 'paused', 'cancelled'])],
            'is_active' => ['boolean'],
        ]);
        
        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }
        
        $user = Auth::user();
        $validated = $validator->validated();
        
        $subscription = Subscription::findOrFail($id);
            
        if (isset($validated['status'])) {
            $validated['is_active'] = $validated['status'] === 'active';
        }
        
        $subscription->update($validated);
        
        return response()->json([
            'success' => true,
            'message' => 'Подписка обновлена',
            'data' => $subscription
        ]);
    }
    
    public function destroy($id)
    {
        $user = Auth::user();
        
        $subscription = Subscription::findOrFail($id);
            
        $subscription->delete();
        
        return response()->json([
            'success' => true,
            'message' => 'Подписка удалена'
        ]);
    }
    
    public function restore($id)
    {
        $subscription = Subscription::withTrashed()->findOrFail($id);
            
        $subscription->restore();
        
        return response()->json([
            'success' => true,
            'message' => 'Подписка восстановлена',
            'data' => $subscription
        ]);
    }
    
    public function categories()
    {
        $categories = Category::all()
            ->map(function($category) {
                return [
                    'value' => $category->id,
                    'label' => $category->name,
                    'color' => $category->color,
                ];
            });
            
        return response()->json([
            'success' => true,
            'data' => $categories
        ]);
    }
    
    public function stats()
    {
        $totalActive = Subscription::where('is_active', true)->count();
        $totalInactive = Subscription::where('is_active', false)->count();
        $monthlyCost = Subscription::where('is_active', true)->where('billing_cycle', 'monthly')->sum('price');
        $yearlyCost = Subscription::where('is_active', true)->where('billing_cycle', 'yearly')->sum('price');
        $upcomingThisMonth = Subscription::where('is_active', true)
            ->whereBetween('next_payment_date', [
                Carbon::now(),
                Carbon::now()->endOfMonth()
            ])->count();
            
        $byCategory = Subscription::where('is_active', true)
            ->selectRaw('categories.name, COUNT(*) as count, SUM(subscriptions.price) as total')
            ->join('categories', 'subscriptions.category_id', '=', 'categories.id')
            ->groupBy('categories.id', 'categories.name')
            ->get();
            
        return response()->json([
            'success' => true,
            'data' => [
                'total_active' => $totalActive,
                'total_inactive' => $totalInactive,
                'monthly_cost' => (float) $monthlyCost,
                'yearly_cost' => (float) $yearlyCost,
                'total_cost' => (float) ($monthlyCost + $yearlyCost),
                'upcoming_this_month' => $upcomingThisMonth,
                'by_category' => $byCategory,
            ]
        ]);
    }

    public function updateNextPayment(Request $request, $id)
    {
        $validator = Validator::make($request->all(), [
            'next_payment_date' => ['required', 'date'],
        ]);
        
        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }
        
        $validated = $validator->validated();
        
        $subscription = Subscription::findOrFail($id);
            
        $subscription->update([
            'next_payment_date' => $validated['next_payment_date']
        ]);
        
        return response()->json([
            'success' => true,
            'message' => 'Дата следующего платежа обновлена',
            'data' => $subscription
        ]);
    }

    public function toggleStatus($id)
    {
        $user = Auth::user();
        
        $subscription = Subscription::findOrFail($id);
            
        $subscription->update([
            'is_active' => !$subscription->is_active,
            'status' => !$subscription->is_active ? 'active' : 'paused'
        ]);
        
        return response()->json([
            'success' => true,
            'message' => $subscription->is_active ? 'Подписка активирована' : 'Подписка приостановлена',
            'data' => [
                'is_active' => $subscription->is_active,
                'status' => $subscription->status
            ]
        ]);
    }

    private function getBillingDisplay($billingCycle)
    {
        $map = [
            'monthly' => 'Monthly',
            'yearly' => 'Yearly',
            'weekly' => 'Weekly',
            'quarterly' => 'Quarterly',
        ];
        
        return $map[$billingCycle] ?? $billingCycle;
    }
}