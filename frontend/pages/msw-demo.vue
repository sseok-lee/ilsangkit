<!-- @TASK T0.5.3 - MSW 데모 페이지 -->
<!-- @SPEC docs/planning/02-trd.md#계약-정의 -->
<template>
  <div class="min-h-screen bg-gray-50 py-8 px-4">
    <div class="max-w-4xl mx-auto">
      <h1 class="text-3xl font-bold text-gray-900 mb-6">
        MSW Demo - Mock API Testing
      </h1>

      <!-- Health Check -->
      <section class="bg-white rounded-lg shadow p-6 mb-6">
        <h2 class="text-xl font-semibold mb-4">Health Check</h2>
        <button
          @click="checkHealth"
          class="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:opacity-50"
          :disabled="loading"
        >
          Check Health
        </button>
        <pre v-if="healthData" class="mt-4 bg-gray-100 p-4 rounded overflow-x-auto">{{
          JSON.stringify(healthData, null, 2)
        }}</pre>
      </section>

      <!-- Categories -->
      <section class="bg-white rounded-lg shadow p-6 mb-6">
        <h2 class="text-xl font-semibold mb-4">Categories</h2>
        <button
          @click="fetchCategories"
          class="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 disabled:opacity-50"
          :disabled="loading"
        >
          Fetch Categories
        </button>
        <div v-if="categories.length > 0" class="mt-4 grid grid-cols-2 md:grid-cols-3 gap-4">
          <div
            v-for="category in categories"
            :key="category.id"
            class="border border-gray-200 rounded p-4 hover:bg-gray-50"
          >
            <div class="text-3xl mb-2">{{ category.icon }}</div>
            <div class="font-semibold">{{ category.name }}</div>
            <div class="text-sm text-gray-600">{{ category.description }}</div>
          </div>
        </div>
      </section>

      <!-- Facility Search -->
      <section class="bg-white rounded-lg shadow p-6 mb-6">
        <h2 class="text-xl font-semibold mb-4">Facility Search</h2>
        <div class="flex gap-2 mb-4">
          <select v-model="selectedCategory" class="border border-gray-300 rounded px-3 py-2">
            <option value="">All Categories</option>
            <option v-for="cat in categories" :key="cat.id" :value="cat.id">
              {{ cat.icon }} {{ cat.name }}
            </option>
          </select>
          <button
            @click="searchFacilities"
            class="bg-purple-500 text-white px-4 py-2 rounded hover:bg-purple-600 disabled:opacity-50"
            :disabled="loading"
          >
            Search
          </button>
        </div>
        <div v-if="facilities.length > 0" class="space-y-4">
          <div
            v-for="facility in facilities"
            :key="facility.id"
            class="border border-gray-200 rounded p-4 hover:bg-gray-50 cursor-pointer"
            @click="fetchFacilityDetail(facility.category, facility.id)"
          >
            <h3 class="font-semibold text-lg">{{ facility.name }}</h3>
            <p class="text-gray-600 text-sm">{{ facility.address }}</p>
            <div class="flex items-center gap-4 mt-2 text-sm text-gray-500">
              <span>{{ facility.city }} {{ facility.district }}</span>
              <span>{{ facility.distance }}m</span>
            </div>
          </div>
          <div v-if="searchMeta" class="text-sm text-gray-600">
            Total: {{ searchMeta.total }} | Page: {{ searchMeta.page }} / {{ searchMeta.totalPages }}
          </div>
        </div>
      </section>

      <!-- Facility Detail -->
      <section v-if="facilityDetail" class="bg-white rounded-lg shadow p-6 mb-6">
        <h2 class="text-xl font-semibold mb-4">Facility Detail</h2>
        <div class="space-y-2">
          <h3 class="text-lg font-semibold">{{ facilityDetail.name }}</h3>
          <p class="text-gray-600">{{ facilityDetail.address }}</p>
          <div class="grid grid-cols-2 gap-4 mt-4">
            <div>
              <span class="text-sm text-gray-500">Category:</span>
              <span class="ml-2 font-medium">{{ facilityDetail.category }}</span>
            </div>
            <div>
              <span class="text-sm text-gray-500">Distance:</span>
              <span class="ml-2 font-medium">{{ facilityDetail.distance }}m</span>
            </div>
            <div>
              <span class="text-sm text-gray-500">View Count:</span>
              <span class="ml-2 font-medium">{{ facilityDetail.viewCount }}</span>
            </div>
          </div>
          <div v-if="facilityDetail.details" class="mt-4">
            <h4 class="font-semibold mb-2">Details:</h4>
            <pre class="bg-gray-100 p-4 rounded overflow-x-auto text-sm">{{
              JSON.stringify(facilityDetail.details, null, 2)
            }}</pre>
          </div>
        </div>
      </section>

      <!-- Error Display -->
      <section v-if="error" class="bg-red-50 border border-red-200 rounded-lg p-4">
        <h3 class="text-red-800 font-semibold">Error</h3>
        <p class="text-red-700">{{ error }}</p>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
const config = useRuntimeConfig()
const apiBase = config.public.apiBase

const loading = ref(false)
const error = ref('')

// Health
const healthData = ref<any>(null)

// Categories
const categories = ref<any[]>([])

// Facility Search
const selectedCategory = ref('')
const facilities = ref<any[]>([])
const searchMeta = ref<any>(null)

// Facility Detail
const facilityDetail = ref<any>(null)

async function checkHealth() {
  loading.value = true
  error.value = ''
  try {
    const response = await fetch(`${apiBase}/api/health`)
    healthData.value = await response.json()
  } catch (e: any) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

async function fetchCategories() {
  loading.value = true
  error.value = ''
  try {
    const response = await fetch(`${apiBase}/api/meta/categories`)
    const result = await response.json()
    if (result.success) {
      categories.value = result.data
    }
  } catch (e: any) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

async function searchFacilities() {
  loading.value = true
  error.value = ''
  try {
    const response = await fetch(`${apiBase}/api/facilities/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category: selectedCategory.value || undefined,
        page: 1,
        limit: 10,
      }),
    })
    const result = await response.json()
    if (result.success) {
      facilities.value = result.data.items
      searchMeta.value = {
        total: result.data.total,
        page: result.data.page,
        totalPages: result.data.totalPages,
      }
    }
  } catch (e: any) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

async function fetchFacilityDetail(category: string, id: string) {
  loading.value = true
  error.value = ''
  try {
    const response = await fetch(`${apiBase}/api/facilities/${category}/${id}`)
    const result = await response.json()
    if (result.success) {
      facilityDetail.value = result.data
    } else {
      error.value = result.error.message
    }
  } catch (e: any) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

// Auto-fetch categories on mount
onMounted(() => {
  fetchCategories()
})
</script>
