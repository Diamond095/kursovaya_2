<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('subscriptions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('category_id')->nullable()->constrained('categories')->onDelete('set null');
            $table->string('name');
            $table->string('description')->nullable();
            $table->string('logo_url')->nullable();
            $table->string('plan_name')->nullable();
            $table->decimal('price', 10, 2);
            $table->enum('billing_cycle', ['monthly', 'yearly', 'weekly', 'quarterly'])->default('monthly');
            $table->date('start_date')->nullable();
            $table->date('next_payment_date');
            $table->boolean('is_active')->default(true);
            $table->boolean('is_auto_renew')->default(true);
            $table->text('notes')->nullable();
            $table->string('status')->default('active'); // active, paused, cancelled
            $table->timestamps();
            $table->softDeletes();
    
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('subscriptions');
    }
};