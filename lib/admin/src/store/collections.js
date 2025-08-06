import { defineStore } from 'pinia'
import api from '@/api'
import { useDatabasesStore } from './databases'

export const useCollectionsStore = defineStore('collections', {
  state: () => ({
    collections: [],
    currentCollection: null,
    loading: false,
    error: null
  }),

  getters: {
    getCollectionByName: (state) => (name) => {
      return state.collections.find(c => c.name === name)
    }
  },

  actions: {
    async fetchCollections(dbId = null) {
      this.loading = true
      this.error = null
      try {
        // Use database context if provided, otherwise use current database
        if (!dbId) {
          const databasesStore = useDatabasesStore()
          dbId = databasesStore.currentDatabase
        }
        
        // Always use database-scoped endpoint for consistency
        const endpoint = `/databases/${dbId}/collections`
        
        const { data } = await api.get(endpoint)
        this.collections = data
      } catch (error) {
        this.error = error.response?.data?.error || error.message
      } finally {
        this.loading = false
      }
    },

    async fetchCollection(name, dbId = null) {
      this.loading = true
      this.error = null
      try {
        // Use database context if provided, otherwise use current database
        if (!dbId) {
          const databasesStore = useDatabasesStore()
          dbId = databasesStore.currentDatabase
        }
        
        // Always use database-scoped endpoint for consistency
        const endpoint = `/databases/${dbId}/collections/${name}`
        
        const { data } = await api.get(endpoint)
        this.currentCollection = data
        return data
      } catch (error) {
        this.error = error.response?.data?.error || error.message
        throw error
      } finally {
        this.loading = false
      }
    },

    async createCollection(collection, dbId = null) {
      this.loading = true
      this.error = null
      try {
        // Use database context if provided, otherwise use current database
        if (!dbId) {
          const databasesStore = useDatabasesStore()
          dbId = databasesStore.currentDatabase
        }
        
        // Always use database-scoped endpoint for consistency
        const endpoint = `/databases/${dbId}/collections`
        
        const { data } = await api.post(endpoint, collection)
        this.collections.push(data)
        return data
      } catch (error) {
        this.error = error.response?.data?.error || error.message
        throw error
      } finally {
        this.loading = false
      }
    },

    async updateCollection(id, updates, dbId = null) {
      this.loading = true
      this.error = null
      try {
        // Find the collection by id to get its name for the API call
        const collection = this.collections.find(c => c.id === id)
        if (!collection) {
          throw new Error('Collection not found in store')
        }
        
        // Use database context if provided, otherwise use current database
        if (!dbId) {
          const databasesStore = useDatabasesStore()
          dbId = databasesStore.currentDatabase
        }
        
        // Always use database-scoped endpoint for consistency
        const endpoint = `/databases/${dbId}/collections/${collection.name}`
        
        const { data } = await api.put(endpoint, updates)
        const index = this.collections.findIndex(c => c.id === id)
        if (index !== -1) {
          // Update with the response data which includes updated field_count, etc.
          this.collections[index] = { ...this.collections[index], ...data }
        }
        return data
      } catch (error) {
        this.error = error.response?.data?.error || error.message
        throw error
      } finally {
        this.loading = false
      }
    },

    async deleteCollection(name, dbId = null) {
      this.loading = true
      this.error = null
      try {
        // Use database context if provided, otherwise use current database
        if (!dbId) {
          const databasesStore = useDatabasesStore()
          dbId = databasesStore.currentDatabase
        }
        
        // Always use database-scoped endpoint for consistency
        const endpoint = `/databases/${dbId}/collections/${name}`
        
        await api.delete(endpoint)
        this.collections = this.collections.filter(c => c.name !== name)
      } catch (error) {
        this.error = error.response?.data?.error || error.message
        throw error
      } finally {
        this.loading = false
      }
    },

    async truncateCollection(name, dbId = null) {
      this.loading = true
      this.error = null
      try {
        // Use database context if provided, otherwise use current database
        if (!dbId) {
          const databasesStore = useDatabasesStore()
          dbId = databasesStore.currentDatabase
        }
        
        // Always use database-scoped endpoint for consistency
        const endpoint = `/databases/${dbId}/collections/${name}/truncate`
        
        const response = await api.post(endpoint)
        // Update the record count for the collection
        const collection = this.collections.find(c => c.name === name)
        if (collection) {
          collection.record_count = 0
        }
        return response.data
      } catch (error) {
        this.error = error.response?.data?.error || error.message
        throw error
      } finally {
        this.loading = false
      }
    }
  }
})