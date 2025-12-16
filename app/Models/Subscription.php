<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Subscription extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'category_id',
        'name',
        'description',
        'logo_url',
        'plan_name',
        'price',
        'billing_cycle',
        'start_date',
        'next_payment_date',
        'is_active',
        'is_auto_renew',
        'notes',
        'status',
    ];

    protected $casts = [
        'price' => 'decimal:2',
        'start_date' => 'date',
        'next_payment_date' => 'date',
        'is_active' => 'boolean',
        'is_auto_renew' => 'boolean',
    ];
    
    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }


    public function transactions(): HasMany
    {
        return $this->hasMany(Transaction::class);
    }
}