<template>
  <div class="h-screen bg-gray-50 flex flex-col">
    <!-- Full-width black header -->
    <Header />
    
    <!-- Content area with sidebar and main content -->
    <div class="flex flex-1 overflow-hidden">
      <Sidebar />
      <div class="flex-1 overflow-y-auto">
        <router-view />
      </div>
    </div>
  </div>
</template>

<script setup>
import Sidebar from '@/components/Sidebar.vue'
import Header from '@/components/Header.vue'
</script>