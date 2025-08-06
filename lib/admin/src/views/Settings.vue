<template>
  <div class="max-w-7xl mx-auto p-6">
    <div class="mb-8">
      <h1 class="text-3xl font-bold text-gray-900">Settings</h1>
      <p class="text-gray-600 mt-2">Manage API keys and security settings</p>
    </div>

    <!-- API Keys Section -->
    <Card class="mb-8">
      <template #header>
        <div class="flex justify-between items-center">
          <h2 class="text-xl font-semibold">API Keys</h2>
          <Button @click="showCreateModal = true" class="bg-blue-600 hover:bg-blue-700">
            <i class="ph ph-plus mr-2"></i>
            Create API Key
          </Button>
        </div>
      </template>

      <div v-if="loading" class="flex justify-center py-8">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>

      <div v-else-if="apiKeys.length === 0" class="text-center py-8 text-gray-500">
        <i class="ph ph-key text-4xl mb-4"></i>
        <p>No API keys created yet</p>
        <p class="text-sm">Create your first API key to enable external access</p>
      </div>

      <div v-else class="space-y-4">
        <div 
          v-for="key in apiKeys" 
          :key="key.id"
          class="border rounded-lg p-4 hover:bg-gray-50"
        >
          <div class="flex justify-between items-start">
            <div class="flex-1">
              <div class="flex items-center gap-3 mb-2">
                <h3 class="font-medium text-gray-900">{{ key.name }}</h3>
                <span 
                  :class="[
                    'px-2 py-1 text-xs rounded-full',
                    key.is_expired ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                  ]"
                >
                  {{ key.is_expired ? 'Expired' : 'Active' }}
                </span>
              </div>
              
              <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
                <div>
                  <span class="font-medium">Global Permissions:</span>
                  <div class="mt-1">
                    <span v-if="key.permissions.read" class="inline-block bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs mr-1">Read</span>
                    <span v-if="key.permissions.write" class="inline-block bg-green-100 text-green-800 px-2 py-1 rounded text-xs mr-1">Write</span>
                  </div>
                  <div class="mt-1 text-xs">
                    Collections: {{ key.permissions.collections.includes('*') ? 'All' : key.permissions.collections.join(', ') }}
                  </div>
                  
                  <!-- Database-specific permissions -->
                  <div v-if="key.database_permissions && Object.keys(key.database_permissions).length > 0" class="mt-2">
                    <span class="font-medium text-xs">Database Access:</span>
                    <div class="mt-1 space-y-1">
                      <div v-for="(perms, dbName) in key.database_permissions" :key="dbName" class="text-xs">
                        <div class="font-medium text-gray-700">{{ dbName }}:</div>
                        <div class="ml-2 flex flex-wrap gap-1">
                          <span v-if="perms.read" class="inline-block bg-blue-100 text-blue-800 px-1 py-0.5 rounded text-xs">Read</span>
                          <span v-if="perms.write" class="inline-block bg-green-100 text-green-800 px-1 py-0.5 rounded text-xs">Write</span>
                        </div>
                        <div class="ml-2 text-xs text-gray-500">
                          Collections: {{ perms.collections.includes('*') ? 'All' : perms.collections.join(', ') }}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div>
                  <span class="font-medium">Rate Limit:</span> {{ key.rate_limit }}/hour<br>
                  <span class="font-medium">Last Used:</span> 
                  {{ key.last_used_at ? formatDate(key.last_used_at) : 'Never' }}
                </div>
                
                <div>
                  <span class="font-medium">Created:</span> {{ formatDate(key.created_at) }}<br>
                  <span class="font-medium">Expires:</span> 
                  {{ key.expires_at ? formatDate(key.expires_at) : 'Never' }}
                </div>
              </div>
            </div>
            
            <div class="flex gap-2 ml-4">
              <Button 
                @click="editApiKey(key)" 
                size="sm" 
                variant="secondary"
                title="Edit API Key"
              >
                <i class="ph ph-pencil"></i>
              </Button>
              
              <Button 
                @click="regenerateApiKey(key)" 
                size="sm" 
                variant="secondary"
                title="Regenerate API Key"
              >
                <i class="ph ph-arrows-clockwise"></i>
              </Button>
              
              <Button 
                @click="deleteApiKey(key)" 
                size="sm" 
                variant="danger"
                title="Delete API Key"
              >
                <i class="ph ph-trash"></i>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Card>

    <!-- Create/Edit API Key Modal -->
    <Modal 
      :show="showCreateModal || showEditModal" 
      @close="closeModal"
      :title="isEditing ? 'Edit API Key' : 'Create API Key'"
    >
      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">Name</label>
          <Input 
            v-model="formData.name" 
            placeholder="Enter API key name..."
            :disabled="submitting"
          />
        </div>

        <!-- Permission Type Selection -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">Permission Type</label>
          <div class="space-y-2">
            <label class="flex items-center">
              <input 
                type="radio" 
                :value="'global'" 
                v-model="permissionType" 
                class="border-gray-300 text-blue-600 focus:ring-blue-500"
                :disabled="submitting"
              >
              <span class="ml-2 text-sm">Global permissions (applies to master database)</span>
            </label>
            <label class="flex items-center">
              <input 
                type="radio" 
                :value="'database'" 
                v-model="permissionType" 
                class="border-gray-300 text-blue-600 focus:ring-blue-500"  
                :disabled="submitting"
              >
              <span class="ml-2 text-sm">Database-specific permissions</span>
            </label>
          </div>
        </div>

        <!-- Global Permissions -->
        <div v-if="permissionType === 'global'">
          <label class="block text-sm font-medium text-gray-700 mb-2">Global Permissions</label>
          <div class="space-y-2">
            <label class="flex items-center">
              <input 
                type="checkbox" 
                v-model="formData.permissions.read" 
                class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                :disabled="submitting"
              >
              <span class="ml-2 text-sm">Read access</span>
            </label>
            <label class="flex items-center">
              <input 
                type="checkbox" 
                v-model="formData.permissions.write" 
                class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                :disabled="submitting"
              >
              <span class="ml-2 text-sm">Write access (create, update, delete)</span>
            </label>
          </div>
          
          <div class="mt-4">
            <label class="block text-sm font-medium text-gray-700 mb-2">Collections Access</label>
            <div class="space-y-2">
              <label class="flex items-center">
                <input 
                  type="radio" 
                  :value="'all'" 
                  v-model="collectionAccess" 
                  class="border-gray-300 text-blue-600 focus:ring-blue-500"
                  :disabled="submitting"
                >
                <span class="ml-2 text-sm">All collections</span>
              </label>
              <label class="flex items-center">
                <input 
                  type="radio" 
                  :value="'specific'" 
                  v-model="collectionAccess" 
                  class="border-gray-300 text-blue-600 focus:ring-blue-500"  
                  :disabled="submitting"
                >
                <span class="ml-2 text-sm">Specific collections</span>
              </label>
            </div>
            
            <div v-if="collectionAccess === 'specific'" class="mt-3">
              <Input 
                v-model="specificCollections" 
                placeholder="Enter collection names separated by commas..."
                :disabled="submitting"
              />
              <p class="text-xs text-gray-500 mt-1">Example: users,products,orders</p>
            </div>
          </div>
        </div>

        <!-- Database-specific Permissions -->
        <div v-if="permissionType === 'database'">
          <label class="block text-sm font-medium text-gray-700 mb-2">Database Permissions</label>
          
          <div v-if="databases.length === 0" class="text-sm text-gray-500 py-4">
            <i class="ph ph-database mr-2"></i>
            No additional databases available. Create databases in the Databases section.
          </div>
          
          <div v-else class="space-y-4 max-h-96 overflow-y-auto">
            <div 
              v-for="database in databases" 
              :key="database.name"
              class="border rounded-lg p-4"
            >
              <div class="flex items-center justify-between mb-2">
                <div class="flex items-center">
                  <label class="flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      :checked="isDatabaseEnabled(database.name)"
                      @change="toggleDatabaseAccess(database.name)"
                      class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      :disabled="submitting"
                    >
                    <span class="ml-2 font-medium">{{ database.name }}</span>
                  </label>
                  <span v-if="database.is_master" class="ml-2 px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">Master</span>
                  <span v-if="database.is_default" class="ml-2 px-2 py-1 text-xs bg-green-100 text-green-800 rounded">Default</span>
                </div>
              </div>
              
              <div v-if="isDatabaseEnabled(database.name)" class="ml-6 space-y-3">
                <!-- Permissions -->
                <div>
                  <label class="block text-sm font-medium text-gray-600 mb-1">Permissions</label>
                  <div class="flex gap-4">
                    <label class="flex items-center">
                      <input 
                        type="checkbox" 
                        :checked="getDatabasePermission(database.name, 'read')"
                        @change="setDatabasePermission(database.name, 'read', $event.target.checked)"
                        class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        :disabled="submitting"
                      >
                      <span class="ml-1 text-sm">Read</span>
                    </label>
                    <label class="flex items-center">
                      <input 
                        type="checkbox" 
                        :checked="getDatabasePermission(database.name, 'write')"
                        @change="setDatabasePermission(database.name, 'write', $event.target.checked)"
                        class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        :disabled="submitting"
                      >
                      <span class="ml-1 text-sm">Write</span>
                    </label>
                  </div>
                </div>
                
                <!-- Collections -->
                <div>
                  <label class="block text-sm font-medium text-gray-600 mb-1">Collections</label>
                  <div class="space-y-2">
                    <label class="flex items-center">
                      <input 
                        type="radio" 
                        :value="'all'" 
                        :checked="getDatabaseCollectionAccess(database.name) === 'all'"
                        @change="setDatabaseCollectionAccess(database.name, 'all')"
                        class="border-gray-300 text-blue-600 focus:ring-blue-500"
                        :disabled="submitting"
                      >
                      <span class="ml-2 text-sm">All collections</span>
                    </label>
                    <label class="flex items-center">
                      <input 
                        type="radio" 
                        :value="'specific'" 
                        :checked="getDatabaseCollectionAccess(database.name) === 'specific'"
                        @change="setDatabaseCollectionAccess(database.name, 'specific')"
                        class="border-gray-300 text-blue-600 focus:ring-blue-500"  
                        :disabled="submitting"
                      >
                      <span class="ml-2 text-sm">Specific collections</span>
                    </label>
                  </div>
                  
                  <div v-if="getDatabaseCollectionAccess(database.name) === 'specific'" class="mt-2">
                    <Input 
                      :modelValue="getDatabaseSpecificCollections(database.name)"
                      @update:modelValue="setDatabaseSpecificCollections(database.name, $event)"
                      placeholder="Enter collection names separated by commas..."
                      :disabled="submitting"
                      class="text-sm"
                    />
                    <p class="text-xs text-gray-500 mt-1">Example: users,products,orders</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">Rate Limit (requests per hour)</label>
          <Input 
            v-model.number="formData.rate_limit" 
            type="number" 
            min="1" 
            max="10000"
            :disabled="submitting"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">Expiration (optional)</label>
          <Input 
            v-model="formData.expires_at" 
            type="datetime-local"
            :disabled="submitting"
          />
        </div>
      </div>

      <template #footer>
        <div class="flex justify-end gap-3">
          <Button @click="closeModal" variant="secondary" :disabled="submitting">Cancel</Button>
          <Button @click="saveApiKey" :disabled="submitting || !formData.name">
            <div v-if="submitting" class="flex items-center">
              <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              {{ isEditing ? 'Updating...' : 'Creating...' }}
            </div>
            <span v-else>{{ isEditing ? 'Update' : 'Create' }}</span>
          </Button>
        </div>
      </template>
    </Modal>

    <!-- API Key Display Modal -->
    <Modal :show="showKeyModal" @close="showKeyModal = false" title="API Key Created">
      <div class="space-y-4">
        <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div class="flex items-start">
            <i class="ph ph-warning text-yellow-600 text-xl mr-3 mt-0.5"></i>
            <div>
              <h3 class="font-medium text-yellow-800">Important!</h3>
              <p class="text-sm text-yellow-700 mt-1">
                This is the only time you'll see this API key. Please copy it and store it securely.
              </p>
            </div>
          </div>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">Your API Key</label>
          <div class="flex">
            <Input 
              :modelValue="newApiKey" 
              readonly 
              class="font-mono text-sm"
              ref="apiKeyInput"
            />
            <Button @click="copyApiKey" class="ml-2" title="Copy to clipboard">
              <i class="ph ph-copy"></i>
            </Button>
          </div>
        </div>

        <div class="text-sm text-gray-600">
          <p><strong>Usage:</strong> Include this key in your requests using:</p>
          <ul class="list-disc list-inside mt-2 space-y-1">
            <li><code class="bg-gray-100 px-2 py-1 rounded">X-API-Key: {{ newApiKey }}</code></li>
            <li><code class="bg-gray-100 px-2 py-1 rounded">Authorization: Bearer {{ newApiKey }}</code></li>
          </ul>
        </div>
      </div>

      <template #footer>
        <div class="flex justify-end">
          <Button @click="showKeyModal = false">Close</Button>
        </div>
      </template>
    </Modal>
  </div>
</template>

<script>
import { ref, reactive, onMounted, computed, watch } from 'vue'
import api from '@/api'
import { useDatabasesStore } from '@/store/databases'
import Card from '@/components/ui/Card.vue'
import Button from '@/components/ui/Button.vue'
import Input from '@/components/ui/Input.vue'
import Modal from '@/components/ui/Modal.vue'

export default {
  name: 'Settings',
  components: {
    Card,
    Button,
    Input,
    Modal
  },
  setup() {
    const databasesStore = useDatabasesStore()
    
    const loading = ref(true)
    const submitting = ref(false)
    const apiKeys = ref([])
    const showCreateModal = ref(false)
    const showEditModal = ref(false)
    const showKeyModal = ref(false)
    const newApiKey = ref('')
    const editingKey = ref(null)
    const collectionAccess = ref('all')
    const specificCollections = ref('')
    const permissionType = ref('global')
    const databasePermissions = ref({})

    const formData = reactive({
      name: '',
      permissions: {
        read: true,
        write: false,
        collections: ['*']
      },
      database_permissions: {},
      rate_limit: 1000,
      expires_at: ''
    })

    const isEditing = computed(() => !!editingKey.value)
    
    // Filter out master database for database-specific permissions
    const databases = computed(() => {
      return databasesStore.databases.filter(db => !db.is_master)
    })

    // Database permission helper methods
    const isDatabaseEnabled = (dbName) => {
      return !!databasePermissions.value[dbName]
    }

    const toggleDatabaseAccess = (dbName) => {
      if (isDatabaseEnabled(dbName)) {
        delete databasePermissions.value[dbName]
      } else {
        databasePermissions.value[dbName] = {
          read: false,
          write: false,
          collections: ['*']
        }
      }
    }

    const getDatabasePermission = (dbName, permission) => {
      return databasePermissions.value[dbName]?.[permission] || false
    }

    const setDatabasePermission = (dbName, permission, value) => {
      if (!databasePermissions.value[dbName]) {
        databasePermissions.value[dbName] = {
          read: false,
          write: false,
          collections: ['*']
        }
      }
      databasePermissions.value[dbName][permission] = value
    }

    const getDatabaseCollectionAccess = (dbName) => {
      const perms = databasePermissions.value[dbName]
      if (!perms || !perms.collections) return 'all'
      return perms.collections.includes('*') ? 'all' : 'specific'
    }

    const setDatabaseCollectionAccess = (dbName, type) => {
      if (!databasePermissions.value[dbName]) {
        databasePermissions.value[dbName] = {
          read: false,
          write: false,
          collections: ['*']
        }
      }
      if (type === 'all') {
        databasePermissions.value[dbName].collections = ['*']
      } else {
        databasePermissions.value[dbName].collections = []
      }
    }

    const getDatabaseSpecificCollections = (dbName) => {
      const perms = databasePermissions.value[dbName]
      if (!perms || !perms.collections || perms.collections.includes('*')) {
        return ''
      }
      return perms.collections.join(', ')
    }

    const setDatabaseSpecificCollections = (dbName, value) => {
      if (!databasePermissions.value[dbName]) {
        databasePermissions.value[dbName] = {
          read: false,
          write: false,
          collections: []
        }
      }
      const collections = value
        .split(',')
        .map(c => c.trim())
        .filter(c => c.length > 0)
      databasePermissions.value[dbName].collections = collections.length > 0 ? collections : ['*']
    }

    const loadApiKeys = async () => {
      try {
        loading.value = true
        const response = await api.get('/api-keys')
        apiKeys.value = response.data
      } catch (error) {
        console.error('Failed to load API keys:', error)
        // Handle error appropriately
      } finally {
        loading.value = false
      }
    }

    const resetForm = () => {
      formData.name = ''
      formData.permissions = {
        read: true,
        write: false,
        collections: ['*']
      }
      formData.database_permissions = {}
      formData.rate_limit = 1000
      formData.expires_at = ''
      collectionAccess.value = 'all'
      specificCollections.value = ''
      permissionType.value = 'global'
      databasePermissions.value = {}
      editingKey.value = null
    }

    const closeModal = () => {
      showCreateModal.value = false
      showEditModal.value = false
      resetForm()
    }

    const editApiKey = (key) => {
      editingKey.value = key
      formData.name = key.name
      formData.permissions = { ...key.permissions }
      formData.database_permissions = key.database_permissions || {}
      formData.rate_limit = key.rate_limit
      formData.expires_at = key.expires_at || ''
      
      // Determine permission type
      if (key.database_permissions && Object.keys(key.database_permissions).length > 0) {
        permissionType.value = 'database'
        databasePermissions.value = { ...key.database_permissions }
      } else {
        permissionType.value = 'global'
        databasePermissions.value = {}
      }
      
      if (key.permissions.collections.includes('*')) {
        collectionAccess.value = 'all'
      } else {
        collectionAccess.value = 'specific'
        specificCollections.value = key.permissions.collections.join(', ')
      }
      
      showEditModal.value = true
    }

    const saveApiKey = async () => {
      try {
        submitting.value = true
        
        let permissions = { ...formData.permissions }
        let database_permissions = {}
        
        if (permissionType.value === 'global') {
          // Prepare global permissions based on collection access
          if (collectionAccess.value === 'all') {
            permissions.collections = ['*']
          } else {
            permissions.collections = specificCollections.value
              .split(',')
              .map(c => c.trim())
              .filter(c => c.length > 0)
          }
        } else {
          // Use database-specific permissions
          database_permissions = { ...databasePermissions.value }
          
          // Set global permissions to minimal for database-specific mode
          permissions = {
            read: false,
            write: false,
            collections: []
          }
        }

        const payload = {
          name: formData.name,
          permissions,
          database_permissions,
          rate_limit: formData.rate_limit,
          expires_at: formData.expires_at || null
        }

        if (isEditing.value) {
          await api.put(`/api-keys/${editingKey.value.id}`, payload)
        } else {
          const response = await api.post('/api-keys', payload)
          newApiKey.value = response.data.api_key
          showKeyModal.value = true
        }

        closeModal()
        await loadApiKeys()
      } catch (error) {
        console.error('Failed to save API key:', error)
        // Handle error appropriately
      } finally {
        submitting.value = false
      }
    }

    const regenerateApiKey = async (key) => {
      if (!confirm(`Are you sure you want to regenerate the API key "${key.name}"? The current key will become invalid.`)) {
        return
      }

      try {
        const response = await api.post(`/api-keys/${key.id}/regenerate`)
        newApiKey.value = response.data.api_key
        showKeyModal.value = true
        await loadApiKeys()
      } catch (error) {
        console.error('Failed to regenerate API key:', error)
      }
    }

    const deleteApiKey = async (key) => {
      if (!confirm(`Are you sure you want to delete the API key "${key.name}"? This action cannot be undone.`)) {
        return
      }

      try {
        await api.delete(`/api-keys/${key.id}`)
        await loadApiKeys()
      } catch (error) {
        console.error('Failed to delete API key:', error)
      }
    }

    const copyApiKey = async () => {
      try {
        await navigator.clipboard.writeText(newApiKey.value)
        // You could show a toast notification here
      } catch (error) {
        // Fallback for older browsers
        const input = document.createElement('input')
        input.value = newApiKey.value
        document.body.appendChild(input)
        input.select()
        document.execCommand('copy')
        document.body.removeChild(input)
      }
    }

    const formatDate = (dateString) => {
      return new Date(dateString).toLocaleString()
    }

    onMounted(async () => {
      await databasesStore.fetchDatabases()
      loadApiKeys()
    })

    return {
      loading,
      submitting,
      apiKeys,
      showCreateModal,
      showEditModal,
      showKeyModal,
      newApiKey,
      formData,
      isEditing,
      collectionAccess,
      specificCollections,
      permissionType,
      databases,
      databasePermissions,
      editApiKey,
      saveApiKey,
      regenerateApiKey,
      deleteApiKey,
      copyApiKey,
      closeModal,
      formatDate,
      // Database permission methods
      isDatabaseEnabled,
      toggleDatabaseAccess,
      getDatabasePermission,
      setDatabasePermission,
      getDatabaseCollectionAccess,
      setDatabaseCollectionAccess,
      getDatabaseSpecificCollections,
      setDatabaseSpecificCollections
    }
  }
}
</script>