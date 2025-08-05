import { createRouter, createWebHistory } from 'vue-router'
import Dashboard from '@/views/Dashboard.vue'
import Collections from '@/views/Collections.vue'
import DataBrowser from '@/views/DataBrowser.vue'
import ApiExplorer from '@/views/ApiExplorer.vue'

const routes = [
  {
    path: '/panel',
    name: 'Dashboard',
    component: Dashboard
  },
  {
    path: '/panel/collections',
    name: 'Collections',
    component: Collections
  },
  {
    path: '/panel/collections/:name',
    name: 'DataBrowser',
    component: DataBrowser,
    props: true
  },
  {
    path: '/panel/api-explorer',
    name: 'ApiExplorer',
    component: ApiExplorer
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router