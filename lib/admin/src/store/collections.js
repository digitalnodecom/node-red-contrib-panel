import { defineStore } from 'pinia'
import api from '@/api'

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
    async fetchCollections() {
      this.loading = true
      this.error = null
      try {
        const { data } = await api.get('/collections')
        this.collections = data
      } catch (error) {
        this.error = error.response?.data?.error || error.message
      } finally {
        this.loading = false
      }
    },

    async fetchCollection(name) {
      this.loading = true
      this.error = null
      try {
        const { data } = await api.get(`/collections/${name}`)
        this.currentCollection = data
        return data
      } catch (error) {
        this.error = error.response?.data?.error || error.message
        throw error
      } finally {
        this.loading = false
      }
    },

    async createCollection(collection) {
      this.loading = true
      this.error = null
      try {
        const { data } = await api.post('/collections', collection)
        this.collections.push(data)
        return data
      } catch (error) {
        this.error = error.response?.data?.error || error.message
        throw error
      } finally {
        this.loading = false
      }
    },

    async updateCollection(id, updates) {
      this.loading = true
      this.error = null
      try {
        // Find the collection by id to get its name for the API call
        const collection = this.collections.find(c => c.id === id)
        if (!collection) {
          throw new Error('Collection not found in store')
        }
        
        const { data } = await api.put(`/collections/${collection.name}`, updates)
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

    async deleteCollection(name) {
      this.loading = true
      this.error = null
      try {
        await api.delete(`/collections/${name}`)
        this.collections = this.collections.filter(c => c.name !== name)
      } catch (error) {
        this.error = error.response?.data?.error || error.message
        throw error
      } finally {
        this.loading = false
      }
    },

    async truncateCollection(name) {
      this.loading = true
      this.error = null
      try {
        const response = await api.post(`/collections/${name}/truncate`)
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