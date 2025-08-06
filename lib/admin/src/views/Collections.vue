<template>
  <div class="max-w-7xl mx-auto p-6">
    <div class="flex items-center justify-between mb-6">
      <div class="flex items-center gap-4">
        <div>
          <h2 class="text-2xl font-bold text-gray-900">Manage Collections</h2>
          <p v-if="databasesStore.currentDatabase !== 'master'" class="text-sm text-gray-600">
            Database: {{ databasesStore.currentDatabase }}
          </p>
        </div>
        <label class="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
          <input
            type="checkbox"
            v-model="showSystemTables"
            @change="toggleSystemTables"
            class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          >
          <span class="flex items-center gap-1">
            <i class="ph ph-gear-six"></i>
            Show System Tables
          </span>
        </label>
      </div>
      <button
        @click="showCreateDialog = true"
        class="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 transition-colors flex items-center gap-2"
      >
        <i class="ph ph-plus"></i>
        New Collection
      </button>
    </div>

    <DataTable
      :data="collections"
      :columns="tableColumns"
      :loading="loading"
      :paginated="true"
      :page-size="20"
    >
      <template #table_type="{ item }">
        <span :class="getTableTypeClass(item.table_type)" class="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full">
          <i :class="getTableTypeIcon(item.table_type)" class="mr-1"></i>
          {{ item.table_type === 'system' ? 'System' : 'User' }}
        </span>
      </template>
      
      <template #events="{ item }">
        <div class="flex items-center gap-2">
          <span v-if="item.events_enabled" class="inline-flex items-center px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
            <i class="ph ph-bell mr-1"></i>
            Enabled
          </span>
          <span v-else-if="item.table_type === 'user'" class="inline-flex items-center px-2 py-1 text-xs font-medium bg-gray-100 text-gray-600 rounded-full">
            <i class="ph ph-bell-slash mr-1"></i>
            Disabled
          </span>
          <span v-else class="text-xs text-gray-400">N/A</span>
        </div>
      </template>
      
      <template #fields="{ item }">
        {{ item.field_count || 0 }} fields
      </template>
      
      <template #records="{ item }">
        <span class="font-semibold text-blue-600">{{ item.record_count || 0 }}</span> records
      </template>
      
      <template #created_at="{ item }">
        {{ formatDate(item.created_at) }}
      </template>
      
      <template #actions="{ item }">
        <div class="flex items-center gap-2">
          <button
            @click="viewData(item.name)"
            class="text-blue-600 hover:text-blue-800 p-1 transition-colors"
            title="View Data"
          >
            <i class="ph ph-eye"></i>
          </button>
          <button
            v-if="item.table_type !== 'system'"
            @click="editCollection(item)"
            class="text-gray-600 hover:text-gray-800 p-1 transition-colors"
            title="Edit"
          >
            <i class="ph ph-pencil"></i>
          </button>
          <button
            v-if="item.table_type !== 'system'"
            @click="confirmTruncate(item)"
            class="text-orange-600 hover:text-orange-800 p-1 transition-colors"
            title="Truncate (Clear All Data)"
          >
            <i class="ph ph-eraser"></i>
          </button>
          <button
            v-if="item.table_type !== 'system'"
            @click="confirmDelete(item)"
            class="text-red-600 hover:text-red-800 p-1 transition-colors"
            title="Delete"
          >
            <i class="ph ph-trash"></i>
          </button>
          <span v-if="item.table_type === 'system'" class="text-xs text-gray-400 px-2">Read-only</span>
        </div>
      </template>
    </DataTable>

    <!-- Create/Edit Dialog -->
    <Modal
      :show="showCreateDialog"
      :title="editingCollection ? 'Edit Collection' : 'Create Collection'"
      size="lg"
      @close="closeDialog"
    >
      <!-- Error Alert -->
      <div v-if="error" class="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
        <div class="flex">
          <div class="flex-shrink-0">
            <i class="ph ph-warning-circle text-red-400 text-xl"></i>
          </div>
          <div class="ml-3">
            <p class="text-sm font-medium text-red-800">{{ error }}</p>
          </div>
        </div>
      </div>
      
      <CollectionEditor
        :collection="editingCollection"
        @save="handleSave"
        @cancel="closeDialog"
      />
    </Modal>

    <!-- Delete Confirmation -->
    <Modal
      :show="showDeleteDialog"
      title="Delete Collection"
      size="md"
      @close="showDeleteDialog = false"
    >
      <p class="text-gray-700 mb-4">
        Are you sure you want to delete the collection "{{ collectionToDelete?.name }}"? 
        This action cannot be undone.
      </p>
      
      <template #footer>
        <div class="flex justify-end gap-3">
          <button
            @click="showDeleteDialog = false"
            class="px-4 py-2 text-gray-600 bg-gray-200 hover:bg-gray-300 transition-colors"
          >
            Cancel
          </button>
          <button
            @click="deleteCollection"
            class="px-4 py-2 bg-red-600 text-white hover:bg-red-700 transition-colors"
          >
            Delete
          </button>
        </div>
      </template>
    </Modal>

    <!-- Truncate Confirmation -->
    <Modal
      :show="showTruncateDialog"
      title="Truncate Collection"
      size="md"
      @close="showTruncateDialog = false"
    >
      <div class="space-y-4">
        <div class="flex items-start gap-3">
          <i class="ph ph-warning text-orange-500 text-2xl mt-1"></i>
          <div>
            <p class="text-gray-700 font-medium">
              Are you sure you want to truncate the collection "{{ collectionToTruncate?.name }}"?
            </p>
            <p class="text-gray-600 text-sm mt-1">
              This will permanently delete ALL records ({{ collectionToTruncate?.record_count || 0 }} records) from this collection.
            </p>
            <p class="text-gray-600 text-sm mt-1">
              The collection structure and settings will be preserved.
            </p>
          </div>
        </div>
      </div>
      
      <template #footer>
        <div class="flex justify-end gap-3">
          <button
            @click="showTruncateDialog = false"
            class="px-4 py-2 text-gray-600 bg-gray-200 hover:bg-gray-300 transition-colors"
          >
            Cancel
          </button>
          <button
            @click="truncateCollection"
            class="px-4 py-2 bg-orange-600 text-white hover:bg-orange-700 transition-colors"
          >
            Truncate Collection
          </button>
        </div>
      </template>
    </Modal>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useCollectionsStore } from '@/store/collections'
import { useDatabasesStore } from '@/store/databases'
import api from '@/api'
import DataTable from '@/components/ui/DataTable.vue'
import Button from '@/components/ui/Button.vue'
import Modal from '@/components/ui/Modal.vue'
import CollectionEditor from '@/components/CollectionEditor.vue'

const router = useRouter()
const collectionsStore = useCollectionsStore()
const databasesStore = useDatabasesStore()

const showCreateDialog = ref(false)
const showDeleteDialog = ref(false)
const showTruncateDialog = ref(false)
const editingCollection = ref(null)
const collectionToDelete = ref(null)
const collectionToTruncate = ref(null)
const showSystemTables = ref(false)
const allCollections = ref([])
const error = ref(null)

const collections = computed(() => {
  return showSystemTables.value ? allCollections.value : collectionsStore.collections
})
const loading = computed(() => collectionsStore.loading)

const tableColumns = computed(() => {
  const baseColumns = [
    { key: 'name', header: 'Name', sortable: true },
  ]
  
  if (showSystemTables.value) {
    baseColumns.push({ key: 'table_type', header: 'Type' })
  }
  
  baseColumns.push(
    { key: 'events', header: 'Events' },
    { key: 'fields', header: 'Fields' },
    { key: 'records', header: 'Records' }
  )
  
  if (!showSystemTables.value) {
    baseColumns.push({ key: 'created_at', header: 'Created', sortable: true, type: 'date' })
  }
  
  baseColumns.push({ key: 'actions', header: 'Actions' })
  
  return baseColumns
})

const formatDate = (dateString) => {
  return new Date(dateString).toLocaleDateString()
}

const getTableTypeClass = (type) => {
  return type === 'system' 
    ? 'bg-purple-100 text-purple-800'
    : 'bg-blue-100 text-blue-800'
}

const getTableTypeIcon = (type) => {
  return type === 'system' 
    ? 'ph ph-gear-six'
    : 'ph ph-database'
}

const toggleSystemTables = async () => {
  if (showSystemTables.value) {
    // Load all tables including system tables
    try {
      const currentDb = databasesStore.currentDatabase
      const endpoint = `/databases/${currentDb}/collections?system=true`
      const response = await api.get(endpoint)
      allCollections.value = response.data
    } catch (error) {
      console.error('Failed to fetch system tables:', error)
      showSystemTables.value = false
    }
  }
}

const viewData = (name) => {
  router.push(`/panel/collections/${name}`)
}

const editCollection = async (collection) => {
  try {
    // Fetch complete collection details including field definitions
    const currentDb = databasesStore.currentDatabase
    const fullCollection = await collectionsStore.fetchCollection(collection.name, currentDb)
    editingCollection.value = { ...fullCollection }
    showCreateDialog.value = true
  } catch (error) {
    console.error('Failed to fetch collection details:', error)
  }
}

const confirmDelete = (collection) => {
  collectionToDelete.value = collection
  showDeleteDialog.value = true
}

const deleteCollection = async () => {
  if (!collectionToDelete.value) return
  
  try {
    const currentDb = databasesStore.currentDatabase
    await collectionsStore.deleteCollection(collectionToDelete.value.name, currentDb)
    showDeleteDialog.value = false
    collectionToDelete.value = null
  } catch (error) {
    console.error('Failed to delete collection:', error)
  }
}

const confirmTruncate = (collection) => {
  collectionToTruncate.value = collection
  showTruncateDialog.value = true
}

const truncateCollection = async () => {
  if (!collectionToTruncate.value) return
  
  try {
    const currentDb = databasesStore.currentDatabase
    await collectionsStore.truncateCollection(collectionToTruncate.value.name, currentDb)
    showTruncateDialog.value = false
    collectionToTruncate.value = null
    // Refresh collections to update record counts
    await collectionsStore.fetchCollections(currentDb)
  } catch (error) {
    console.error('Failed to truncate collection:', error)
  }
}

const handleSave = async (collectionData) => {
  error.value = null // Clear any previous errors
  try {
    const currentDb = databasesStore.currentDatabase
    if (editingCollection.value) {
      await collectionsStore.updateCollection(editingCollection.value.id, collectionData, currentDb)
    } else {
      await collectionsStore.createCollection(collectionData, currentDb)
    }
    closeDialog()
  } catch (err) {
    error.value = err.message || 'Failed to save collection. Please try again.'
    console.error('Failed to save collection:', err)
  }
}

const closeDialog = () => {
  showCreateDialog.value = false
  editingCollection.value = null
  error.value = null
}

// Watch for database changes and refresh collections
watch(() => databasesStore.currentDatabase, async (newDb, oldDb) => {
  if (newDb !== oldDb) {
    try {
      // Clear current collections immediately to show loading state
      collectionsStore.collections = []
      
      // Reset system tables when database changes
      showSystemTables.value = false
      allCollections.value = []
      
      // Fetch collections for the new database
      await collectionsStore.fetchCollections(newDb)
    } catch (error) {
      console.error('Error fetching collections for database:', newDb, error)
    }
  }
}, { immediate: false })

onMounted(async () => {
  const currentDb = databasesStore.currentDatabase
  await collectionsStore.fetchCollections(currentDb)
})
</script>

