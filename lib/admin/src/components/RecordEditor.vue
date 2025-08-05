<template>
  <div class="flex flex-col gap-4">
    <div
      v-for="field in fields"
      :key="field.name"
      class="flex flex-col gap-2"
    >
      <label :for="`field-${field.name}`" class="font-medium text-gray-700">
        {{ field.name }}
        <span v-if="field.required" class="text-red-500 ml-1">*</span>
      </label>
      
      <!-- Text/Email/URL inputs -->
      <input
        v-if="['text', 'email', 'url'].includes(field.type)"
        v-model="form[field.name]"
        :id="`field-${field.name}`"
        :type="getInputType(field.type)"
        :placeholder="`Enter ${field.name}`"
        class="w-full px-3 py-2 border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
      />
      
      <!-- Number inputs -->
      <input
        v-else-if="['number', 'integer'].includes(field.type)"
        v-model.number="form[field.name]"
        :id="`field-${field.name}`"
        type="number"
        :step="field.type === 'integer' ? '1' : 'any'"
        :placeholder="`Enter ${field.name}`"
        class="w-full px-3 py-2 border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
      />
      
      <!-- Boolean checkbox -->
      <label v-else-if="field.type === 'boolean'" class="flex items-center gap-2 cursor-pointer">
        <input
          v-model="form[field.name]"
          :id="`field-${field.name}`"
          type="checkbox"
          class="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 focus:ring-blue-500 focus:ring-2"
        />
        <span class="text-sm text-gray-700">{{ field.name }}</span>
      </label>
      
      <!-- Date input -->
      <input
        v-else-if="field.type === 'date'"
        v-model="form[field.name]"
        :id="`field-${field.name}`"
        type="datetime-local"
        class="w-full px-3 py-2 border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
      />
      
      <!-- JSON textarea -->
      <textarea
        v-else-if="field.type === 'json'"
        v-model="form[field.name]"
        :id="`field-${field.name}`"
        :placeholder="`Enter ${field.name} (JSON format)`"
        rows="5"
        class="w-full px-3 py-2 border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors font-mono text-sm"
      ></textarea>
      
      <!-- Default text input -->
      <input
        v-else
        v-model="form[field.name]"
        :id="`field-${field.name}`"
        type="text"
        :placeholder="`Enter ${field.name}`"
        class="w-full px-3 py-2 border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
      />
    </div>

    <div class="flex justify-end gap-3 mt-6">
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
import { ref, computed } from 'vue'

const props = defineProps({
  fields: Array,
  record: Object
})

const emit = defineEmits(['save', 'cancel'])

const form = ref(
  props.record 
    ? { ...props.record }
    : props.fields.reduce((acc, field) => {
        acc[field.name] = field.default || null
        return acc
      }, {})
)

const isValid = computed(() => {
  return props.fields.every(field => {
    if (field.required) {
      const value = form.value[field.name]
      return value !== null && value !== undefined && value !== ''
    }
    return true
  })
})

const getInputType = (fieldType) => {
  const typeMap = {
    'text': 'text',
    'email': 'email',
    'url': 'url'
  }
  return typeMap[fieldType] || 'text'
}

const save = () => {
  if (!isValid.value) return
  
  // Process JSON fields
  const processedData = { ...form.value }
  props.fields.forEach(field => {
    if (field.type === 'json' && typeof processedData[field.name] === 'string') {
      try {
        processedData[field.name] = JSON.parse(processedData[field.name])
      } catch (e) {
        // Keep as string if invalid JSON
      }
    }
  })
  
  // Remove id field for new records
  if (!props.record) {
    delete processedData.id
  }
  
  emit('save', processedData)
}
</script>

<style scoped>
button:disabled {
  cursor: not-allowed;
}
</style>