<template>
  <div class="bg-background-light dark:bg-background-dark text-slate-900 dark:text-white font-display h-screen flex flex-col overflow-hidden">
    <!-- Mobile Header with Back Button + Search + Filter Icon -->
    <header class="md:hidden sticky top-0 z-30 bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-md transition-colors duration-200">
      <!-- Top Search Bar Area -->
      <div class="px-4 py-3 flex items-center gap-3">
        <!-- Back Button -->
        <button
          class="shrink-0 flex items-center justify-center w-10 h-10 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
          @click="$router.back()"
        >
          <span class="material-symbols-outlined text-slate-700 dark:text-slate-200 text-[24px]">arrow_back</span>
        </button>
        <!-- Search Input -->
        <div class="flex-1 relative group">
          <div class="absolute inset-y-0 left-3 flex items-center pointer-events-none">
            <span class="material-symbols-outlined text-slate-400 text-[20px]">search</span>
          </div>
          <input
            v-model="searchKeyword"
            class="w-full bg-white dark:bg-slate-800 border-none rounded-2xl py-3 pl-10 pr-10 text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-primary/20 shadow-sm text-base font-medium"
            type="text"
            placeholder="장소를 검색하세요..."
            @keyup.enter="handleSearch"
          />
          <button
            v-if="searchKeyword"
            class="absolute inset-y-0 right-3 flex items-center cursor-pointer"
            @click="clearSearch"
          >
            <span class="material-symbols-outlined text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 text-[20px]">cancel</span>
          </button>
        </div>
        <!-- Filter Icon Button -->
        <div class="relative">
          <button
            class="shrink-0 flex items-center justify-center w-10 h-10 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
            @click="showFilterDropdown = !showFilterDropdown"
          >
            <span class="material-symbols-outlined text-slate-700 dark:text-slate-200 text-[24px]">tune</span>
          </button>
          <!-- Backdrop -->
          <div v-if="showFilterDropdown" class="fixed inset-0 z-40" @click="showFilterDropdown = false" />
          <!-- Sort Dropdown -->
          <div
            v-if="showFilterDropdown"
            class="absolute right-0 top-12 w-48 bg-white dark:bg-slate-800 rounded-xl shadow-lg z-50 py-1 border border-slate-100 dark:border-slate-700"
          >
            <button
              class="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              :class="selectedSort === 'distance' ? 'text-primary' : 'text-slate-700 dark:text-slate-200'"
              @click="selectSort('distance')"
            >
              <span class="material-symbols-outlined text-[20px]">near_me</span>
              거리순
              <span v-if="selectedSort === 'distance'" class="material-symbols-outlined text-[20px] ml-auto">check</span>
            </button>
            <button
              class="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              :class="selectedSort === 'name' ? 'text-primary' : 'text-slate-700 dark:text-slate-200'"
              @click="selectSort('name')"
            >
              <span class="material-symbols-outlined text-[20px]">sort_by_alpha</span>
              이름순
              <span v-if="selectedSort === 'name'" class="material-symbols-outlined text-[20px] ml-auto">check</span>
            </button>
          </div>
        </div>
      </div>
      <!-- Scrollable Filter Chips -->
      <div class="px-4 pb-2 w-full overflow-x-auto no-scrollbar flex items-center gap-2">
        <!-- Category Chips with Icons -->
        <button
          v-for="cat in categoryTabs"
          :key="cat.id"
          :class="[
            'shrink-0 px-3 py-2 rounded-2xl text-sm font-semibold transition-transform active:scale-95 flex items-center gap-1.5',
            selectedCategory === cat.id
              ? 'bg-primary text-white shadow-md shadow-primary/20'
              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
          ]"
          @click="handleCategoryChange(cat.id)"
        >
          <CategoryIcon v-if="cat.id !== 'all'" :category-id="cat.id" size="sm" />
          <span v-else class="material-symbols-outlined text-[18px]">apps</span>
          {{ cat.label }}
        </button>
      </div>
    </header>

    <!-- Desktop Header -->
    <header class="hidden md:flex items-center justify-between whitespace-nowrap border-b border-solid border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 py-3 z-20 shrink-0 shadow-sm">
      <div class="flex items-center gap-8">
        <!-- Persistent Search (Desktop) -->
        <label class="flex flex-col min-w-64 h-10 lg:w-96">
          <div
            class="flex w-full flex-1 items-stretch rounded-xl h-full bg-slate-100 dark:bg-slate-800 transition-colors focus-within:ring-2 focus-within:ring-primary/20"
          >
            <div class="text-slate-400 flex border-none items-center justify-center pl-3">
              <span class="material-symbols-outlined text-[20px]">search</span>
            </div>
            <input
              v-model="searchKeyword"
              class="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-xl text-slate-900 dark:text-white focus:outline-0 focus:ring-0 border-none bg-transparent h-full placeholder:text-slate-400 px-3 text-sm font-normal leading-normal"
              placeholder="장소를 검색하세요..."
              @keyup.enter="handleSearch"
            />
            <button
              v-if="searchKeyword"
              class="px-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              @click="clearSearch"
            >
              <span class="material-symbols-outlined text-[20px]">cancel</span>
            </button>
          </div>
        </label>
      </div>

      <!-- Right Side Nav -->
      <div class="flex items-center gap-6">
        <!-- Category Tabs (Desktop) - pill style -->
        <nav class="hidden lg:flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
          <button
            v-for="cat in categoryTabs"
            :key="cat.id"
            :class="[
              'px-4 py-1.5 rounded-md text-sm font-medium leading-normal transition-all',
              selectedCategory === cat.id
                ? 'bg-white dark:bg-slate-700 shadow-sm text-primary font-semibold'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200',
            ]"
            @click="handleCategoryChange(cat.id)"
          >
            {{ cat.label }}
          </button>
        </nav>

        <!-- Divider -->
        <div class="h-8 w-[1px] bg-slate-200 dark:bg-slate-700 hidden lg:block"></div>

        <!-- Bookmark button -->
        <button class="text-slate-500 hover:text-primary transition-colors">
          <span class="material-symbols-outlined">bookmark</span>
        </button>
      </div>
    </header>

    <!-- Main Content: Split View -->
    <div class="flex flex-1 overflow-hidden relative">
      <!-- Left Sidebar: Results List (쓰레기 카테고리일 때는 전체 너비) -->
      <aside
        :class="[
          'flex flex-col bg-background-light dark:bg-background-dark md:bg-white md:dark:bg-slate-900 shrink-0 z-10',
          selectedCategory === 'trash'
            ? 'w-full'
            : 'w-full md:w-[400px] md:border-r md:border-slate-200 md:dark:border-slate-800 md:shadow-lg'
        ]"
      >
        <!-- Stats & Sorting Bar (Mobile) - 쓰레기 카테고리가 아닐 때만 -->
        <div v-if="selectedCategory !== 'trash'" class="md:hidden px-5 py-3 flex items-center justify-between bg-white dark:bg-slate-900">
          <p class="text-slate-500 dark:text-slate-400 text-sm font-medium">검색 결과 {{ total }}건</p>
          <div class="flex items-center gap-2">
            <CurrentLocationButton
              compact
              @location-found="handleLocationFound"
              @error="handleLocationError"
            />
            <button
              class="flex items-center gap-1 text-slate-700 dark:text-slate-200 text-sm font-semibold hover:text-primary transition-colors"
              @click="toggleSortDropdown"
            >
              {{ selectedSort === 'distance' ? '거리순' : '이름순' }}
              <span class="material-symbols-outlined text-[20px]">expand_more</span>
            </button>
          </div>
        </div>

        <!-- 쓰레기 카테고리 헤더 (Mobile) -->
        <div v-if="selectedCategory === 'trash'" class="md:hidden px-5 py-3 bg-white dark:bg-slate-900">
          <p class="text-slate-900 dark:text-white text-base font-bold">쓰레기 배출 일정</p>
          <p class="text-slate-500 dark:text-slate-400 text-xs mt-0.5">지역을 선택하여 배출 일정을 확인하세요</p>
        </div>

        <!-- Filter Header (Desktop) - 쓰레기 카테고리가 아닐 때만 -->
        <div v-if="selectedCategory !== 'trash'" class="hidden md:block px-5 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0 bg-white dark:bg-slate-900">
          <div class="flex items-center justify-between mb-3">
            <h1 class="text-slate-900 dark:text-white text-base font-bold">
              {{ searchTitle }}
            </h1>
            <span class="text-xs text-slate-500 font-medium">{{ total }}개 발견</span>
          </div>

          <!-- Filter Buttons (Desktop) -->
          <div class="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            <!-- Current Location Button -->
            <CurrentLocationButton
              compact
              @location-found="handleLocationFound"
              @error="handleLocationError"
            />

            <!-- Distance Sort Filter -->
            <button
              class="flex h-8 shrink-0 items-center justify-center gap-x-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 px-3 transition-colors group"
              @click="toggleSortDropdown"
            >
              <span class="text-slate-700 dark:text-slate-300 text-xs font-medium">
                {{ selectedSort === 'distance' ? '거리순' : '이름순' }}
              </span>
              <span class="material-symbols-outlined text-[16px] text-slate-500 group-hover:text-slate-700">keyboard_arrow_down</span>
            </button>

            <!-- Operating Status Filter -->
            <button
              class="flex h-8 shrink-0 items-center justify-center gap-x-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 px-3 transition-colors group"
            >
              <span class="text-slate-700 dark:text-slate-300 text-xs font-medium">운영 상태</span>
              <span class="material-symbols-outlined text-[16px] text-slate-500 group-hover:text-slate-700">keyboard_arrow_down</span>
            </button>
          </div>
        </div>

        <!-- 쓰레기 카테고리 헤더 (Desktop) -->
        <div v-if="selectedCategory === 'trash'" class="hidden md:block px-5 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0 bg-white dark:bg-slate-900">
          <h1 class="text-slate-900 dark:text-white text-base font-bold">쓰레기 배출 일정</h1>
          <p class="text-slate-500 dark:text-slate-400 text-xs mt-1">지역을 선택하여 배출 일정을 확인하세요</p>
        </div>

        <!-- Error State -->
        <div
          v-if="error"
          class="p-5 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm"
        >
          {{ error }}
        </div>

        <!-- Scrollable List -->
        <main class="flex-1 overflow-y-auto custom-scrollbar px-4 space-y-3 pb-8 md:p-3 md:bg-slate-50 md:dark:bg-slate-900">
          <!-- 쓰레기 카테고리: 지역 필터 UI -->
          <template v-if="selectedCategory === 'trash'">
            <!-- 지역 선택 드롭다운 -->
            <div class="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-100 dark:border-slate-700 space-y-3">
              <div class="flex items-center gap-2 mb-2">
                <span class="material-symbols-outlined text-amber-500 text-[20px]">location_city</span>
                <span class="font-semibold text-slate-900 dark:text-white text-sm">지역 선택</span>
              </div>
              <!-- 시/도 선택 -->
              <div class="relative">
                <select
                  v-model="selectedCity"
                  class="w-full bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg py-2.5 px-3 text-slate-900 dark:text-white text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary appearance-none cursor-pointer"
                  @change="handleCityChange(selectedCity)"
                >
                  <option value="">시/도 선택</option>
                  <option v-for="city in cities" :key="city" :value="city">{{ city }}</option>
                </select>
                <span class="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-[18px]">expand_more</span>
              </div>
              <!-- 구/군 선택 -->
              <div class="relative">
                <select
                  v-model="selectedDistrict"
                  :disabled="!selectedCity"
                  class="w-full bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg py-2.5 px-3 text-slate-900 dark:text-white text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  @change="handleDistrictChange(selectedDistrict)"
                >
                  <option value="">구/군 선택</option>
                  <option v-for="dist in districts" :key="dist" :value="dist">{{ dist }}</option>
                </select>
                <span class="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-[18px]">expand_more</span>
              </div>
              <!-- 동/지역 이름 검색 -->
              <div class="relative">
                <div class="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                  <span class="material-symbols-outlined text-slate-400 text-[18px]">search</span>
                </div>
                <input
                  v-model="wasteKeyword"
                  :disabled="!selectedDistrict"
                  class="w-full bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg py-2.5 pl-9 pr-3 text-slate-900 dark:text-white text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed"
                  type="text"
                  placeholder="동/지역 이름 검색"
                  @input="handleWasteSearch"
                />
              </div>
            </div>

            <!-- 로딩 상태 -->
            <div v-if="wasteLoading" class="flex items-center justify-center py-10">
              <div class="text-center">
                <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-2"></div>
                <p class="text-slate-500 dark:text-slate-400 text-sm">배출 일정 조회 중...</p>
              </div>
            </div>

            <!-- 담당 부서 연락처 -->
            <div v-if="wasteContact && !wasteLoading" class="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-100 dark:border-blue-800">
              <div class="flex items-center gap-2 mb-1">
                <span class="material-symbols-outlined text-blue-500 text-[18px]">support_agent</span>
                <span class="font-semibold text-blue-900 dark:text-blue-100 text-sm">{{ wasteContact.name }}</span>
              </div>
              <a
                v-if="wasteContact.phone"
                :href="`tel:${wasteContact.phone}`"
                class="text-blue-600 dark:text-blue-400 text-sm hover:underline flex items-center gap-1"
              >
                <span class="material-symbols-outlined text-[16px]">call</span>
                {{ wasteContact.phone }}
              </a>
            </div>

            <!-- 배출 일정 목록 -->
            <template v-if="wasteSchedules.length > 0 && !wasteLoading">
              <WasteScheduleCard
                v-for="region in wasteSchedules"
                :key="region.id"
                :region="region"
              />
            </template>

            <!-- 안내 메시지 (지역 미선택 시) -->
            <div v-if="!selectedCity && !wasteLoading" class="py-10 text-center">
              <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <span class="material-symbols-outlined text-amber-500 text-[32px]">delete</span>
              </div>
              <p class="text-slate-600 dark:text-slate-400 font-medium">지역을 선택해주세요</p>
              <p class="text-slate-400 dark:text-slate-500 text-sm mt-1">시/도와 구/군을 선택하면<br/>쓰레기 배출 일정을 확인할 수 있어요</p>
            </div>

            <!-- 지역 선택 후 결과 없음 -->
            <div v-if="selectedDistrict && wasteSchedules.length === 0 && !wasteLoading" class="py-10 text-center">
              <div class="text-4xl mb-4">📭</div>
              <p class="text-slate-600 dark:text-slate-400 font-medium">등록된 배출 일정이 없습니다</p>
              <p class="text-slate-400 dark:text-slate-500 text-sm mt-1">해당 지역의 배출 정보가 아직 등록되지 않았어요</p>
            </div>
          </template>

          <!-- 다른 카테고리: 기존 시설 목록 -->
          <template v-else>
            <!-- Loading State -->
            <div v-if="loading" class="flex items-center justify-center py-20">
              <div class="text-center">
                <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-2"></div>
                <p class="text-slate-500 dark:text-slate-400 text-sm">검색 중...</p>
              </div>
            </div>

            <!-- Results -->
            <template v-else>
              <!-- Result Cards (Mobile Style from Stitch) -->
              <div
                v-for="(facility, index) in facilities"
                :key="facility.id"
                :class="[
                  'group bg-white dark:bg-slate-800 rounded-xl p-4 shadow-subtle hover:shadow-lg dark:shadow-none transition-all duration-300 border cursor-pointer',
                  selectedFacilityId === facility.id
                    ? 'border-primary/20 dark:border-primary/40'
                    : 'border-transparent hover:border-primary/20 dark:hover:border-primary/40'
                ]"
                @click="handleFacilitySelect(facility)"
              >
                <div class="flex items-start gap-4">
                  <!-- Icon -->
                  <div
                    :class="[
                      'shrink-0 w-12 h-12 rounded-full flex items-center justify-center',
                      selectedFacilityId === facility.id
                        ? 'bg-primary/10 dark:bg-primary/20'
                        : 'bg-slate-100 dark:bg-slate-700'
                    ]"
                  >
                    <CategoryIcon :category-id="facility.category" size="md" />
                  </div>
                  <!-- Details -->
                  <div class="flex-1 min-w-0 flex flex-col justify-center h-full pt-0.5">
                    <div class="flex justify-between items-start">
                      <h3 class="text-slate-900 dark:text-white text-base font-bold truncate pr-2">
                        {{ facility.name }}
                      </h3>
                      <span
                        v-if="facility.distance !== undefined"
                        :class="[
                          'shrink-0 font-bold text-sm',
                          selectedFacilityId === facility.id
                            ? 'text-primary bg-primary/5 px-2 py-0.5 rounded-md'
                            : 'text-slate-500 dark:text-slate-400 font-semibold'
                        ]"
                      >
                        {{ formatDistance(facility.distance) }}
                      </span>
                    </div>
                    <p class="text-slate-500 dark:text-slate-400 text-xs font-normal mt-1 truncate">
                      {{ facility.address }}
                    </p>
                    <div class="mt-2.5 flex items-center gap-3">
                      <OperatingStatusBadge
                        v-if="getOperatingStatus(facility)"
                        :status="getOperatingStatus(facility)!"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <!-- Empty State -->
              <div v-if="facilities.length === 0 && !loading" class="py-20 text-center">
                <div class="text-5xl mb-4">🔍</div>
                <p class="text-slate-600 dark:text-slate-400 font-medium">검색 결과가 없습니다</p>
                <p class="text-slate-400 dark:text-slate-500 text-sm mt-1">다른 검색어를 입력해보세요</p>
              </div>

              <!-- Load More -->
              <div v-if="hasMore && facilities.length > 0" class="py-4 text-center">
                <button
                  class="text-sm font-medium text-primary hover:text-blue-700 transition-colors"
                  @click="loadMore"
                >
                  더 보기
                </button>
              </div>
            </template>
          </template>
        </main>
      </aside>

      <!-- Right Side: Interactive Map (쓰레기 카테고리가 아닐 때만 표시) -->
      <main v-if="selectedCategory !== 'trash'" class="hidden md:flex flex-1 relative bg-slate-200 dark:bg-slate-800 h-full w-full overflow-hidden">
        <!-- Map Component -->
        <ClientOnly>
          <FacilityMap
            :center="mapCenter"
            :facilities="facilities"
            :level="mapLevel"
            :user-location="userLocation"
            class="w-full h-full"
            @marker-click="handleFacilitySelect"
            @bounds-changed="handleMapBoundsChanged"
          />
        </ClientOnly>

        <!-- Map Controls -->
        <div class="absolute bottom-8 right-6 flex flex-col gap-2 z-10">
          <button
            class="size-10 bg-white dark:bg-slate-800 rounded-lg shadow-md flex items-center justify-center text-slate-700 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors border border-slate-100 dark:border-slate-700"
            @click="goToCurrentLocation"
          >
            <span class="material-symbols-outlined">my_location</span>
          </button>
          <div
            class="flex flex-col rounded-lg shadow-md overflow-hidden bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700"
          >
            <button
              class="size-10 flex items-center justify-center text-slate-700 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              @click="zoomIn"
            >
              <span class="material-symbols-outlined">add</span>
            </button>
            <button
              class="size-10 flex items-center justify-center text-slate-700 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              @click="zoomOut"
            >
              <span class="material-symbols-outlined">remove</span>
            </button>
          </div>
        </div>
      </main>
    </div>

    <!-- Mobile Fullscreen Map Overlay -->
    <div
      v-if="showMobileMap && selectedCategory !== 'trash'"
      class="md:hidden fixed inset-0 z-40 bg-background-light dark:bg-background-dark flex flex-col"
    >
      <!-- Header -->
      <div class="flex items-center justify-between px-4 py-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shrink-0">
        <h2 class="text-slate-900 dark:text-white text-base font-bold">지도</h2>
        <button
          class="flex items-center justify-center w-10 h-10 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
          @click="toggleMobileMap"
        >
          <span class="material-symbols-outlined text-slate-700 dark:text-slate-200 text-[24px]">close</span>
        </button>
      </div>
      <!-- Map -->
      <div class="flex-1 relative">
        <ClientOnly>
          <FacilityMap
            :center="mapCenter"
            :facilities="facilities"
            :level="mapLevel"
            :user-location="userLocation"
            class="w-full h-full"
            @marker-click="handleFacilitySelect"
            @bounds-changed="handleMapBoundsChanged"
          />
        </ClientOnly>
        <!-- Map Controls -->
        <div class="absolute bottom-8 right-4 flex flex-col gap-2 z-10">
          <button
            class="size-10 bg-white dark:bg-slate-800 rounded-lg shadow-md flex items-center justify-center text-slate-700 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors border border-slate-100 dark:border-slate-700"
            @click="goToCurrentLocation"
          >
            <span class="material-symbols-outlined">my_location</span>
          </button>
          <div
            class="flex flex-col rounded-lg shadow-md overflow-hidden bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700"
          >
            <button
              class="size-10 flex items-center justify-center text-slate-700 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              @click="zoomIn"
            >
              <span class="material-symbols-outlined">add</span>
            </button>
            <button
              class="size-10 flex items-center justify-center text-slate-700 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              @click="zoomOut"
            >
              <span class="material-symbols-outlined">remove</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Mobile FAB: "지도에서 보기" (쓰레기 카테고리가 아닐 때만 표시) -->
    <div v-if="selectedCategory !== 'trash'" class="md:hidden fixed bottom-8 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-4 flex justify-center pointer-events-none">
      <button
        class="pointer-events-auto bg-primary text-white shadow-xl shadow-primary/30 hover:shadow-primary/50 hover:-translate-y-1 active:translate-y-0 transition-all duration-300 rounded-full py-3.5 px-6 flex items-center gap-2.5 font-bold text-base"
        @click="toggleMobileMap"
      >
        <span class="material-symbols-outlined" style="font-size: 20px;">{{ showMobileMap ? 'list' : 'map' }}</span>
        {{ showMobileMap ? '목록 보기' : '지도에서 보기' }}
      </button>
    </div>

    <!-- Gradient overlay at bottom for smoother scroll end (Mobile) -->
    <div class="md:hidden fixed bottom-0 left-0 w-full h-12 bg-gradient-to-t from-background-light dark:from-background-dark to-transparent pointer-events-none z-40"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useFacilitySearch } from '~/composables/useFacilitySearch'
import { useGeolocation } from '~/composables/useGeolocation'
import { useWasteSchedule } from '~/composables/useWasteSchedule'
import { useFacilityMeta } from '~/composables/useFacilityMeta'
import { useStructuredData } from '~/composables/useStructuredData'
import type { RegionSchedule } from '~/composables/useWasteSchedule'
import type { FacilityCategory, Facility } from '~/types/facility'

const route = useRoute()
const router = useRouter()
const { setSearchMeta } = useFacilityMeta()
const { setItemListSchema } = useStructuredData()

// Search State
const { loading, facilities, total, currentPage, totalPages, error, search, resetPage, setPage, clearResults } = useFacilitySearch()
const { getCurrentPosition } = useGeolocation()

// Waste Schedule State (지역 기반 검색)
const { getCities, getDistricts, getSchedules, isLoading: wasteLoading } = useWasteSchedule()

const selectedCity = ref<string>('')
const selectedDistrict = ref<string>('')
const wasteKeyword = ref<string>('')
const cities = ref<string[]>([])
const districts = ref<string[]>([])
const wasteSchedules = ref<RegionSchedule[]>([])
const wasteContact = ref<{ name: string; phone?: string } | null>(null)

// UI State
const searchKeyword = ref('')
const selectedCategory = ref<FacilityCategory | 'all'>('all')
const selectedSort = ref<'distance' | 'name'>('distance')
const selectedFacilityId = ref<string | null>(null)
const showMobileMap = ref(false)
const showFilterDropdown = ref(false)
const userLocation = ref<{ lat: number; lng: number } | null>(null)
const mapBounds = ref<{ center: { lat: number; lng: number }; sw: { lat: number; lng: number }; ne: { lat: number; lng: number } } | null>(null)
const mapLevel = ref(5)

// Category tabs with 3D icons
const categoryTabs = [
  { id: 'all' as const, label: '전체' },
  { id: 'toilet' as const, label: '화장실' },
  { id: 'wifi' as const, label: '와이파이' },
  { id: 'clothes' as const, label: '의류수거함' },
  { id: 'kiosk' as const, label: '발급기' },
  { id: 'trash' as const, label: '쓰레기' },
]

// Computed
const searchTitle = computed(() => {
  if (searchKeyword.value) {
    return `"${searchKeyword.value}" 검색 결과`
  }
  return '주변 시설'
})

const hasMore = computed(() => currentPage.value < totalPages.value)

const mapCenter = computed(() => {
  if (selectedFacilityId.value) {
    const selected = facilities.value.find((f) => f.id === selectedFacilityId.value)
    if (selected) {
      return { lat: selected.lat, lng: selected.lng }
    }
  }
  if (userLocation.value) {
    return userLocation.value
  }
  // Default to Seoul City Hall
  return { lat: 37.5665, lng: 126.978 }
})

// Methods
const performSearch = () => {
  // trash는 시설 검색이 아닌 별도 waste-schedules API 사용
  if (selectedCategory.value === 'trash') return

  const params: Record<string, unknown> = {
    page: currentPage.value,
    limit: 20,
    sort: selectedSort.value,
  }

  if (searchKeyword.value) {
    params.keyword = searchKeyword.value
  }

  if (selectedCategory.value && selectedCategory.value !== 'all') {
    params.category = selectedCategory.value
  }

  // bounds가 있으면 영역 기반, 없으면 기존 반경 기반
  if (mapBounds.value) {
    const { center, sw, ne } = mapBounds.value
    params.lat = center.lat
    params.lng = center.lng
    params.swLat = sw.lat
    params.swLng = sw.lng
    params.neLat = ne.lat
    params.neLng = ne.lng
  } else if (userLocation.value) {
    params.lat = userLocation.value.lat
    params.lng = userLocation.value.lng
    params.radius = 5000
  }

  search(params)
}

const handleSearch = () => {
  showFilterDropdown.value = false
  resetPage()
  performSearch()
}

const clearSearch = () => {
  searchKeyword.value = ''
  handleSearch()
}

const handleCategoryChange = async (category: FacilityCategory | 'all') => {
  showFilterDropdown.value = false
  selectedCategory.value = category
  resetPage()

  if (category === 'trash') {
    // 쓰레기 선택 시 시/도 목록 로드
    if (cities.value.length === 0) {
      cities.value = await getCities()
    }
    // 기존 검색 결과 초기화
    clearResults()
  } else {
    // 다른 카테고리는 기존 검색 수행
    // 쓰레기 관련 상태 초기화
    selectedCity.value = ''
    selectedDistrict.value = ''
    wasteKeyword.value = ''
    wasteSchedules.value = []
    wasteContact.value = null
    performSearch()
  }
}

const handleCityChange = async (city: string) => {
  selectedCity.value = city
  selectedDistrict.value = ''
  wasteKeyword.value = ''
  wasteSchedules.value = []
  wasteContact.value = null
  if (city) {
    districts.value = await getDistricts(city)
  } else {
    districts.value = []
  }
}

const handleDistrictChange = async (district: string) => {
  selectedDistrict.value = district
  wasteKeyword.value = ''
  if (district) {
    const result = await getSchedules(selectedCity.value, district)
    wasteSchedules.value = result.schedules
    wasteContact.value = result.contact || null
  } else {
    wasteSchedules.value = []
    wasteContact.value = null
  }
}

let wasteSearchTimer: ReturnType<typeof setTimeout> | null = null

const handleWasteSearch = () => {
  if (wasteSearchTimer) clearTimeout(wasteSearchTimer)
  wasteSearchTimer = setTimeout(async () => {
    if (selectedCity.value && selectedDistrict.value) {
      const result = await getSchedules(selectedCity.value, selectedDistrict.value, wasteKeyword.value || undefined)
      wasteSchedules.value = result.schedules
      wasteContact.value = result.contact || null
    }
  }, 300)
}

const handleFacilitySelect = (facility: Facility) => {
  selectedFacilityId.value = facility.id
  navigateTo(`/${facility.category}/${facility.id}`)
}

const handleLocationFound = (position: { lat: number; lng: number }) => {
  userLocation.value = position
  resetPage()
  performSearch()
}

const handleLocationError = (message: string) => {
  console.error('위치 확인 실패:', message)
}

const loadMore = () => {
  setPage(currentPage.value + 1)
  performSearch()
}

const toggleSortDropdown = () => {
  selectedSort.value = selectedSort.value === 'distance' ? 'name' : 'distance'
  performSearch()
}

const toggleMobileMap = () => {
  showMobileMap.value = !showMobileMap.value
}

const selectSort = (sort: 'distance' | 'name') => {
  if (selectedSort.value !== sort) {
    selectedSort.value = sort
    performSearch()
  }
  showFilterDropdown.value = false
}

let boundsSearchTimer: ReturnType<typeof setTimeout> | null = null

const handleMapBoundsChanged = (bounds: { center: { lat: number; lng: number }; sw: { lat: number; lng: number }; ne: { lat: number; lng: number } }) => {
  mapBounds.value = bounds

  // 디바운스: 지도 이동 중 과도한 검색 방지
  if (boundsSearchTimer) clearTimeout(boundsSearchTimer)
  boundsSearchTimer = setTimeout(() => {
    resetPage()
    performSearch()
  }, 300)
}

const goToCurrentLocation = async () => {
  try {
    const position = await getCurrentPosition()
    userLocation.value = position
    performSearch()
  } catch (err) {
    console.error('위치 가져오기 실패:', err)
  }
}

const zoomIn = () => {
  if (mapLevel.value > 1) {
    mapLevel.value -= 1
  }
}

const zoomOut = () => {
  if (mapLevel.value < 14) {
    mapLevel.value += 1
  }
}

// Helper Functions
const formatDistance = (distance: number): string => {
  if (distance >= 1000) {
    return `${(distance / 1000).toFixed(1)}km`
  }
  return `${Math.round(distance)}m`
}

type OperatingStatus = 'open24h' | 'openNow' | 'closed' | 'limited' | null

const getOperatingStatus = (facility: Facility): OperatingStatus => {
  const details = facility.details
  if (!details) return null

  // Check for 24h operation (toilet, kiosk)
  if (details.operatingHours === '24시간' || details.is24Hour) {
    return 'open24h'
  }

  // Check for operating status in wifi
  if (details.operationStatus === '운영') {
    return 'openNow'
  }

  // Check for closed status
  if (details.operationStatus === '중지' || details.status === 'closed') {
    return 'closed'
  }

  // Check for time-limited operation
  if (details.operatingHours || details.weekdayOperatingHours) {
    return 'limited'
  }

  return null
}

// Watch for route query changes
watch(
  () => route.query,
  (query, oldQuery) => {
    const keywordChanged = query.keyword !== oldQuery?.keyword
    const categoryChanged = query.category !== oldQuery?.category

    if (query.keyword) {
      searchKeyword.value = query.keyword as string
    } else if (keywordChanged) {
      searchKeyword.value = ''
    }

    if (query.category) {
      const newCategory = query.category as FacilityCategory
      if (categoryChanged) {
        handleCategoryChange(newCategory)
      } else {
        selectedCategory.value = newCategory
      }
    } else if (categoryChanged) {
      handleCategoryChange('all')
    }

    if (query.useLocation === 'true') {
      goToCurrentLocation()
    } else if (keywordChanged && !categoryChanged) {
      // 키워드만 변경된 경우 검색 수행
      resetPage()
      performSearch()
    }
  },
  { immediate: true }
)

// Lifecycle
onMounted(() => {
  // Read initial query params
  if (route.query.keyword) {
    searchKeyword.value = route.query.keyword as string
  }
  if (route.query.category) {
    selectedCategory.value = route.query.category as FacilityCategory
  }

  // SEO 메타태그 설정
  setSearchMeta({
    keyword: searchKeyword.value || undefined,
    category: selectedCategory.value !== 'all' ? selectedCategory.value : undefined,
  })

  // Initial search
  performSearch()
})

// 검색 조건 변경 시 메타태그 업데이트
watch([searchKeyword, selectedCategory], () => {
  setSearchMeta({
    keyword: searchKeyword.value || undefined,
    category: selectedCategory.value !== 'all' ? selectedCategory.value : undefined,
  })
})

// ItemList 구조화 데이터 + 페이지네이션 link 태그
watch([facilities, currentPage, totalPages], () => {
  if (facilities.value.length > 0 && selectedCategory.value !== 'trash') {
    setItemListSchema(
      facilities.value.map((f, index) => ({
        name: f.name,
        url: `/${f.category}/${f.id}`,
        position: (currentPage.value - 1) * 20 + index + 1,
      }))
    )
  }

  // 페이지네이션 rel link 태그
  const paginationLinks: Array<{ rel: string; href: string }> = []
  const baseUrl = 'https://ilsangkit.co.kr/search'
  const queryParams = new URLSearchParams()
  if (searchKeyword.value) queryParams.set('keyword', searchKeyword.value)
  if (selectedCategory.value !== 'all') queryParams.set('category', selectedCategory.value)
  const baseQuery = queryParams.toString()

  if (currentPage.value > 1) {
    const prevParams = new URLSearchParams(baseQuery)
    prevParams.set('page', String(currentPage.value - 1))
    paginationLinks.push({ rel: 'prev', href: `${baseUrl}?${prevParams.toString()}` })
  }
  if (currentPage.value < totalPages.value) {
    const nextParams = new URLSearchParams(baseQuery)
    nextParams.set('page', String(currentPage.value + 1))
    paginationLinks.push({ rel: 'next', href: `${baseUrl}?${nextParams.toString()}` })
  }

  useHead({ link: paginationLinks })
})
</script>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background-color: #cbd5e1;
  border-radius: 20px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background-color: #94a3b8;
}

.no-scrollbar::-webkit-scrollbar {
  display: none;
}
.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

/* Stitch design shadow */
.shadow-subtle {
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.03);
}
</style>

<style>
.material-symbols-outlined {
  font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
}

/* Material Icon fill variant */
.material-symbols-outlined.fill-1 {
  font-variation-settings: 'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24;
}
</style>
