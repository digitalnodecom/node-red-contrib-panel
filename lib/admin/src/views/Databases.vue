<template>
  <div class="max-w-7xl mx-auto p-6">
    <div class="mb-6">
      <div class="flex justify-between items-start">
        <div>
          <h1 class="text-2xl font-bold text-gray-900 mb-2">Manage Databases</h1>
          <p class="text-gray-600">Manage multiple databases for your Node-RED Panel instance.</p>
        </div>
        <button 
          @click="showCreateModal = true" 
          class="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <i class="ph ph-plus"></i>
          Create Database
        </button>
      </div>
    </div>

    <!-- Database Stats -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6" v-if="stats">
      <Card>
        <div class="text-center">
          <div class="text-2xl font-bold text-blue-600">{{ stats.total_databases }}</div>
          <div class="text-sm text-gray-600">Total Databases</div>
        </div>
      </Card>
      <Card>
        <div class="text-center">
          <div class="text-2xl font-bold text-green-600">{{ stats.total_collections }}</div>
          <div class="text-sm text-gray-600">Total Collections</div>
        </div>
      </Card>
      <Card>
        <div class="text-center">
          <div class="text-2xl font-bold text-purple-600">{{ stats.total_records }}</div>
          <div class="text-sm text-gray-600">Total Records</div>
        </div>
      </Card>
      <Card>
        <div class="text-center">
          <div class="text-2xl font-bold text-orange-600">{{ Math.round(stats.total_records / Math.max(stats.total_collections, 1)) }}</div>
          <div class="text-sm text-gray-600">Avg Records/Collection</div>
        </div>
      </Card>
    </div>

    <!-- Databases List -->
    <Card>
      <div class="overflow-hidden">
        <div class="px-6 py-4 border-b border-gray-200">
          <h3 class="text-lg font-semibold text-gray-900">Databases</h3>
        </div>
        
        <div v-if="loading" class="p-6 text-center">
          <i class="ph ph-spinner ph-spin text-2xl text-gray-400"></i>
          <p class="text-gray-600 mt-2">Loading databases...</p>
        </div>

        <div v-else-if="error" class="p-6 text-center text-red-600">
          <i class="ph ph-warning-circle text-2xl"></i>
          <p class="mt-2">{{ error }}</p>
        </div>

        <div v-else class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Database</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Collections</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created & Mode</th>
                <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              <tr v-for="database in databases" :key="database.name" :class="{'bg-blue-50': database.name === databasesStore.currentDatabase}">
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="flex items-center">
                    <div class="flex-shrink-0 h-10 w-10">
                      <div class="h-10 w-10 rounded-lg flex items-center justify-center" :class="{
                        'bg-yellow-100': database.is_master,
                        'bg-blue-100': database.is_default && !database.is_master,
                        'bg-gray-100': !database.is_default && !database.is_master
                      }">
                        <i class="ph" :class="{
                          'ph-crown text-yellow-600': database.is_master,
                          'ph-database text-blue-600': database.is_default && !database.is_master,
                          'ph-database text-gray-600': !database.is_default && !database.is_master
                        }"></i>
                      </div>
                    </div>
                    <div class="ml-4">
                      <div class="text-sm font-medium text-gray-900 flex items-center gap-2">
                        {{ database.display_name }}
                        <span v-if="database.is_master" class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                          Master
                        </span>
                        <span v-if="database.is_default" class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                          Default
                        </span>
                      </div>
                      <div class="text-sm text-gray-500">{{ database.name }}.db</div>
                      <div v-if="database.description" class="text-sm text-gray-500 mt-1">{{ database.description }}</div>
                    </div>
                  </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {{ database.collection_count || 0 }} collections
                  <div class="text-xs text-gray-500">{{ database.total_records || 0 }} records</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium" :class="{
                    'bg-green-100 text-green-800': database.is_active,
                    'bg-red-100 text-red-800': !database.is_active
                  }">
                    {{ database.is_active ? 'Active' : 'Inactive' }}
                  </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {{ formatDate(database.created_at) }}
                  <div v-if="database.journal_mode" class="text-xs mt-1">
                    <span :class="getJournalModeClass(database.journal_mode)" class="px-1 py-0.5 rounded text-xs">
                      {{ database.journal_mode }}
                    </span>
                  </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div class="flex justify-end gap-2">
                    <button 
                      @click="setCurrentDatabase(database.name)"
                      :disabled="database.name === databasesStore.currentDatabase"
                      class="px-3 py-1 text-sm text-blue-600 border border-blue-600 hover:bg-blue-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                    >
                      <i class="ph ph-check" v-if="database.name === databasesStore.currentDatabase"></i>
                      {{ database.name === databasesStore.currentDatabase ? 'Current' : 'Switch To' }}
                    </button>
                    <button 
                      @click="editDatabase(database)"
                      class="px-3 py-1 text-sm text-gray-600 border border-gray-600 hover:bg-gray-50 transition-colors flex items-center gap-1"
                    >
                      <i class="ph ph-pencil"></i>
                      Edit
                    </button>
                    <button 
                      @click="manageDatabase(database)"
                      class="px-3 py-1 text-sm text-green-600 border border-green-600 hover:bg-green-50 transition-colors flex items-center gap-1"
                    >
                      <i class="ph ph-gear"></i>
                      Manage
                    </button>
                    <button 
                      @click="deleteDatabase(database)"
                      :disabled="database.is_master"
                      class="px-3 py-1 text-sm text-red-600 border border-red-600 hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                    >
                      <i class="ph ph-trash"></i>
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </Card>

    <!-- Create Database Modal -->
    <Modal :show="showCreateModal" @close="showCreateModal = false" title="Create New Database" size="md">
      <form @submit.prevent="createDatabase">
        <div class="space-y-4">
          <div>
            <label for="db-name" class="block text-sm font-medium text-gray-700 mb-1">Database Name</label>
            <Input
              id="db-name"
              v-model="newDatabase.name"
              placeholder="e.g., analytics"
              required
              pattern="[a-zA-Z][a-zA-Z0-9_]*"
              title="Must start with a letter and contain only letters, numbers, and underscores"
            />
            <p class="text-xs text-gray-500 mt-1">Must start with a letter and contain only letters, numbers, and underscores</p>
          </div>
          <div>
            <label for="db-display-name" class="block text-sm font-medium text-gray-700 mb-1">Display Name</label>
            <Input
              id="db-display-name"
              v-model="newDatabase.display_name"
              placeholder="e.g., Analytics Database"
              required
            />
          </div>
          <div>
            <label for="db-description" class="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              id="db-description"
              v-model="newDatabase.description"
              placeholder="Optional description of this database"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              rows="3"
            ></textarea>
          </div>
        </div>
        <div class="flex justify-end gap-3 mt-6">
          <button 
            type="button" 
            @click="showCreateModal = false"
            class="px-4 py-2 text-gray-700 border border-gray-300 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button 
            type="submit" 
            :disabled="!newDatabase.name || !newDatabase.display_name"
            class="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Create Database
          </button>
        </div>
      </form>
    </Modal>

    <!-- Edit Database Modal -->
    <Modal :show="showEditModal" @close="showEditModal = false" title="Edit Database" size="md">
      <form @submit.prevent="updateDatabase" v-if="editingDatabase">
        <div class="space-y-4">
          <div>
            <label for="edit-display-name" class="block text-sm font-medium text-gray-700 mb-1">Display Name</label>
            <Input
              id="edit-display-name"
              v-model="editingDatabase.display_name"
              required
            />
          </div>
          <div>
            <label for="edit-description" class="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              id="edit-description"
              v-model="editingDatabase.description"
              placeholder="Optional description of this database"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              rows="3"
            ></textarea>
          </div>
          <div v-if="!editingDatabase.is_master">
            <label class="flex items-center">
              <input
                type="checkbox"
                v-model="editingDatabase.is_default"
                class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <span class="ml-2 text-sm text-gray-700">Set as default database</span>
            </label>
          </div>
        </div>
        <div class="flex justify-end gap-3 mt-6">
          <button 
            type="button" 
            @click="showEditModal = false"
            class="px-4 py-2 text-gray-700 border border-gray-300 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button 
            type="submit" 
            class="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 transition-colors"
          >
            Update Database
          </button>
        </div>
      </form>
    </Modal>

    <!-- Manage Database Modal -->
    <Modal :show="showManageModal" @close="showManageModal = false" title="Manage Database" size="lg">
      <div v-if="managingDatabase" class="space-y-6">
        <!-- Database Information -->
        <div>
          <h3 class="text-lg font-medium text-gray-900 mb-3">Database Information</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="bg-gray-50 p-4 rounded-lg">
              <div class="text-sm font-medium text-gray-700 mb-1">Name</div>
              <div class="text-gray-900">{{ managingDatabase.name }}</div>
            </div>
            <div class="bg-gray-50 p-4 rounded-lg">
              <div class="text-sm font-medium text-gray-700 mb-1">Display Name</div>
              <div class="text-gray-900">{{ managingDatabase.display_name }}</div>
            </div>
            <div class="bg-gray-50 p-4 rounded-lg">
              <div class="text-sm font-medium text-gray-700 mb-1">Collections</div>
              <div class="text-gray-900">{{ managingDatabase.collection_count || 0 }}</div>
            </div>
            <div class="bg-gray-50 p-4 rounded-lg">
              <div class="text-sm font-medium text-gray-700 mb-1">Total Records</div>
              <div class="text-gray-900">{{ managingDatabase.total_records || 0 }}</div>
            </div>
          </div>
        </div>

        <!-- Journal Mode Management -->
        <div class="border-t border-gray-200 pt-6">
          <h3 class="text-lg font-medium text-gray-900 mb-3">Journal Mode</h3>
          <div class="flex items-center justify-between mb-4">
            <div>
              <div class="text-sm font-medium text-gray-700 mb-1">Current Mode</div>
              <span :class="getJournalModeClass(managingDatabase.journal_mode)" class="px-2 py-1 text-xs font-medium rounded-full">
                {{ (managingDatabase.journal_mode || 'UNKNOWN').toUpperCase() }}
              </span>
            </div>
            <div v-if="!showJournalModeSelect">
              <button @click="startJournalModeEdit"
                      class="flex items-center gap-1 px-3 py-2 text-sm bg-yellow-50 text-yellow-700 border border-yellow-200 hover:bg-yellow-100 transition-colors">
                <i class="ph ph-warning"></i>
                Change Mode
              </button>
            </div>
          </div>
          
          <div v-if="showJournalModeSelect" class="flex items-center gap-2 mb-4">
            <select v-model="selectedJournalMode" 
                    class="px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
              <option v-for="mode in journalModes" :key="mode.value" :value="mode.value">
                {{ mode.label }}
              </option>
            </select>
            <button @click="changeJournalMode" 
                    :disabled="changingJournalMode || selectedJournalMode === managingDatabase.journal_mode"
                    class="px-3 py-2 text-sm bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
              {{ changingJournalMode ? 'Changing...' : 'Apply' }}
            </button>
            <button @click="cancelJournalModeChange"
                    class="px-3 py-2 text-sm bg-gray-500 text-white hover:bg-gray-600 transition-colors">
              Cancel
            </button>
          </div>
          
          <div v-if="journalModeWarning" :class="getWarningClass()" class="p-3 text-sm">
            <i :class="getWarningIconClass()" class="mr-1"></i>
            {{ journalModeWarning }}
          </div>
        </div>
      </div>
    </Modal>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useDatabasesStore } from '@/store/databases'
import Card from '@/components/ui/Card.vue'
import Input from '@/components/ui/Input.vue'
import Modal from '@/components/ui/Modal.vue'
import api from '@/api'

const databasesStore = useDatabasesStore()

const showCreateModal = ref(false)
const showEditModal = ref(false)
const showManageModal = ref(false)
const editingDatabase = ref(null)
const managingDatabase = ref(null)
const stats = ref(null)
const showJournalModeSelect = ref(false)
const selectedJournalMode = ref('')
const changingJournalMode = ref(false)
const journalModeWarning = ref('')
const journalModeChangeSuccess = ref(true)

const newDatabase = ref({
  name: '',
  display_name: '',
  description: ''
})

const journalModes = [
  { value: 'DELETE', label: 'DELETE (Default - Safe)' },
  { value: 'TRUNCATE', label: 'TRUNCATE (Faster cleanup)' },
  { value: 'PERSIST', label: 'PERSIST (Minimal I/O)' },
  { value: 'WAL', label: 'WAL (Best performance)' },
  { value: 'MEMORY', label: 'MEMORY (Unsafe - RAM only)' },
  { value: 'OFF', label: 'OFF (Dangerous - No safety)' }
]

const loading = computed(() => databasesStore.loading)
const error = computed(() => databasesStore.error)
const databases = computed(() => databasesStore.databases)

const formatDate = (dateString) => {
  if (!dateString) return 'N/A'
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

const createDatabase = async () => {
  try {
    await databasesStore.createDatabase(newDatabase.value)
    showCreateModal.value = false
    newDatabase.value = { name: '', display_name: '', description: '' }
    await loadStats() // Refresh stats
  } catch (error) {
    console.error('Error creating database:', error)
  }
}

const editDatabase = (database) => {
  editingDatabase.value = { ...database }
  showEditModal.value = true
}

const updateDatabase = async () => {
  try {
    await databasesStore.updateDatabase(editingDatabase.value.name, {
      display_name: editingDatabase.value.display_name,
      description: editingDatabase.value.description,
      is_default: editingDatabase.value.is_default
    })
    showEditModal.value = false
    editingDatabase.value = null
    await loadStats() // Refresh stats
  } catch (error) {
    console.error('Error updating database:', error)
  }
}

const deleteDatabase = async (database) => {
  if (database.is_master) {
    alert('Cannot delete master database')
    return
  }
  
  if (confirm(`Are you sure you want to delete database "${database.display_name}"? This action cannot be undone.`)) {
    try {
      await databasesStore.deleteDatabase(database.name)
      await loadStats() // Refresh stats
    } catch (error) {
      console.error('Error deleting database:', error)
      alert('Error deleting database: ' + error.message)
    }
  }
}

const setCurrentDatabase = (dbId) => {
  databasesStore.setCurrentDatabase(dbId)
  // Refresh the page to update all components
  window.location.reload()
}

const getJournalModeClass = (mode) => {
  if (!mode) return 'bg-gray-100 text-gray-800'
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

const manageDatabase = (database) => {
  managingDatabase.value = { ...database }
  showManageModal.value = true
  // Reset journal mode state
  showJournalModeSelect.value = false
  selectedJournalMode.value = ''
  journalModeWarning.value = ''
  journalModeChangeSuccess.value = true
}

const startJournalModeEdit = () => {
  showJournalModeSelect.value = true
  selectedJournalMode.value = (managingDatabase.value.journal_mode || 'DELETE').toUpperCase()
  journalModeWarning.value = ''
}

const cancelJournalModeChange = () => {
  showJournalModeSelect.value = false
  selectedJournalMode.value = ''
  journalModeWarning.value = ''
  journalModeChangeSuccess.value = true
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

const changeJournalMode = async () => {
  const mode = selectedJournalMode.value
  if (!mode || mode === managingDatabase.value.journal_mode) return
  
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
    const endpoint = managingDatabase.value.name !== 'master'
      ? `/databases/${managingDatabase.value.name}/system/journal-mode`
      : '/system/journal-mode'
    const response = await api.put(endpoint, { mode })
    
    // Update the managing database with the actual mode returned
    managingDatabase.value.journal_mode = response.data.journalMode
    
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
      showJournalModeSelect.value = false
      selectedJournalMode.value = ''
      
      // Refresh the databases list to show updated journal mode
      await databasesStore.fetchDatabases()
    }
    
  } catch (error) {
    console.error('Failed to change journal mode:', error)
    journalModeChangeSuccess.value = false
    journalModeWarning.value = error.response?.data?.error || 'Failed to change journal mode'
  } finally {
    changingJournalMode.value = false
  }
}

const loadStats = async () => {
  try {
    stats.value = await databasesStore.getDatabaseStats()
  } catch (error) {
    console.error('Error loading database stats:', error)
  }
}

onMounted(async () => {
  await databasesStore.fetchDatabases()
  await loadStats()
})
</script>