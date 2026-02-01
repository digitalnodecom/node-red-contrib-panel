<template>
  <div class="max-w-7xl mx-auto p-6">
    <div class="mb-8">
      <h1 class="text-3xl font-bold text-gray-900">Settings</h1>
      <p class="text-gray-600 mt-2">System and database configuration</p>
    </div>

    <!-- System Information Section -->
    <Card class="mb-8">
      <template #header>
        <h2 class="text-xl font-semibold">System Information</h2>
      </template>

      <div v-if="systemInfo" class="space-y-4">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <span class="font-medium text-gray-700">SQLite Version:</span>
            <span class="ml-2 text-gray-900">{{ systemInfo.sqlite_version }}</span>
          </div>
          <div>
            <span class="font-medium text-gray-700">Node.js Version:</span>
            <span class="ml-2 text-gray-900">{{ systemInfo.node_version }}</span>
          </div>
          <div>
            <span class="font-medium text-gray-700">Plugin Version:</span>
            <span class="ml-2 text-gray-900">{{ systemInfo.plugin_version }}</span>
          </div>
          <div class="md:col-span-2">
            <div class="flex items-center justify-between">
              <span class="font-medium text-gray-700">Current Database:</span>
              <span class="ml-2 text-gray-900 font-semibold">{{ databaseInfo?.display_name || currentDatabase }}</span>
            </div>
          </div>
          <div class="md:col-span-2">
            <span class="font-medium text-gray-700">Database Location:</span>
            <span class="ml-2 text-gray-900 text-sm break-all">{{ databaseInfo?.file_path || 'Loading...' }}</span>
          </div>
        </div>
      </div>

      <div v-else class="flex justify-center py-8">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    </Card>

    <!-- Database Settings Section -->
    <Card>
      <template #header>
        <h2 class="text-xl font-semibold">Database Settings</h2>
      </template>

      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">
            SQLite Journal Mode
          </label>
          <select
            v-model="journalMode"
            @change="updateJournalMode"
            :disabled="loading"
            class="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <option value="DELETE">DELETE</option>
            <option value="WAL">WAL (Write-Ahead Logging - Recommended)</option>
            <option value="MEMORY">MEMORY (In-memory journal)</option>
            <option value="OFF">OFF (No journal)</option>
          </select>
          <p class="mt-1 text-sm text-gray-500">
            WAL mode is recommended for better concurrency
          </p>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">
            Database Maintenance
          </label>
          <div class="space-x-2">
            <Button @click="vacuumDatabase" variant="secondary">
              <i class="ph ph-broom mr-2"></i>
              Vacuum Database
            </Button>
            <Button @click="analyzeDatabase" variant="secondary">
              <i class="ph ph-chart-bar mr-2"></i>
              Analyze Database
            </Button>
          </div>
          <p class="mt-1 text-sm text-gray-500">
            Optimize database performance and reclaim disk space
          </p>
        </div>
      </div>
    </Card>

    <!-- Success/Error Messages -->
    <div v-if="message" 
      :class="[
        'fixed bottom-4 right-4 px-6 py-3 rounded-lg shadow-lg',
        messageType === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
      ]"
    >
      {{ message }}
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { useDatabasesStore } from '@/store/databases'
import api from '@/api'
import Card from '@/components/ui/Card.vue'
import Button from '@/components/ui/Button.vue'

const databasesStore = useDatabasesStore()
const systemInfo = ref(null)
const databaseInfo = ref(null)
const journalMode = ref('WAL')
const message = ref('')
const messageType = ref('success')
const loading = ref(true)

const currentDatabase = computed(() => databasesStore.currentDatabase)
const currentDatabaseInfo = computed(() => databasesStore.getCurrentDatabaseInfo)

const fetchSystemInfo = async () => {
  try {
    loading.value = true

    // Fetch general system info
    const systemResponse = await api.get('/system')
    systemInfo.value = systemResponse.data

    // Fetch database-specific info
    const dbResponse = await api.get(`/databases/${currentDatabase.value}`)
    databaseInfo.value = dbResponse.data

    // Get journal mode from database-specific info
    const dbConnection = await api.get(`/databases/${currentDatabase.value}`)
    const mode = dbConnection.data.journal_mode || 'WAL'

    journalMode.value = mode.toUpperCase()
    console.log('Settings: Loaded journal mode for', currentDatabase.value, ':', journalMode.value)
  } catch (error) {
    console.error('Error fetching system info:', error)
    journalMode.value = 'WAL'
  } finally {
    loading.value = false
  }
}

const updateJournalMode = async () => {
  try {
    await api.put(`/databases/${currentDatabase.value}/journal-mode`, { mode: journalMode.value })
    showMessage('Journal mode updated successfully', 'success')
    fetchSystemInfo() // Reload to confirm change
  } catch (error) {
    console.error('Error updating journal mode:', error)
    showMessage('Failed to update journal mode', 'error')
  }
}

const vacuumDatabase = async () => {
  try {
    await api.post(`/databases/${currentDatabase.value}/vacuum`)
    showMessage(`Database '${currentDatabaseInfo.value?.display_name}' vacuumed successfully`, 'success')
  } catch (error) {
    console.error('Error vacuuming database:', error)
    showMessage('Failed to vacuum database', 'error')
  }
}

const analyzeDatabase = async () => {
  try {
    await api.post(`/databases/${currentDatabase.value}/analyze`)
    showMessage(`Database '${currentDatabaseInfo.value?.display_name}' analyzed successfully`, 'success')
  } catch (error) {
    console.error('Error analyzing database:', error)
    showMessage('Failed to analyze database', 'error')
  }
}

const showMessage = (text, type) => {
  message.value = text
  messageType.value = type
  setTimeout(() => {
    message.value = ''
  }, 3000)
}

// Watch for database changes
watch(currentDatabase, () => {
  fetchSystemInfo()
})

onMounted(() => {
  fetchSystemInfo()
})
</script>