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
          <div>
            <span class="font-medium text-gray-700">Database Location:</span>
            <span class="ml-2 text-gray-900 text-sm">{{ systemInfo.database_path }}</span>
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
            class="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="DELETE">DELETE (Default)</option>
            <option value="WAL">WAL (Write-Ahead Logging)</option>
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
import { ref, onMounted } from 'vue'
import api from '@/api'
import Card from '@/components/ui/Card.vue'
import Button from '@/components/ui/Button.vue'

const systemInfo = ref(null)
const journalMode = ref('DELETE')
const message = ref('')
const messageType = ref('success')

const fetchSystemInfo = async () => {
  try {
    const response = await api.get('/system')
    systemInfo.value = response.data
    journalMode.value = response.data.journal_mode || 'DELETE'
  } catch (error) {
    console.error('Error fetching system info:', error)
  }
}

const updateJournalMode = async () => {
  try {
    await api.put('/system/journal-mode', { mode: journalMode.value })
    showMessage('Journal mode updated successfully', 'success')
  } catch (error) {
    console.error('Error updating journal mode:', error)
    showMessage('Failed to update journal mode', 'error')
  }
}

const vacuumDatabase = async () => {
  try {
    await api.post('/system/vacuum')
    showMessage('Database vacuumed successfully', 'success')
  } catch (error) {
    console.error('Error vacuuming database:', error)
    showMessage('Failed to vacuum database', 'error')
  }
}

const analyzeDatabase = async () => {
  try {
    await api.post('/system/analyze')
    showMessage('Database analyzed successfully', 'success')
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

onMounted(() => {
  fetchSystemInfo()
})
</script>