<template>
  <div class="h-screen bg-gray-50 flex flex-col">
    <!-- Loading screen -->
    <div v-if="authLoading" class="h-screen flex items-center justify-center bg-gray-900">
      <div class="text-center">
        <div class="mb-4">
          <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
        </div>
        <h2 class="text-xl font-semibold text-white mb-2">Node-RED Panel</h2>
        <p class="text-gray-300">{{ loadingMessage }}</p>
      </div>
    </div>
    
    <!-- Main app (shown when auth check complete) -->
    <template v-else>
      <!-- Full-width black header -->
      <Header />
      
      <!-- Content area with sidebar and main content -->
      <div class="flex flex-1 overflow-hidden">
        <Sidebar />
        <div class="flex-1 overflow-y-auto">
          <router-view />
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import Sidebar from '@/components/Sidebar.vue'
import Header from '@/components/Header.vue'
import { useAuth } from '@/composables/useAuth'

const authLoading = ref(true)
const loadingMessage = ref('Initializing...')

const { initialize } = useAuth()

onMounted(async () => {
  console.log('[APP] App mounted, starting auth check...')
  
  try {
    loadingMessage.value = 'Checking authentication...'
    const authResult = await initialize()
    
    if (authResult?.redirecting) {
      loadingMessage.value = 'Redirecting to login...'
      // Don't hide loading screen if we're redirecting
      return
    }
    
    console.log('[APP] Auth check completed successfully')
    loadingMessage.value = 'Loading application...'
    
    // Small delay to show the loading state
    setTimeout(() => {
      authLoading.value = false
    }, 300)
    
  } catch (error) {
    console.error('[APP] Auth initialization failed:', error)
    // Show error and continue to app after a timeout
    loadingMessage.value = 'Loading failed, continuing...'
    setTimeout(() => {
      authLoading.value = false
    }, 1500)
  }
})
</script>