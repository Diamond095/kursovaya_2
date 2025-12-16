<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('categories', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('color')->default('#3B82F6');
            $table->decimal('budget_limit', 10, 2)->nullable();
            $table->timestamps();
            $table->unique(['name']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('categories');
    }
};