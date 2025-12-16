<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class UserPreference extends Model
{
    protected $fillable = [
        'monthly_budget',
    ];

    protected $casts = [
        'monthly_budget' => 'decimal:2',
        'notify_upcoming' => 'boolean',
        'notify_overbudget' => 'boolean',
        'weekly_report' => 'boolean',
    ];

}