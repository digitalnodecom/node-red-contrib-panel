<template>
  <div class="max-w-7xl mx-auto p-6">
    <!-- Database Context Header -->
    <div v-if="databasesStore.currentDatabase !== 'main'" class="mb-6">
      <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div class="flex items-center gap-2">
          <i class="ph ph-database text-blue-600"></i>
          <span class="font-medium text-blue-800">Current Database: {{ databasesStore.currentDatabase }}</span>
        </div>
      </div>
    </div>
    
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
            <h3 class="text-2xl font-bold text-gray-900 capitalize">{{ systemInfo?.database?.status || 'Loading...' }}</h3>
            <p class="text-gray-600">Database Status</p>
          </div>
        </div>
      </Card>
    </div>

    <!-- Latest Activity (Audit Log) -->
    <Card class="mb-8">
      <template #header>
        <h2 class="text-xl font-semibold">Latest Activity</h2>
      </template>
      
      <div v-if="loadingActivity" class="p-6 text-center">
        <i class="ph ph-spinner ph-spin text-2xl text-gray-400"></i>
        <p class="text-gray-600 mt-2">Loading activity...</p>
      </div>

      <div v-else-if="recentActivity.length === 0" class="p-6 text-center text-gray-500">
        <i class="ph ph-clock text-2xl mb-2"></i>
        <p>No recent activity</p>
      </div>

      <div v-else class="divide-y divide-gray-200">
        <div v-for="activity in recentActivity" :key="activity.id" class="p-4 hover:bg-gray-50 transition-colors">
          <div class="flex items-start justify-between">
            <div class="flex-1">
              <div class="flex items-center gap-2 mb-1">
                <i :class="[getActivityIcon(activity.action_type), 'text-sm', getActivityIconClass(activity.action_type)]"></i>
                <span class="font-medium text-gray-900">{{ getActivityTitle(activity) }}</span>
                <span v-if="activity.database_context && activity.database_context !== 'main'" 
                      class="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded-full">
                  {{ activity.database_context }}
                </span>
              </div>
              <p class="text-sm text-gray-600">{{ getActivityDescription(activity) }}</p>
              <div class="flex items-center gap-3 mt-2 text-xs text-gray-500">
                <span class="flex items-center gap-1">
                  <i class="ph ph-user"></i>
                  {{ activity.username }}
                </span>
                <span class="flex items-center gap-1">
                  <i class="ph ph-clock"></i>
                  {{ formatRelativeTime(activity.created_at) }}
                </span>
                <span v-if="activity.ip_address" class="flex items-center gap-1">
                  <i class="ph ph-globe"></i>
                  {{ activity.ip_address }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div class="border-t border-gray-200 p-4 text-center">
        <button @click="$router.push('/panel/audit')" class="text-blue-600 hover:text-blue-700 text-sm font-medium">
          View Full Audit Log
        </button>
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
import { ref, onMounted, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useCollectionsStore } from '@/store/collections'
import { useDatabasesStore } from '@/store/databases'
import api from '@/api'
import Card from '@/components/ui/Card.vue'
import DataTable from '@/components/ui/DataTable.vue'
import Button from '@/components/ui/Button.vue'

const router = useRouter()
const collectionsStore = useCollectionsStore()
const databasesStore = useDatabasesStore()

const loading = computed(() => collectionsStore.loading)
const collectionsCount = computed(() => collectionsStore.collections.length)
const totalRecords = computed(() => {
  return collectionsStore.collections.reduce((sum, collection) => {
    return sum + (collection.record_count || 0)
  }, 0)
})
const recentActivity = ref([])
const loadingActivity = ref(false)
const systemInfo = ref(null)


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
  if (status === 'connected') return 'text-green-600'
  if (status === 'disconnected') return 'text-red-600'
  if (status === 'not_found') return 'text-yellow-600'
  return 'text-gray-600' // Unknown status
})

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
    systemInfo.value = null
  }
}

const fetchRecentActivity = async () => {
  loadingActivity.value = true
  try {
    const response = await api.get('/audit/recent?limit=10')
    recentActivity.value = response.data.data || []
  } catch (error) {
    console.error('Failed to fetch recent activity:', error)
    recentActivity.value = []
  } finally {
    loadingActivity.value = false
  }
}

const getActivityIcon = (actionType) => {
  switch (actionType) {
    case 'database_created':
    case 'collection_created':
      return 'ph ph-plus-circle'
    case 'database_updated':
    case 'collection_updated':
      return 'ph ph-pencil'
    case 'database_deleted':
    case 'collection_deleted':
      return 'ph ph-trash'
    case 'database_set_default':
      return 'ph ph-star'
    case 'collection_truncated':
      return 'ph ph-eraser'
    case 'database_journal_mode_changed':
      return 'ph ph-gear'
    default:
      return 'ph ph-activity'
  }
}

const getActivityIconClass = (actionType) => {
  if (actionType.includes('created')) return 'text-green-600'
  if (actionType.includes('updated')) return 'text-blue-600'  
  if (actionType.includes('deleted')) return 'text-red-600'
  if (actionType.includes('truncated')) return 'text-orange-600'
  return 'text-gray-600'
}

const getActivityTitle = (activity) => {
  const entityName = activity.entity_name || activity.entity_id
  switch (activity.action_type) {
    case 'database_created':
      return `Database Created: ${entityName}`
    case 'database_updated':
      return `Database Updated: ${entityName}`
    case 'database_deleted':
      return `Database Deleted: ${entityName}`
    case 'database_set_default':
      return `Default Database Set: ${entityName}`
    case 'collection_created':
      return `Collection Created: ${entityName}`
    case 'collection_updated':
      return `Collection Updated: ${entityName}`
    case 'collection_deleted':
      return `Collection Deleted: ${entityName}`
    case 'collection_truncated':
      return `Collection Truncated: ${entityName}`
    case 'database_journal_mode_changed':
      return `Journal Mode Changed: ${entityName}`
    default:
      return activity.action_type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
  }
}

const getActivityDescription = (activity) => {
  switch (activity.action_type) {
    case 'database_created':
      return `New database created with WAL mode enabled`
    case 'collection_created':
      const fieldCount = activity.details?.field_count || 0
      return `New collection created with ${fieldCount} fields`
    case 'collection_truncated':
      const deletedCount = activity.details?.records_deleted || 0
      return `All ${deletedCount} records removed from collection`
    case 'database_journal_mode_changed':
      const { old_mode, new_mode } = activity.details || {}
      return `Journal mode changed from ${old_mode} to ${new_mode}`
    default:
      return `Action performed on ${activity.entity_type}`
  }
}

const formatRelativeTime = (dateString) => {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now - date
  const diffMinutes = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMinutes / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMinutes < 1) return 'just now'
  if (diffMinutes < 60) return `${diffMinutes}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return formatDate(dateString)
}


// Watch for database changes and refresh data
watch(() => databasesStore.currentDatabase, async () => {
  await Promise.all([
    collectionsStore.fetchCollections(),
    fetchRecentActivity(),
    fetchSystemInfo()
  ])
})

onMounted(async () => {
  await Promise.all([
    collectionsStore.fetchCollections(),
    fetchRecentActivity(),
    fetchSystemInfo()
  ])
})
</script>

