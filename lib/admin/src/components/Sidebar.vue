<template>
  <div class="w-64 flex flex-col border-r border-gray-300" style="background-color: #f3f3f3;">
    <nav class="flex-1 p-3">
      <router-link 
        to="/panel" 
        class="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-200 hover:text-gray-900 transition-all mb-1 no-underline rounded"
        active-class="bg-blue-500 text-white shadow-sm"
      >
        <i class="ph ph-house text-lg"></i>
        <span>Dashboard</span>
      </router-link>
      <router-link 
        to="/panel/collections" 
        class="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-200 hover:text-gray-900 transition-all mb-1 no-underline rounded"
        active-class="bg-blue-500 text-white shadow-sm"
      >
        <i class="ph ph-database text-lg"></i>
        <span>Collections</span>
      </router-link>
      <router-link 
        to="/panel/api-explorer" 
        class="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-200 hover:text-gray-900 transition-all mb-1 no-underline rounded"
        active-class="bg-blue-500 text-white shadow-sm"
      >
        <i class="ph ph-wrench text-lg"></i>
        <span>API Explorer</span>
      </router-link>
    </nav>
  </div>
</template>