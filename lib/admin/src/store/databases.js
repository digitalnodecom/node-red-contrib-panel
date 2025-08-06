import { defineStore } from 'pinia'
import api from '@/api'

export const useDatabasesStore = defineStore('databases', {
  state: () => ({
    databases: [],
    currentDatabase: 'master',
    loading: false,
    error: null
  }),

  getters: {
    getDatabaseById: (state) => (id) => {
      return state.databases.find(db => db.name === id)
    },
    
    getCurrentDatabaseInfo: (state) => {
      return state.databases.find(db => db.name === state.currentDatabase)
    },

    getMasterDatabase: (state) => {
      return state.databases.find(db => db.is_master === 1)
    },

    getDefaultDatabase: (state) => {
      return state.databases.find(db => db.is_default === 1)
    }
  },

  actions: {
    async fetchDatabases() {
      this.loading = true
      this.error = null
      try {
        const { data } = await api.get('/databases')
        this.databases = data
        
        // Set current database to default if not already set
        if (this.currentDatabase === 'master' && data.length > 0) {
          const defaultDb = data.find(db => db.is_default === 1)
          if (defaultDb) {
            this.currentDatabase = defaultDb.name
          }
        }
      } catch (error) {
        this.error = error.response?.data?.error || error.message
      } finally {
        this.loading = false
      }
    },

    async fetchDatabase(dbId) {
      this.loading = true
      this.error = null
      try {
        const { data } = await api.get(`/databases/${dbId}`)
        return data
      } catch (error) {
        this.error = error.response?.data?.error || error.message
        throw error
      } finally {
        this.loading = false
      }
    },

    async createDatabase(database) {
      this.loading = true
      this.error = null
      try {
        const { data } = await api.post('/databases', database)
        this.databases.push(data.database)
        return data.database
      } catch (error) {
        this.error = error.response?.data?.error || error.message
        throw error
      } finally {
        this.loading = false
      }
    },

    async updateDatabase(dbId, updates) {
      this.loading = true
      this.error = null
      try {
        const { data } = await api.put(`/databases/${dbId}`, updates)
        const index = this.databases.findIndex(db => db.name === dbId)
        if (index !== -1) {
          this.databases[index] = { ...this.databases[index], ...data }
        }
        return data
      } catch (error) {
        this.error = error.response?.data?.error || error.message
        throw error
      } finally {
        this.loading = false
      }
    },

    async deleteDatabase(dbId) {
      this.loading = true
      this.error = null
      try {
        await api.delete(`/databases/${dbId}`)
        this.databases = this.databases.filter(db => db.name !== dbId)
        
        // Switch to master if current database was deleted
        if (this.currentDatabase === dbId) {
          this.currentDatabase = 'master'
        }
      } catch (error) {
        this.error = error.response?.data?.error || error.message
        throw error
      } finally {
        this.loading = false
      }
    },

    async setDefaultDatabase(dbId) {
      this.loading = true
      this.error = null
      try {
        const { data } = await api.post(`/databases/${dbId}/set-default`)
        
        // Update local state
        this.databases.forEach(db => {
          db.is_default = db.name === dbId ? 1 : 0
        })
        
        return data
      } catch (error) {
        this.error = error.response?.data?.error || error.message
        throw error
      } finally {
        this.loading = false
      }
    },

    async getDatabaseStats() {
      this.loading = true
      this.error = null
      try {
        const { data } = await api.get('/databases/stats')
        return data
      } catch (error) {
        this.error = error.response?.data?.error || error.message
        throw error
      } finally {
        this.loading = false
      }
    },

    setCurrentDatabase(dbId) {
      this.currentDatabase = dbId
      // Store in localStorage for persistence
      localStorage.setItem('currentDatabase', dbId)
    },

    initializeCurrentDatabase() {
      // Load from localStorage or use default
      const stored = localStorage.getItem('currentDatabase')
      if (stored && this.databases.find(db => db.name === stored)) {
        this.currentDatabase = stored
      } else {
        // Use default database or master
        const defaultDb = this.databases.find(db => db.is_default === 1)
        this.currentDatabase = defaultDb ? defaultDb.name : 'master'
      }
    }
  }
})