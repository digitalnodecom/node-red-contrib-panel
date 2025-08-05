<template>
  <div class="max-w-7xl mx-auto p-6">
    <!-- Stats Grid -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      <Card>
        <div class="flex items-center gap-4">
          <i class="ph ph-database text-3xl text-blue-600"></i>
          <div>
            <h3 class="text-2xl font-bold text-gray-900">{{ collectionsCount }}</h3>
            <p class="text-gray-600">Collections</p>
          </div>
        </div>
      </Card>
      
      <Card>
        <div class="flex items-center gap-4">
          <i class="ph ph-file text-3xl text-green-600"></i>
          <div>
            <h3 class="text-2xl font-bold text-gray-900">{{ totalRecords }}</h3>
            <p class="text-gray-600">Total Records</p>
          </div>
        </div>
      </Card>
      
      <Card>
        <div class="flex items-center gap-4">
          <i class="ph ph-hard-drive text-3xl" :class="statusIconClass"></i>
          <div>
            <h3 class="text-2xl font-bold text-gray-900">{{ systemInfo?.database?.status || 'Unknown' }}</h3>
            <p class="text-gray-600">Database Status</p>
          </div>
        </div>
      </Card>
    </div>

    <!-- Database Info -->
    <Card v-if="systemInfo?.database" class="mb-8">
      <template #header>
        <h2 class="text-xl font-semibold">Database Information</h2>
      </template>
      
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div class="bg-gray-50 p-4">
          <div class="text-sm font-medium text-gray-700 mb-1">Path</div>
          <div class="font-mono text-sm text-gray-600 break-all">{{ systemInfo.database.path }}</div>
        </div>
        <div class="bg-gray-50 p-4">
          <div class="text-sm font-medium text-gray-700 mb-1">Status</div>
          <div :class="getStatusClass(systemInfo.database.status)" class="font-medium">
            {{ systemInfo.database.status }}
          </div>
        </div>
        <div v-if="systemInfo.database.stats" class="bg-gray-50 p-4 rounded-lg">
          <div class="text-sm font-medium text-gray-700 mb-1">Size</div>
          <div class="text-gray-900">{{ formatFileSize(systemInfo.database.stats.size) }}</div>
        </div>
        <div v-if="systemInfo.database.stats" class="bg-gray-50 p-4 rounded-lg">
          <div class="text-sm font-medium text-gray-700 mb-1">Created</div>
          <div class="text-gray-900">{{ formatDate(systemInfo.database.stats.created) }}</div>
        </div>
      </div>
      
      <!-- Journal Mode Section -->
      <div v-if="systemInfo.database.journalMode" class="mt-4 p-4 border-t border-gray-200">
        <div class="flex items-center justify-between">
          <div>
            <div class="text-sm font-medium text-gray-700 mb-1">Journal Mode</div>
            <div class="flex items-center gap-2">
              <span :class="getJournalModeClass(systemInfo.database.journalMode)" 
                    class="px-2 py-1 text-xs font-medium rounded-full">
                {{ systemInfo.database.journalMode.toUpperCase() }}
              </span>
              <span v-if="getJournalModeDescription(systemInfo.database.journalMode)" 
                    class="text-xs text-gray-500">
                {{ getJournalModeDescription(systemInfo.database.journalMode) }}
              </span>
            </div>
          </div>
          <div v-if="!showJournalSelect">
            <button @click="startJournalModeEdit"
                    class="flex items-center gap-1 px-3 py-2 text-sm bg-yellow-50 text-yellow-700 border border-yellow-200 hover:bg-yellow-100 transition-colors">
              <i class="ph ph-warning"></i>
              Change Mode
            </button>
          </div>
          <div v-else class="flex items-center gap-2">
            <select v-model="selectedJournalMode" 
                    class="px-3 py-2 text-sm border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
              <option v-for="mode in journalModes" :key="mode.value" :value="mode.value">
                {{ mode.label }}
              </option>
            </select>
            <button @click="changeJournalMode" 
                    :disabled="changingJournalMode || selectedJournalMode === systemInfo.database.journalMode"
                    class="px-3 py-2 text-sm bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
              {{ changingJournalMode ? 'Changing...' : 'Apply' }}
            </button>
            <button @click="cancelJournalModeChange"
                    class="px-3 py-2 text-sm bg-gray-500 text-white hover:bg-gray-600 transition-colors">
              Cancel
            </button>
          </div>
        </div>
        <div v-if="journalModeWarning" :class="getWarningClass()" class="mt-3 p-3 text-sm">
          <i :class="getWarningIconClass()" class="mr-1"></i>
          {{ journalModeWarning }}
        </div>
      </div>
    </Card>

    <!-- Recent Collections -->
    <Card>
      <template #header>
        <h2 class="text-xl font-semibold">Recent Collections</h2>
      </template>
      
      <DataTable 
        :data="recentCollections" 
        :columns="tableColumns"
        :loading="loading"
      >
        <template #records="{ item }">
          <span class="font-semibold text-blue-600">{{ item.record_count || 0 }}</span>
        </template>
        
        <template #created_at="{ item }">
          {{ formatDate(item.created_at) }}
        </template>
        
        <template #actions="{ item }">
          <button
            @click="viewCollection(item.name)"
            class="text-blue-600 hover:text-blue-800 p-1"
            title="View Collection"
          >
            <i class="ph ph-eye"></i>
          </button>
        </template>
      </DataTable>
    </Card>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useCollectionsStore } from '@/store/collections'
import api from '@/api'
import Card from '@/components/ui/Card.vue'
import DataTable from '@/components/ui/DataTable.vue'
import Button from '@/components/ui/Button.vue'

const router = useRouter()
const collectionsStore = useCollectionsStore()

const loading = computed(() => collectionsStore.loading)
const collectionsCount = computed(() => collectionsStore.collections.length)
const totalRecords = computed(() => {
  return collectionsStore.collections.reduce((sum, collection) => {
    return sum + (collection.record_count || 0)
  }, 0)
})
const systemInfo = ref(null)
const showJournalSelect = ref(false)
const selectedJournalMode = ref('')
const changingJournalMode = ref(false)
const journalModeWarning = ref('')
const journalModeChangeSuccess = ref(true)

const journalModes = [
  { value: 'DELETE', label: 'DELETE (Default - Safe)' },
  { value: 'TRUNCATE', label: 'TRUNCATE (Faster cleanup)' },
  { value: 'PERSIST', label: 'PERSIST (Minimal I/O)' },
  { value: 'WAL', label: 'WAL (Best performance)' },
  { value: 'MEMORY', label: 'MEMORY (Unsafe - RAM only)' },
  { value: 'OFF', label: 'OFF (Dangerous - No safety)' }
]

const recentCollections = computed(() => {
  return [...collectionsStore.collections]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 5)
})

const tableColumns = [
  { key: 'name', header: 'Name' },
  { key: 'records', header: 'Records' },
  { key: 'created_at', header: 'Created', type: 'date' },
  { key: 'actions', header: 'Actions' }
]

const statusIconClass = computed(() => {
  const status = systemInfo.value?.database?.status
  return status === 'connected' ? 'text-green-600' : status === 'error' ? 'text-red-600' : 'text-gray-600'
})

const getStatusClass = (status) => {
  return status === 'connected' ? 'text-green-600' : status === 'error' ? 'text-red-600' : 'text-gray-600'
}

const formatDate = (dateString) => {
  return new Date(dateString).toLocaleDateString()
}

const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const viewCollection = (name) => {
  router.push(`/panel/collections/${name}`)
}

const fetchSystemInfo = async () => {
  try {
    const response = await api.get('/system')
    systemInfo.value = response.data
  } catch (error) {
    console.error('Failed to fetch system info:', error)
  }
}

const getJournalModeClass = (mode) => {
  const modeUpper = mode.toUpperCase()
  switch (modeUpper) {
    case 'DELETE':
    case 'TRUNCATE':
    case 'PERSIST':
      return 'bg-green-100 text-green-800'
    case 'WAL':
      return 'bg-blue-100 text-blue-800'
    case 'MEMORY':
      return 'bg-yellow-100 text-yellow-800'
    case 'OFF':
      return 'bg-red-100 text-red-800'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}

const getJournalModeDescription = (mode) => {
  const modeUpper = mode.toUpperCase()
  switch (modeUpper) {
    case 'DELETE':
      return 'Default mode'
    case 'TRUNCATE':
      return 'Faster cleanup'
    case 'PERSIST':
      return 'Minimal I/O'
    case 'WAL':
      return 'Best performance'
    case 'MEMORY':
      return 'RAM only - unsafe'
    case 'OFF':
      return 'No safety - dangerous'
    default:
      return ''
  }
}

const changeJournalMode = async () => {
  const mode = selectedJournalMode.value
  if (!mode || mode === systemInfo.value.database.journalMode) return
  
  // Show confirmation for dangerous modes
  if (mode === 'MEMORY' || mode === 'OFF') {
    const dangerousMessages = {
      'MEMORY': 'MEMORY mode stores the journal in RAM. If the application crashes, the database may become corrupted. Are you sure?',
      'OFF': 'OFF mode disables all journaling. Transactions will not be safe and data corruption is likely on crashes. Are you sure?'
    }
    
    if (!confirm(dangerousMessages[mode])) {
      return
    }
  }
  
  changingJournalMode.value = true
  journalModeWarning.value = ''
  
  try {
    const response = await api.put('/system/journal-mode', { mode })
    
    // Update system info with the actual mode returned
    systemInfo.value.database.journalMode = response.data.journalMode
    
    // Check if the change was successful
    if (!response.data.success) {
      // Mode change failed - show error-style warning
      journalModeChangeSuccess.value = false
      journalModeWarning.value = response.data.warning
    } else {
      // Mode change succeeded - show informational warning if any
      journalModeChangeSuccess.value = true
      if (response.data.warning) {
        journalModeWarning.value = response.data.warning
      }
      
      // Reset UI state only on successful change
      showJournalSelect.value = false
      selectedJournalMode.value = ''
    }
    
  } catch (error) {
    console.error('Failed to change journal mode:', error)
    journalModeWarning.value = error.response?.data?.error || 'Failed to change journal mode'
  } finally {
    changingJournalMode.value = false
  }
}

const startJournalModeEdit = () => {
  showJournalSelect.value = true
  // Pre-select the current journal mode
  selectedJournalMode.value = systemInfo.value.database.journalMode.toUpperCase()
  journalModeWarning.value = ''
}

const getWarningClass = () => {
  return journalModeChangeSuccess.value 
    ? 'bg-yellow-50 border border-yellow-200 text-yellow-800'
    : 'bg-red-50 border border-red-200 text-red-800'
}

const getWarningIconClass = () => {
  return journalModeChangeSuccess.value 
    ? 'ph ph-warning'
    : 'ph ph-x-circle'
}

const cancelJournalModeChange = () => {
  showJournalSelect.value = false
  selectedJournalMode.value = ''
  journalModeWarning.value = ''
  journalModeChangeSuccess.value = true
}

onMounted(async () => {
  await Promise.all([
    collectionsStore.fetchCollections(),
    fetchSystemInfo()
  ])
})
</script>

