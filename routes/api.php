<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\BudgetController;
use App\Http\Controllers\SubscriptionController;
use App\Http\Controllers\SettingsController;
use App\Http\Controllers\DashboardController;

Route::get('/budget', [BudgetController::class, 'index']);
Route::post('/budget', [BudgetController::class, 'store']);
Route::put('/budget/total', [BudgetController::class, 'updateTotalBudget']);
Route::get('/budget/categories', [BudgetController::class, 'categories']);
Route::get('/budget/transactions', [BudgetController::class, 'transactions']);
Route::get('/budget/analytics', [BudgetController::class, 'analytics']);

Route::get('/subscriptions/stats', [SubscriptionController::class, 'stats']);
Route::get('/subscriptions/categories', [SubscriptionController::class, 'categories']);
Route::get('/subscriptions', [SubscriptionController::class, 'index']);
Route::post('/subscriptions', [SubscriptionController::class, 'store']);
Route::get('/subscriptions/{id}', [SubscriptionController::class, 'show']);
Route::put('/subscriptions/{id}', [SubscriptionController::class, 'update']);
Route::delete('/subscriptions/{id}', [SubscriptionController::class, 'destroy']);
Route::post('/subscriptions/{id}/restore', [SubscriptionController::class, 'restore']);
Route::put('/subscriptions/{id}/next-payment', [SubscriptionController::class, 'updateNextPayment']);
Route::post('/subscriptions/{id}/toggle-status', [SubscriptionController::class, 'toggleStatus']);

Route::get('/dashboard', [DashboardController::class, 'index']);
Route::get('/dashboard/notifications', [DashboardController::class, 'notifications']);
Route::get('/dashboard/summary', [DashboardController::class, 'summary']);
