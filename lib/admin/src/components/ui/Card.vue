<template>
  <div :class="cardClasses">
    <div v-if="title || $slots.header" :class="headerClasses">
      <slot name="header">
        <h3 class="text-lg font-medium text-gray-900">{{ title }}</h3>
      </slot>
    </div>
    
    <div :class="bodyClasses">
      <slot />
    </div>
    
    <div v-if="$slots.footer" :class="footerClasses">
      <slot name="footer" />
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  title: String,
  shadow: {
    type: String,
    default: 'md',
    validator: (value) => ['none', 'sm', 'md', 'lg', 'xl'].includes(value)
  },
  padding: {
    type: String,
    default: 'md',
    validator: (value) => ['none', 'sm', 'md', 'lg'].includes(value)
  }
})

const cardClasses = computed(() => {
  const baseClasses = 'bg-white border border-gray-200'
  
  const shadowClasses = {
    none: '',
    sm: 'shadow-sm',
    md: 'shadow',
    lg: 'shadow-lg',
    xl: 'shadow-xl'
  }
  
  return [
    baseClasses,
    shadowClasses[props.shadow]
  ].filter(Boolean).join(' ')
})

const headerClasses = computed(() => {
  const paddingClasses = {
    none: '',
    sm: 'px-4 py-3',
    md: 'px-6 py-4',
    lg: 'px-8 py-6'
  }
  
  return [
    'border-b border-gray-200',
    paddingClasses[props.padding]
  ].filter(Boolean).join(' ')
})

const bodyClasses = computed(() => {
  const paddingClasses = {
    none: '',
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8'
  }
  
  return paddingClasses[props.padding]
})

const footerClasses = computed(() => {
  const paddingClasses = {
    none: '',
    sm: 'px-4 py-3',
    md: 'px-6 py-4',
    lg: 'px-8 py-6'
  }
  
  return [
    'border-t border-gray-200',
    paddingClasses[props.padding]
  ].filter(Boolean).join(' ')
})
</script>