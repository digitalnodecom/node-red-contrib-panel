<template>
  <header class="bg-gray-900 text-white px-4 py-2 border-b border-gray-700 shadow-sm">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-4">
        <div class="flex items-center gap-3">
          <img :src="panelLogoUrl" alt="Panel" style="width:30px;height:30px;" />
          <h1 class="text-base font-medium text-white">Node-RED Panel</h1>
        </div>
        <div class="text-xs text-gray-500">|</div>
        <div class="flex items-center gap-3">
          <div class="text-sm text-gray-300">{{ pageTitle }}</div>
          <div class="text-xs text-gray-500">|</div>
          <!-- Database Switcher -->
          <div class="flex items-center gap-2">
            <i class="ph text-gray-400 text-sm" :class="switchingDatabase ? 'ph-spinner ph-spin' : 'ph-database'"></i>
            <select 
              v-model="currentDatabase"
              :disabled="switchingDatabase"
              class="bg-gray-800 text-white text-xs border border-gray-600 rounded px-2 py-1 focus:border-blue-500 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option v-for="db in databases" :key="db.name" :value="db.name">
                {{ db.display_name }}{{ db.is_default ? ' (default)' : '' }}
              </option>
            </select>
          </div>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <a
          href="/"
          class="p-2 text-gray-300 hover:text-white hover:bg-gray-800 transition-colors rounded inline-flex items-center justify-center"
          title="Back to Node-RED"
          style="width:40px;height:40px;padding:5px;"
        >
          <img :src="nodeRedLogoUrl" alt="Node-RED" style="width:30px;height:30px;" />
        </a>
        <button
          @click="refresh"
          class="p-2 text-gray-300 hover:text-white hover:bg-gray-800 transition-colors rounded"
          title="Refresh"
        >
          <i class="ph ph-arrow-clockwise text-sm"></i>
        </button>
      </div>
    </div>
  </header>
</template>

<script setup>
import { computed, ref, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useDatabasesStore } from '@/store/databases'
import { useCollectionsStore } from '@/store/collections'
import panelLogoUrl from '@/assets/images/node-red-panel.svg'
import nodeRedLogoUrl from '@/assets/images/node-red.svg'

const route = useRoute()
const router = useRouter()
const databasesStore = useDatabasesStore()
const collectionsStore = useCollectionsStore()

const switchingDatabase = ref(false)
const databases = computed(() => databasesStore.databases)
const currentDatabase = computed({
  get: () => databasesStore.currentDatabase,
  set: (value) => databasesStore.setCurrentDatabase(value)
})

const pageTitle = computed(() => {
  const titles = {
    'Dashboard': 'Dashboard',
    'Databases': 'Databases',
    'Collections': 'Collections',
    'DataBrowser': `Collection: ${route.params.name}`,
    'ApiExplorer': 'API Explorer',
    'Settings': 'Settings'
  }
  return titles[route.name] || 'Node-RED Panel'
})

// Watch for database changes and handle navigation
watch(() => currentDatabase.value, async (newDb, oldDb) => {
  if (newDb && newDb !== oldDb) {
    try {
      switchingDatabase.value = true
      
      // If we're on a data browser page, redirect to collections since the collection might not exist in the new database
      if (route.name === 'DataBrowser') {
        router.push('/collections')
      }
    } catch (error) {
      console.error('Error switching database:', error)
    } finally {
      switchingDatabase.value = false
    }
  }
}, { immediate: false })

const refresh = () => {
  // Refresh collections and other data without page reload
  collectionsStore.fetchCollections()
}

onMounted(async () => {
  // Load databases on mount
  await databasesStore.fetchDatabases()
  
  // Initialize current database from store
  databasesStore.initializeCurrentDatabase()
})
</script>