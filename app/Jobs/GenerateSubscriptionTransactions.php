<?php

namespace App\Jobs;

use App\Models\Subscription;
use App\Models\Transaction;
use Carbon\Carbon;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class GenerateSubscriptionTransactions implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    protected $customDate;
    protected $subscriptionId;

    /**
     * Create a new job instance.
     */
    public function __construct(?Carbon $customDate = null, ?int $subscriptionId = null)
    {
        $this->customDate = $customDate;
        $this->subscriptionId = $subscriptionId;
    }

    /**
     * Execute the job.
     */
    public function handle(): void
    {
        try {
            $date = $this->customDate ?? Carbon::today();
            
            $query = Subscription::where('is_active', true)
                ->where('status', 'active')
                ->whereDate('next_payment_date', '<=', $date);
            
            if ($this->subscriptionId) {
                $query->where('id', $this->subscriptionId);
            }
            
            $subscriptions = $query->with(['category'])->get();
            
            $createdCount = 0;
            $skippedCount = 0;
            $errors = [];
            \Log::info($subscriptions);
            foreach ($subscriptions as $subscription) {
                try {
                    $existingTransaction = Transaction::where('subscription_id', $subscription->id)
                        ->whereDate('date', $date)
                        ->first();
                    
                    if ($existingTransaction) {
                        $skippedCount++;
                        continue;
                    }
                    

                    $transaction = Transaction::create([
                        'subscription_id' => $subscription->id,
                        'amount' => $subscription->price,
                        'date' => $date,
                        'status' => 'completed',
                        'transaction_id' => $this->generateTransactionId(),
                        'notes' => "Автоматическое списание по подписке '{$subscription->name}'",
                    ]);
                    $this->updateNextPaymentDate($subscription);
                    
                    $createdCount++;
                    
                } catch (\Exception $e) {
                    $errors[] = [
                        'subscription_id' => $subscription->id,
                        'error' => $e->getMessage(),
                    ];
                    Log::error("Ошибка создания транзакции для подписки {$subscription->id}: " . $e->getMessage());
                }
            }
            
            Log::info("GenerateSubscriptionTransactions завершен. Создано: {$createdCount}, Пропущено: {$skippedCount}, Ошибок: " . count($errors), [
                'date' => $date->format('Y-m-d'),
                'errors' => $errors,
            ]);
            
        } catch (\Exception $e) {
            Log::error("Ошибка в GenerateSubscriptionTransactions: " . $e->getMessage());
            throw $e;
        }
    }
    
     private function updateNextPaymentDate(Subscription $subscription): void
    {
        $currentDate = Carbon::parse($subscription->next_payment_date);
        
        switch ($subscription->billing_cycle) {
            case 'weekly':
                $nextDate = $currentDate->addWeek();
                break;
            case 'monthly':
                $nextDate = $currentDate->addMonth();
                break;
            case 'quarterly':
                $nextDate = $currentDate->addMonths(3);
                break;
            case 'yearly':
                $nextDate = $currentDate->addYear();
                break;
            default:
                $nextDate = $currentDate->addMonth();
        }
        
        $subscription->update([
            'next_payment_date' => $nextDate,
        ]);
        
        Log::info("Обновлена дата следующего платежа для подписки {$subscription->id}: {$nextDate->format('Y-m-d')}");
    }
    

    private function generateTransactionId(): string
    {
        return 'TXN-' . time() . '-' . strtoupper(bin2hex(random_bytes(4)));
    }
}