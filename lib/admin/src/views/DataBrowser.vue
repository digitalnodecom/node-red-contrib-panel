<template>
  <div class="max-w-7xl mx-auto p-4">
    <div class="flex justify-between items-center mb-8">
      <div class="flex items-center gap-3">
        <div>
          <h2 class="text-2xl font-bold">{{ collectionName }}</h2>
          <p v-if="databasesStore.currentDatabase !== 'main'" class="text-sm text-gray-600">
            Database: {{ databasesStore.currentDatabase }}
          </p>
        </div>
        <span v-if="isSystemTable" class="inline-flex items-center px-2 py-1 text-xs font-medium bg-purple-100 text-purple-800 rounded-full">
          <i class="ph ph-gear-six mr-1"></i>
          System Table (Read-only)
        </span>
      </div>
      <div class="flex gap-3">
        <!-- Column Visibility Dropdown -->
        <div class="relative">
          <button
            @click="showColumnSelector = !showColumnSelector"
            class="px-4 py-2 bg-gray-600 text-white hover:bg-gray-700 transition-colors flex items-center gap-2"
          >
            <i class="ph ph-columns"></i>
            Columns
          </button>
          
          <!-- Column Selector Dropdown -->
          <div 
            v-if="showColumnSelector" 
            class="absolute right-0 mt-2 w-64 bg-white rounded-md shadow-lg z-10 border border-gray-200"
          >
            <div class="p-3 border-b border-gray-200">
              <div class="flex justify-between items-center">
                <span class="font-medium text-sm">Show/Hide Columns</span>
                <button 
                  @click="resetColumns"
                  class="text-xs text-blue-600 hover:text-blue-800"
                >
                  Reset
                </button>
              </div>
            </div>
            <div class="max-h-64 overflow-y-auto p-2">
              <label 
                v-for="field in allFields" 
                :key="field.name"
                class="flex items-center gap-2 p-2 hover:bg-gray-50 cursor-pointer"
              >
                <input
                  type="checkbox"
                  v-model="visibleColumns"
                  :value="field.name"
                  class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span class="text-sm">{{ field.name }}</span>
              </label>
            </div>
          </div>
        </div>
        
        <button
          v-if="!isSystemTable"
          @click="showRecordDialog = true"
          class="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <i class="ph ph-plus"></i>
          Add Record
        </button>
        <button
          @click="exportData"
          class="px-4 py-2 bg-gray-600 text-white hover:bg-gray-700 transition-colors flex items-center gap-2"
        >
          <i class="ph ph-download-simple"></i>
          Export
        </button>
      </div>
    </div>

    <div class="bg-white shadow-sm border border-gray-200 overflow-hidden">
      
      <div v-if="loading" class="flex justify-center items-center py-12">
        <div class="animate-spin h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
      
      <div v-else class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th
                v-for="field in displayedFields"
                :key="field.name"
                class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 whitespace-nowrap"
                @click="toggleSort(field.name)"
              >
                <div class="flex items-center gap-2 min-w-0">
                  <span class="truncate">{{ field.name }}</span>
                  <span v-if="sortField === field.name" class="text-gray-600 flex-shrink-0">
                    <i v-if="sortOrder === 'ASC'" class="ph ph-caret-up"></i>
                    <i v-else class="ph ph-caret-down"></i>
                  </span>
                  <span v-else class="text-gray-400 flex-shrink-0">
                    <i class="ph ph-caret-up-down"></i>
                  </span>
                </div>
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap" style="width: 80px">
                Actions
              </th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <tr v-for="(record, index) in records" :key="record.id || index" class="hover:bg-gray-50">
              <td
                v-for="field in displayedFields"
                :key="field.name"
                class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 relative group"
                @click="startEdit(record.id, field.name, record[field.name])"
              >
                <!-- Editing mode -->
                <div v-if="isEditing(record.id, field.name)" class="flex items-center gap-2">
                  <!-- Boolean checkbox -->
                  <input
                    v-if="field.type === 'boolean'"
                    v-model="editingValue"
                    type="checkbox"
                    class="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 focus:ring-blue-500 focus:ring-2"
                    @change="saveEdit(record.id, field.name)"
                    ref="editInput"
                  />
                  
                  <!-- Date input -->
                  <input
                    v-else-if="field.type === 'date'"
                    v-model="editingValue"
                    type="datetime-local"
                    class="w-full px-2 py-1 border border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                    @keyup.enter="saveEdit(record.id, field.name)"
                    @keyup.escape="cancelEdit"
                    @blur="saveEdit(record.id, field.name)"
                    ref="editInput"
                  />
                  
                  <!-- JSON textarea -->
                  <textarea
                    v-else-if="field.type === 'json'"
                    v-model="editingValue"
                    rows="3"
                    class="w-full px-2 py-1 border border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm font-mono resize-y"
                    @keyup.enter.meta="saveEdit(record.id, field.name)"
                    @keyup.enter.ctrl="saveEdit(record.id, field.name)"
                    @keyup.escape="cancelEdit"
                    @blur="saveEdit(record.id, field.name)"
                    ref="editInput"
                  ></textarea>
                  
                  <!-- Default text input -->
                  <input
                    v-else
                    v-model="editingValue"
                    type="text"
                    class="w-full px-2 py-1 border border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                    @keyup.enter="saveEdit(record.id, field.name)"
                    @keyup.escape="cancelEdit"
                    @blur="saveEdit(record.id, field.name)"
                    ref="editInput"
                  />
                  
                  <!-- Save/Cancel buttons for complex fields -->
                  <div v-if="field.type === 'json'" class="flex gap-1">
                    <button
                      @click="saveEdit(record.id, field.name)"
                      class="text-green-600 hover:text-green-800 p-1"
                      title="Save"
                    >
                      <i class="ph ph-check text-xs"></i>
                    </button>
                    <button
                      @click="cancelEdit"
                      class="text-red-600 hover:text-red-800 p-1"
                      title="Cancel"
                    >
                      <i class="ph ph-x text-xs"></i>
                    </button>
                  </div>
                </div>
                
                <!-- Display mode -->
                <div v-else :class="isSystemTable ? '' : 'cursor-pointer'">
                  {{ formatFieldValue(record[field.name], field) }}
                  <button
                    v-if="!isSystemTable"
                    class="absolute inset-0 w-full h-full opacity-0 group-hover:opacity-100 bg-gray-100 bg-opacity-50 flex items-center justify-center"
                    @click.stop="startEdit(record.id, field.name, record[field.name])"
                  >
                    <i class="ph ph-pencil text-gray-600"></i>
                  </button>
                </div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                <button
                  v-if="!isSystemTable"
                  @click="confirmDelete(record)"
                  class="text-red-600 hover:text-red-900"
                  title="Delete"
                >
                  <i class="ph ph-trash"></i>
                </button>
                <span v-else class="text-xs text-gray-400">Read-only</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      
      <!-- Pagination Controls Footer -->
      <div class="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 p-4 border-t border-gray-200 bg-gray-50">
        <!-- Left side: Pagination controls and record count -->
        <div class="flex flex-col sm:flex-row sm:items-center gap-4">
          <!-- Pagination navigation -->
          <div class="flex items-center gap-1">
            <button
              @click="goToFirstPage"
              :disabled="offset === 0"
              class="p-2 text-gray-600 hover:text-gray-900 disabled:text-gray-400 disabled:cursor-not-allowed"
              title="First page"
            >
              <i class="ph ph-caret-double-left"></i>
            </button>
            <button
              @click="goToPreviousPage"
              :disabled="offset === 0"
              class="p-2 text-gray-600 hover:text-gray-900 disabled:text-gray-400 disabled:cursor-not-allowed"
              title="Previous page"
            >
              <i class="ph ph-caret-left"></i>
            </button>
            
            <div class="flex items-center gap-2 mx-3">
              <span class="text-sm text-gray-600">Page</span>
              <input
                v-model.number="currentPage"
                @change="goToPage"
                type="number"
                min="1"
                :max="totalPages"
                class="border border-gray-300 rounded px-2 py-1 text-sm w-16 text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span class="text-sm text-gray-600">of {{ totalPages }}</span>
            </div>
            
            <button
              @click="goToNextPage"
              :disabled="offset + limit >= totalRecords"
              class="p-2 text-gray-600 hover:text-gray-900 disabled:text-gray-400 disabled:cursor-not-allowed"
              title="Next page"
            >
              <i class="ph ph-caret-right"></i>
            </button>
            <button
              @click="goToLastPage"
              :disabled="offset + limit >= totalRecords"
              class="p-2 text-gray-600 hover:text-gray-900 disabled:text-gray-400 disabled:cursor-not-allowed"
              title="Last page"
            >
              <i class="ph ph-caret-double-right"></i>
            </button>
          </div>
          
          <!-- Record count -->
          <div class="text-sm text-gray-600">
            Showing {{ recordsStart }}-{{ recordsEnd }} of {{ totalRecords }} records
          </div>
        </div>

        <!-- Right side: Rows per page and offset controls -->
        <div class="flex flex-col sm:flex-row sm:items-center gap-4">
          <!-- Rows per page -->
          <div class="flex items-center gap-2">
            <label class="text-sm text-gray-600 whitespace-nowrap">Rows per page:</label>
            <select
              v-model="limit"
              @change="onLimitChange"
              class="border border-gray-300 rounded px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option :value="10">10</option>
              <option :value="25">25</option>
              <option :value="50">50</option>
              <option :value="100">100</option>
              <option :value="250">250</option>
            </select>
          </div>
          
          <!-- Offset control -->
          <div class="flex items-center gap-2">
            <label class="text-sm text-gray-600 whitespace-nowrap">Start at record:</label>
            <input
              v-model.number="offsetRecord"
              @change="onOffsetRecordChange"
              type="number"
              min="1"
              :max="totalRecords"
              class="border border-gray-300 rounded px-3 py-1 text-sm w-20 text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Add/Edit Record Dialog -->
    <div v-if="showRecordDialog" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-white shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div class="flex justify-between items-center p-6 border-b border-gray-200">
          <h3 class="text-lg font-semibold">{{ editingRecord ? 'Edit Record' : 'Add Record' }}</h3>
          <button @click="closeDialog" class="text-gray-400 hover:text-gray-600">
            <i class="ph ph-x text-xl"></i>
          </button>
        </div>
        <div class="p-6">
          <RecordEditor
            :fields="userFields"
            :record="editingRecord"
            @save="handleSave"
            @cancel="closeDialog"
          />
        </div>
      </div>
    </div>

    <!-- Delete Confirmation -->
    <div v-if="showDeleteConfirm" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-white shadow-xl max-w-md w-full mx-4">
        <div class="p-6">
          <div class="flex items-center mb-4">
            <i class="ph ph-warning text-xl text-yellow-600 mr-3"></i>
            <h3 class="text-lg font-semibold">Delete Confirmation</h3>
          </div>
          <p class="text-gray-600 mb-6">Are you sure you want to delete this record?</p>
          <div class="flex justify-end space-x-3">
            <button
              @click="showDeleteConfirm = false"
              class="px-4 py-2 text-gray-600 bg-gray-200 hover:bg-gray-300 transition-colors"
            >
              Cancel
            </button>
            <button
              @click="confirmDeleteAction"
              class="px-4 py-2 bg-red-600 text-white hover:bg-red-700 transition-colors"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed, nextTick, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useCollectionsStore } from '@/store/collections'
import { useDatabasesStore } from '@/store/databases'
import api from '@/api'
import RecordEditor from '@/components/RecordEditor.vue'

const route = useRoute()
const collectionsStore = useCollectionsStore()
const databasesStore = useDatabasesStore()

const collectionName = computed(() => route.params.name)
const records = ref([])
const loading = ref(false)
const showRecordDialog = ref(false)
const editingRecord = ref(null)
const showDeleteConfirm = ref(false)
const recordToDelete = ref(null)
const showColumnSelector = ref(false)

// Pagination state
const limit = ref(25)
const offset = ref(0)
const totalRecords = ref(0)

// Sorting state - will be updated based on table type
const sortField = ref('id')
const sortOrder = ref('DESC')

// Column visibility state
const visibleColumns = ref([])

// Inline editing state
const editingCell = ref(null) // { recordId, fieldName }
const editingValue = ref(null)
const originalValue = ref(null)

const collection = computed(() => collectionsStore.currentCollection)
const userFields = computed(() => collection.value?.fields || [])
const isSystemTable = computed(() => collectionName.value.startsWith('_'))
const systemTableInfo = ref(null)

// System fields that are available for regular collections
const systemFields = [
  { name: 'id', type: 'integer', system: true },
  { name: 'created_at', type: 'datetime', system: true },
  { name: 'updated_at', type: 'datetime', system: true }
]

// All fields including system fields
const allFields = computed(() => {
  if (isSystemTable.value && systemTableInfo.value) {
    // For system tables, use the actual column info from the database
    return systemTableInfo.value.columns.map(col => ({
      name: col.name,
      type: getSQLiteTypeMapping(col.type),
      system: true,
      nullable: !col.notnull,
      primary: col.pk === 1
    }))
  } else {
    // For regular collections, use system + user fields
    return [...systemFields, ...userFields.value]
  }
})

const getSQLiteTypeMapping = (sqliteType) => {
  const type = sqliteType.toLowerCase()
  if (type.includes('int')) return 'integer'
  if (type.includes('text') || type.includes('varchar') || type.includes('char')) return 'text'
  if (type.includes('real') || type.includes('float') || type.includes('double')) return 'float'
  if (type.includes('datetime') || type.includes('timestamp')) return 'datetime'
  if (type.includes('date')) return 'date'
  if (type.includes('bool')) return 'boolean'
  return 'text' // default
}

// Fields to display based on visibility settings
const displayedFields = computed(() => {
  return allFields.value.filter(field => visibleColumns.value.includes(field.name))
})

// Pagination calculations
const currentPage = computed({
  get: () => Math.floor(offset.value / limit.value) + 1,
  set: (page) => {
    offset.value = (page - 1) * limit.value
    fetchRecords()
  }
})

const totalPages = computed(() => Math.ceil(totalRecords.value / limit.value))

const recordsStart = computed(() => {
  if (totalRecords.value === 0) return 0
  return offset.value + 1
})

const recordsEnd = computed(() => {
  const end = offset.value + limit.value
  return end > totalRecords.value ? totalRecords.value : end
})

// User-friendly offset (1-based instead of 0-based)
const offsetRecord = computed({
  get: () => offset.value + 1,
  set: (value) => {
    offset.value = Math.max(0, value - 1)
  }
})

// Load column visibility from localStorage
const loadColumnVisibility = () => {
  const saved = localStorage.getItem(`columns_${collectionName.value}`)
  if (saved) {
    visibleColumns.value = JSON.parse(saved)
  } else {
    // Default columns based on table type
    if (isSystemTable.value && systemTableInfo.value) {
      // For system tables, show all columns by default
      visibleColumns.value = systemTableInfo.value.columns.map(col => col.name)
    } else {
      // For regular collections, show system + user fields
      visibleColumns.value = ['id', ...userFields.value.map(f => f.name)]
    }
  }
}

// Save column visibility to localStorage
const saveColumnVisibility = () => {
  localStorage.setItem(`columns_${collectionName.value}`, JSON.stringify(visibleColumns.value))
}

// Watch for changes in visible columns
watch(visibleColumns, () => {
  saveColumnVisibility()
}, { deep: true })

// Load pagination settings from localStorage
const loadPaginationSettings = () => {
  const savedLimit = localStorage.getItem('records_per_page')
  if (savedLimit) {
    limit.value = parseInt(savedLimit)
  }
}

// Save pagination settings
const savePaginationSettings = () => {
  localStorage.setItem('records_per_page', limit.value.toString())
}

const fetchRecords = async () => {
  loading.value = true
  try {
    const endpoint = databasesStore.currentDatabase !== 'main'
      ? `/databases/${databasesStore.currentDatabase}/${collectionName.value}`
      : `/${collectionName.value}`
    const response = await api.get(endpoint, {
      params: {
        limit: limit.value,
        offset: offset.value,
        sort: sortField.value,
        order: sortOrder.value
      }
    })
    
    if (response.data.data) {
      records.value = response.data.data
      totalRecords.value = response.data.pagination?.total || 0
    } else {
      // Fallback for old API format
      records.value = response.data
      totalRecords.value = records.value.length
    }
  } catch (error) {
    console.error('Error fetching records:', error)
    records.value = []
    totalRecords.value = 0
  } finally {
    loading.value = false
  }
}

const formatFieldValue = (value, field) => {
  if (value === null || value === undefined) return '-'
  
  switch (field.type) {
    case 'boolean':
      return value ? '✓' : '✗'
    case 'date':
      return new Date(value).toLocaleDateString()
    case 'datetime':
      return new Date(value).toLocaleString()
    case 'json':
      return typeof value === 'string' ? value : JSON.stringify(value)
    default:
      return value
  }
}

const isEditing = (recordId, fieldName) => {
  return editingCell.value?.recordId === recordId && editingCell.value?.fieldName === fieldName
}

const startEdit = async (recordId, fieldName, value) => {
  // Don't edit system fields except for inline editing
  const field = allFields.value.find(f => f.name === fieldName)
  if (field?.system && fieldName !== 'id') return
  
  editingCell.value = { recordId, fieldName }
  originalValue.value = value
  
  // Format value for editing
  if (field?.type === 'json' && typeof value === 'object') {
    editingValue.value = JSON.stringify(value, null, 2)
  } else if (field?.type === 'date' && value) {
    editingValue.value = new Date(value).toISOString().slice(0, 16)
  } else {
    editingValue.value = value
  }
  
  await nextTick()
  const input = document.querySelector('input[ref="editInput"], textarea[ref="editInput"]')
  if (input) {
    input.focus()
    input.select()
  }
}

const cancelEdit = () => {
  editingCell.value = null
  editingValue.value = null
  originalValue.value = null
}

const saveEdit = async (recordId, fieldName) => {
  const field = allFields.value.find(f => f.name === fieldName)
  let valueToSave = editingValue.value
  
  // Parse JSON fields
  if (field?.type === 'json' && typeof editingValue.value === 'string') {
    try {
      valueToSave = JSON.parse(editingValue.value)
    } catch (e) {
      console.error('Invalid JSON:', e)
      return
    }
  }
  
  // Don't save if value hasn't changed
  if (valueToSave === originalValue.value) {
    cancelEdit()
    return
  }
  
  try {
    const record = records.value.find(r => r.id === recordId)
    const endpoint = databasesStore.currentDatabase !== 'main'
      ? `/databases/${databasesStore.currentDatabase}/${collectionName.value}/${recordId}`
      : `/${collectionName.value}/${recordId}`
    await api.put(endpoint, {
      ...record,
      [fieldName]: valueToSave
    })
    
    // Update local record
    record[fieldName] = valueToSave
    cancelEdit()
  } catch (error) {
    console.error('Error updating record:', error)
    alert('Failed to update record')
  }
}

const toggleSort = (fieldName) => {
  if (sortField.value === fieldName) {
    // Toggle between ASC, DESC, and no sort
    if (sortOrder.value === 'ASC') {
      sortOrder.value = 'DESC'
    } else if (sortOrder.value === 'DESC') {
      // Reset to default sort
      sortField.value = 'id'
      sortOrder.value = 'DESC'
    }
  } else {
    sortField.value = fieldName
    sortOrder.value = 'ASC'
  }
  
  // Reset to first page when sorting changes
  offset.value = 0
  fetchRecords()
}

const onLimitChange = () => {
  // Reset to first page when limit changes
  offset.value = 0
  savePaginationSettings()
  fetchRecords()
}

const onOffsetChange = () => {
  // Ensure offset is within bounds
  if (offset.value < 0) offset.value = 0
  if (offset.value >= totalRecords.value) {
    offset.value = Math.max(0, totalRecords.value - limit.value)
  }
  fetchRecords()
}

const onOffsetRecordChange = () => {
  // Ensure offset record is within bounds (1-based)
  const recordNumber = offsetRecord.value
  if (recordNumber < 1) {
    offsetRecord.value = 1
  } else if (recordNumber > totalRecords.value) {
    offsetRecord.value = totalRecords.value
  }
  fetchRecords()
}

const goToFirstPage = () => {
  offset.value = 0
  fetchRecords()
}

const goToPreviousPage = () => {
  offset.value = Math.max(0, offset.value - limit.value)
  fetchRecords()
}

const goToNextPage = () => {
  if (offset.value + limit.value < totalRecords.value) {
    offset.value += limit.value
    fetchRecords()
  }
}

const goToLastPage = () => {
  offset.value = Math.max(0, Math.floor((totalRecords.value - 1) / limit.value) * limit.value)
  fetchRecords()
}

const goToPage = () => {
  const page = currentPage.value
  if (page >= 1 && page <= totalPages.value) {
    offset.value = (page - 1) * limit.value
    fetchRecords()
  }
}

const resetColumns = () => {
  if (isSystemTable.value && systemTableInfo.value) {
    // For system tables, show all columns
    visibleColumns.value = systemTableInfo.value.columns.map(col => col.name)
  } else {
    // For regular collections, show system + user fields
    visibleColumns.value = ['id', ...userFields.value.map(f => f.name)]
  }
  saveColumnVisibility()
}

const confirmDelete = (record) => {
  recordToDelete.value = record
  showDeleteConfirm.value = true
}

const confirmDeleteAction = async () => {
  if (!recordToDelete.value) return
  
  try {
    const endpoint = databasesStore.currentDatabase !== 'main'
      ? `/databases/${databasesStore.currentDatabase}/${collectionName.value}/${recordToDelete.value.id}`
      : `/${collectionName.value}/${recordToDelete.value.id}`
    await api.delete(endpoint)
    await fetchRecords()
  } catch (error) {
    console.error('Error deleting record:', error)
    alert('Failed to delete record')
  } finally {
    showDeleteConfirm.value = false
    recordToDelete.value = null
  }
}

const closeDialog = () => {
  showRecordDialog.value = false
  editingRecord.value = null
}

const handleSave = async (data) => {
  try {
    if (editingRecord.value) {
      const endpoint = databasesStore.currentDatabase !== 'main'
        ? `/databases/${databasesStore.currentDatabase}/${collectionName.value}/${editingRecord.value.id}`
        : `/${collectionName.value}/${editingRecord.value.id}`
      await api.put(endpoint, data)
    } else {
      const endpoint = databasesStore.currentDatabase !== 'main'
        ? `/databases/${databasesStore.currentDatabase}/${collectionName.value}`
        : `/${collectionName.value}`
      await api.post(endpoint, data)
    }
    await fetchRecords()
    closeDialog()
  } catch (error) {
    console.error('Error saving record:', error)
    alert('Failed to save record')
  }
}

const exportData = () => {
  const dataStr = JSON.stringify(records.value, null, 2)
  const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr)
  
  const exportFileDefaultName = `${collectionName.value}_${new Date().toISOString().split('T')[0]}.json`
  
  const linkElement = document.createElement('a')
  linkElement.setAttribute('href', dataUri)
  linkElement.setAttribute('download', exportFileDefaultName)
  linkElement.click()
}

// Click outside to close column selector
const handleClickOutside = (event) => {
  const columnSelector = document.querySelector('.relative')
  if (columnSelector && !columnSelector.contains(event.target)) {
    showColumnSelector.value = false
  }
}

onMounted(async () => {
  if (isSystemTable.value) {
    // For system tables, get column info via a direct request
    try {
      const endpoint = databasesStore.currentDatabase !== 'main'
        ? `/databases/${databasesStore.currentDatabase}/collections?system=true`
        : '/collections?system=true'
      const tableResponse = await api.get(endpoint)
      const table = tableResponse.data.find(t => t.name === collectionName.value)
      if (table) {
        systemTableInfo.value = table
        
        // Set default sort field for system tables
        if (table.columns && table.columns.length > 0) {
          // Use the first column if 'id' doesn't exist
          const hasId = table.columns.some(col => col.name === 'id')
          if (!hasId) {
            sortField.value = table.columns[0].name
          }
        }
      }
    } catch (error) {
      console.error('Failed to fetch system table info:', error)
    }
  } else {
    // For regular collections, use the collections store
    await collectionsStore.fetchCollection(collectionName.value)
  }
  
  loadPaginationSettings()
  loadColumnVisibility()
  await fetchRecords()
  
  // Add click outside listener
  document.addEventListener('click', handleClickOutside)
})

// Watch for database changes and refresh data
watch(() => databasesStore.currentDatabase, () => {
  // Re-fetch collection info and records when database changes
  if (isSystemTable.value) {
    // Re-initialize system table info
    systemTableInfo.value = null
    loadColumnVisibility()
  } else {
    collectionsStore.fetchCollection(collectionName.value)
  }
  fetchRecords()
})

// Clean up event listener
onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped>
/* Custom scrollbar for column selector */
.max-h-64::-webkit-scrollbar {
  width: 6px;
}

.max-h-64::-webkit-scrollbar-track {
  background: #f3f4f6;
}

.max-h-64::-webkit-scrollbar-thumb {
  background: #9ca3af;
  border-radius: 3px;
}

.max-h-64::-webkit-scrollbar-thumb:hover {
  background: #6b7280;
}
</style>