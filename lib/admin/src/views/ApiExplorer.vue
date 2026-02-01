<template>
  <div class="max-w-4xl mx-auto p-6">
    <div class="mb-8">
      <h2 class="text-2xl font-bold text-gray-900 mb-2">API Explorer</h2>
      <p class="text-gray-600">
        Test your Panel API endpoints
        <span v-if="databasesStore.currentDatabase !== 'main'" class="ml-2 text-sm font-medium text-blue-600">
          (Database: {{ databasesStore.currentDatabase }})
        </span>
      </p>
    </div>

    <div class="bg-white shadow p-6">
      <div class="mb-6">
        <Select
          v-model="selectedEndpointValue"
          :options="endpointOptions"
          placeholder="Select an endpoint"
          label="API Endpoint"
        />
      </div>

      <div v-if="selectedEndpoint" class="space-y-6">
        <div class="flex items-center gap-4 p-4 bg-gray-50">
          <span 
            class="px-3 py-1 text-xs font-bold uppercase"
            :class="getMethodClass(selectedEndpoint.method)"
          >
            {{ selectedEndpoint.method }}
          </span>
          <code class="flex-1 bg-gray-100 px-3 py-1 font-mono text-sm">
            {{ selectedEndpoint.url }}
          </code>
        </div>

        <p class="text-gray-600">{{ selectedEndpoint.description }}</p>

        <div v-if="selectedEndpoint.params">
          <h3 class="text-lg font-medium mb-4">Parameters</h3>
          <div class="space-y-4">
            <Input
              v-for="param in selectedEndpoint.params"
              :key="param.name"
              v-model="params[param.name]"
              :label="param.name"
              :placeholder="param.placeholder"
            />
          </div>
        </div>

        <div v-if="selectedEndpoint.body">
          <h3 class="text-lg font-medium mb-4">Request Body</h3>
          <textarea
            v-model="requestBody"
            rows="10"
            class="w-full px-3 py-2 border border-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
            placeholder="Enter JSON body"
          ></textarea>
        </div>

        <button
          @click="sendRequest"
          :disabled="loading"
          class="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
        >
          <i class="ph ph-paper-plane-right"></i>
          Send Request
        </button>

        <div v-if="response" class="border-t pt-6">
          <h3 class="text-lg font-medium mb-4">Response</h3>
          <div class="flex items-center gap-4 mb-4">
            <span 
              class="px-3 py-1 text-sm font-medium"
              :class="getStatusClass(response.status)"
            >
              {{ response.status }} {{ response.statusText }}
            </span>
            <span class="text-gray-500 text-sm">{{ response.time }}ms</span>
          </div>
          <pre class="bg-gray-900 text-green-400 p-4 overflow-x-auto text-sm font-mono">{{ formatResponse(response.data) }}</pre>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import api from '@/api'
import Select from '@/components/ui/Select.vue'
import Input from '@/components/ui/Input.vue'
import { useDatabasesStore } from '@/store/databases'

const endpoints = [
  {
    label: 'List Collections',
    method: 'GET',
    url: '/panel/api/collections',
    description: 'Get all collections'
  },
  {
    label: 'Create Collection',
    method: 'POST',
    url: '/panel/api/collections',
    description: 'Create a new collection',
    body: true
  },
  {
    label: 'Get Collection',
    method: 'GET',
    url: '/panel/api/collections/:name',
    description: 'Get a specific collection',
    params: [
      { name: 'name', placeholder: 'Collection name' }
    ]
  },
  {
    label: 'List Records',
    method: 'GET',
    url: '/panel/api/:collection',
    description: 'Get all records from a collection',
    params: [
      { name: 'collection', placeholder: 'Collection name' }
    ]
  },
  {
    label: 'Create Record',
    method: 'POST',
    url: '/panel/api/:collection',
    description: 'Create a new record',
    params: [
      { name: 'collection', placeholder: 'Collection name' }
    ],
    body: true
  },
  {
    label: 'Get Record',
    method: 'GET',
    url: '/panel/api/:collection/:id',
    description: 'Get a specific record',
    params: [
      { name: 'collection', placeholder: 'Collection name' },
      { name: 'id', placeholder: 'Record ID' }
    ]
  },
  {
    label: 'Update Record',
    method: 'PUT',
    url: '/panel/api/:collection/:id',
    description: 'Update a record',
    params: [
      { name: 'collection', placeholder: 'Collection name' },
      { name: 'id', placeholder: 'Record ID' }
    ],
    body: true
  },
  {
    label: 'Delete Record',
    method: 'DELETE',
    url: '/panel/api/:collection/:id',
    description: 'Delete a record',
    params: [
      { name: 'collection', placeholder: 'Collection name' },
      { name: 'id', placeholder: 'Record ID' }
    ]
  },
  {
    label: 'Truncate Collection',
    method: 'POST',
    url: '/panel/api/collections/:name/truncate',
    description: 'Delete all records from a collection',
    params: [
      { name: 'name', placeholder: 'Collection name' }
    ]
  },
  {
    label: 'List Events',
    method: 'GET',
    url: '/panel/api/events',
    description: 'Get unprocessed database events',
    params: [
      { name: 'collection', placeholder: 'Collection name (optional)' },
      { name: 'limit', placeholder: 'Limit (default: 50)' }
    ]
  },
  {
    label: 'Process Events',
    method: 'POST',
    url: '/panel/api/events/process',
    description: 'Mark events as processed',
    body: true
  },
  {
    label: 'Cleanup Events',
    method: 'POST',
    url: '/panel/api/events/cleanup',
    description: 'Clean up old processed events',
    body: true
  },
  {
    label: 'System Info',
    method: 'GET',
    url: '/panel/api/system',
    description: 'Get system information and database status'
  },
  {
    label: 'Change Journal Mode',
    method: 'PUT',
    url: '/panel/api/system/journal-mode',
    description: 'Change SQLite journal mode',
    body: true
  }
]

const databasesStore = useDatabasesStore()

const selectedEndpointValue = ref('')
const selectedEndpoint = ref(null)
const params = ref({})
const requestBody = ref('')
const response = ref(null)
const loading = ref(false)

// Computed property for endpoint options
const endpointOptions = computed(() => 
  endpoints.map(e => ({ label: e.label, value: e.label }))
)

// Watch for endpoint selection changes
watch(selectedEndpointValue, (newValue) => {
  if (newValue) {
    selectedEndpoint.value = endpoints.find(e => e.label === newValue)
    params.value = {}
    response.value = null
    
    // Set default request body examples
    if (selectedEndpoint.value.body) {
      switch (selectedEndpoint.value.label) {
        case 'Create Collection':
          requestBody.value = JSON.stringify({
            name: "example_collection",
            fields: [
              { name: "title", type: "text", required: true },
              { name: "description", type: "text" },
              { name: "status", type: "text" }
            ]
          }, null, 2)
          break
        case 'Create Record':
          requestBody.value = JSON.stringify({
            title: "Example Record",
            description: "This is an example record",
            status: "active"
          }, null, 2)
          break
        case 'Update Record':
          requestBody.value = JSON.stringify({
            title: "Updated Record",
            description: "This record has been updated"
          }, null, 2)
          break
        case 'Process Events':
          requestBody.value = JSON.stringify({
            eventIds: [1, 2, 3]
          }, null, 2)
          break
        case 'Cleanup Events':
          requestBody.value = JSON.stringify({
            olderThanDays: 7
          }, null, 2)
          break
        case 'Change Journal Mode':
          requestBody.value = JSON.stringify({
            mode: "WAL"
          }, null, 2)
          break
        default:
          requestBody.value = '{\n  \n}'
      }
    } else {
      requestBody.value = ''
    }
  } else {
    selectedEndpoint.value = null
  }
})

const sendRequest = async () => {
  if (!selectedEndpoint.value) return

  loading.value = true
  response.value = null

  try {
    const startTime = Date.now()
    let url = selectedEndpoint.value.url

    // Handle URL parameters and query parameters
    const queryParams = {}
    
    if (selectedEndpoint.value.params) {
      selectedEndpoint.value.params.forEach(param => {
        const paramValue = params.value[param.name]
        if (paramValue) {
          // For events endpoint, treat as query parameters
          if (selectedEndpoint.value.label === 'List Events') {
            queryParams[param.name] = paramValue
          } else {
            // For other endpoints, replace in URL
            url = url.replace(`:${param.name}`, paramValue)
          }
        }
      })
    }

    // Prepare request config - handle database-scoped endpoints
    let finalUrl = url.replace('/panel/api', '') || '/'
    
    // If not master database, prepend database context to URL
    if (databasesStore.currentDatabase !== 'main') {
      // Only add database context for non-system endpoints
      if (!finalUrl.startsWith('/system') && !finalUrl.startsWith('/databases') && !finalUrl.startsWith('/events')) {
        finalUrl = `/databases/${databasesStore.currentDatabase}${finalUrl}`
      }
    }
    
    const config = {
      method: selectedEndpoint.value.method.toLowerCase(),
      url: finalUrl
    }
    
    // Add query parameters if any
    if (Object.keys(queryParams).length > 0) {
      config.params = queryParams
    }

    // Add request body if needed
    if (selectedEndpoint.value.body && requestBody.value) {
      try {
        config.data = JSON.parse(requestBody.value)
      } catch (e) {
        config.data = requestBody.value
      }
    }

    const res = await api.request(config)
    const endTime = Date.now()

    response.value = {
      status: res.status,
      statusText: res.statusText,
      data: res.data,
      time: endTime - startTime
    }
  } catch (error) {
    const endTime = Date.now()
    response.value = {
      status: error.response?.status || 0,
      statusText: error.response?.statusText || 'Network Error',
      data: error.response?.data || { error: error.message },
      time: endTime - startTime
    }
  } finally {
    loading.value = false
  }
}

const formatResponse = (data) => {
  return JSON.stringify(data, null, 2)
}

const getMethodClass = (method) => {
  const classes = {
    GET: 'bg-blue-100 text-blue-800',
    POST: 'bg-green-100 text-green-800',
    PUT: 'bg-yellow-100 text-yellow-800',
    DELETE: 'bg-red-100 text-red-800'
  }
  return classes[method] || 'bg-gray-100 text-gray-800'
}

const getStatusClass = (status) => {
  if (status >= 200 && status < 300) return 'bg-green-100 text-green-800'
  if (status >= 400 && status < 500) return 'bg-yellow-100 text-yellow-800'
  return 'bg-red-100 text-red-800'
}
</script>

