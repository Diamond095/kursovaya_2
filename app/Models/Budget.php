<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Budget extends Model
{
    protected $fillable = [
        'category_id',
        'name',
        'limit_amount',
        'period',
        'year',
        'month',
        'current_spent',
        'is_active',
    ];

    protected $casts = [
        'limit_amount' => 'decimal:2',
        'current_spent' => 'decimal:2',
        'is_active' => 'boolean',
    ];

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }
}