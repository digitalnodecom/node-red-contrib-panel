<template>
  <div class="flex flex-col gap-6">
    <div class="flex flex-col gap-2">
      <label for="collection-name" class="font-medium text-gray-700">Collection Name</label>
      <input
        id="collection-name"
        v-model="form.name"
        type="text"
        placeholder="e.g., users, products"
        :disabled="!!collection"
        class="w-full px-3 py-2 border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors disabled:bg-gray-100 disabled:text-gray-500"
      />
    </div>

    <div class="flex flex-col gap-2">
      <label class="flex items-center gap-3 cursor-pointer">
        <input
          v-model="form.events_enabled"
          type="checkbox"
          class="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 focus:ring-blue-500 focus:ring-2"
        />
        <div>
          <span class="font-medium text-gray-700">Enable Events</span>
          <p class="text-sm text-gray-500">Create database triggers to capture INSERT, UPDATE, and DELETE events for this collection</p>
        </div>
      </label>
    </div>

    <div class="border border-gray-200 p-4">
      <div class="flex justify-between items-center mb-4">
        <h3 class="text-lg font-medium text-gray-700">Fields</h3>
        <button
          @click="addField"
          class="px-3 py-1.5 bg-blue-600 text-white text-sm hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <i class="ph ph-plus"></i>
          Add Field
        </button>
      </div>

      <div class="flex flex-col gap-3">
        <div
          v-for="(field, index) in form.fields"
          :key="index"
          class="grid grid-cols-1 md:grid-cols-6 gap-3 items-center p-3 bg-gray-50"
        >
          <input
            v-model="field.name"
            type="text"
            placeholder="Field name"
            class="px-3 py-2 border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
          />
          
          <select
            v-model="field.type"
            class="px-3 py-2 border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
          >
            <option value="" disabled>Select type</option>
            <option v-for="type in fieldTypes" :key="type" :value="type">
              {{ type }}
            </option>
          </select>
          
          <label class="flex items-center gap-2 cursor-pointer">
            <input
              v-model="field.required"
              type="checkbox"
              :id="`required-${index}`"
              class="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 focus:ring-blue-500 focus:ring-2"
            />
            <span class="text-sm text-gray-700">Required</span>
          </label>
          
          <label class="flex items-center gap-2 cursor-pointer">
            <input
              v-model="field.unique"
              type="checkbox"
              :id="`unique-${index}`"
              class="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 focus:ring-blue-500 focus:ring-2"
            />
            <span class="text-sm text-gray-700">Unique</span>
          </label>
          
          <label class="flex items-center gap-2 cursor-pointer">
            <input
              v-model="field.indexable"
              type="checkbox"
              :id="`indexable-${index}`"
              class="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 focus:ring-blue-500 focus:ring-2"
            />
            <span class="text-sm text-gray-700">Indexable</span>
          </label>
          
          <button
            @click="removeField(index)"
            class="text-red-600 hover:text-red-900 p-2 hover:bg-red-50 transition-colors"
          >
            <i class="ph ph-trash"></i>
          </button>
        </div>
      </div>
    </div>

    <div class="flex justify-end gap-3 mt-4">
      <button
        @click="$emit('cancel')"
        class="px-4 py-2 text-gray-600 bg-gray-200 hover:bg-gray-300 transition-colors"
      >
        Cancel
      </button>
      <button
        @click="save"
        :disabled="!isValid"
        class="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        Save
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'

const props = defineProps({
  collection: Object
})

const emit = defineEmits(['save', 'cancel'])

const fieldTypes = [
  'text',
  'number',
  'integer',
  'boolean',
  'date',
  'json',
  'email',
  'url'
]

const form = ref({
  name: props.collection?.name || '',
  events_enabled: Boolean(props.collection?.events_enabled) || false,
  fields: props.collection?.fields ? JSON.parse(JSON.stringify(props.collection.fields)) : [
    { name: '', type: 'text', required: false, unique: false, indexable: false }
  ]
})

// Watch for collection changes and update form
watch(() => props.collection, (newCollection) => {
  if (newCollection) {
    form.value.name = newCollection.name || ''
    form.value.events_enabled = Boolean(newCollection.events_enabled)
    
    // Process fields and ensure boolean values for required/unique/indexable
    if (newCollection.fields) {
      form.value.fields = newCollection.fields.map(field => ({
        name: field.name || '',
        type: field.type || 'text',
        required: Boolean(field.required), // Convert 0/1 to boolean
        unique: Boolean(field.unique),      // Convert 0/1 to boolean
        indexable: Boolean(field.indexable) // Convert 0/1 to boolean
      }))
    } else {
      form.value.fields = [{ name: '', type: 'text', required: false, unique: false, indexable: false }]
    }
  } else {
    form.value.name = ''
    form.value.events_enabled = false
    form.value.fields = [{ name: '', type: 'text', required: false, unique: false, indexable: false }]
  }
}, { deep: true, immediate: true })

const isValid = computed(() => {
  if (!form.value.name) return false
  if (form.value.fields.length === 0) return false
  
  return form.value.fields.every(field => 
    field.name && field.type
  )
})

const addField = () => {
  form.value.fields.push({
    name: '',
    type: 'text',
    required: false,
    unique: false,
    indexable: false
  })
}

const removeField = (index) => {
  form.value.fields.splice(index, 1)
}

const save = () => {
  if (!isValid.value) return
  
  // Process fields to ensure proper boolean values
  const processedFields = form.value.fields
    .filter(f => f.name && f.type)
    .map(field => ({
      name: field.name,
      type: field.type,
      required: Boolean(field.required), // Ensure boolean
      unique: Boolean(field.unique),     // Ensure boolean
      indexable: Boolean(field.indexable) // Ensure boolean
    }))
  
  emit('save', {
    name: form.value.name,
    events_enabled: Boolean(form.value.events_enabled),
    fields: processedFields
  })
}
</script>

<style scoped>
button:disabled {
  cursor: not-allowed;
}

input:disabled {
  cursor: not-allowed;
}
</style>