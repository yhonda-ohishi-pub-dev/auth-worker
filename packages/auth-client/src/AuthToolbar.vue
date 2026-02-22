<template>
  <div class="flex items-center gap-1">
    <!-- Org slug display -->
    <span
      v-if="showOrgSlug && isAuthenticated && orgSlug"
      class="text-xs px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 whitespace-nowrap"
    >
      {{ orgSlug }}
    </span>

    <!-- User info display -->
    <span
      v-if="showUserInfo && isAuthenticated && username"
      class="text-sm text-gray-600 truncate max-w-[200px]"
      :title="username"
    >
      {{ displayUsername }}
    </span>
    <span
      v-if="showUserInfo && isAuthenticated && providerLabel"
      class="text-xs px-1.5 py-0.5 rounded whitespace-nowrap"
      :class="{
        'bg-blue-100 text-blue-700': provider === 'google',
        'bg-green-100 text-green-700': provider === 'lineworks',
        'bg-gray-100 text-gray-600': provider === 'password',
      }"
    >
      {{ providerLabel }}
    </span>

    <component
      v-if="showCopyUrl && hasLwDomain"
      :is="uButton"
      v-bind="buttonProps"
      @click="handleCopyUrl"
    >
      {{ copyLabel }}
    </component>

    <component
      v-if="showSettings"
      :is="uButton"
      v-bind="buttonProps"
      @click="handleOpenSettings"
    >
      設定
    </component>

    <component
      v-if="showLogout"
      :is="uButton"
      v-bind="buttonProps"
      @click="handleLogout"
    >
      Logout
    </component>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, resolveComponent } from 'vue'
import { useAuth } from './useAuth'

const props = withDefaults(defineProps<{
  showCopyUrl?: boolean
  showSettings?: boolean
  showLogout?: boolean
  showUserInfo?: boolean
  showOrgSlug?: boolean
}>(), {
  showCopyUrl: true,
  showSettings: true,
  showLogout: true,
  showUserInfo: true,
  showOrgSlug: false,
})

const emit = defineEmits<{
  (e: 'copy-url', success: boolean): void
  (e: 'logout'): void
  (e: 'open-settings', url: string): void
}>()

const { logout, copyLwLoginUrl, getSettingsUrl, getLwDomain, isAuthenticated, username, provider, providerLabel, orgSlug } = useAuth()

const hasLwDomain = computed(() => !!getLwDomain())

/** メールアドレスの場合は@以前だけ表示 */
const displayUsername = computed(() => {
  const name = username.value
  if (!name) return ''
  if (name.includes('@')) return name.split('@')[0]
  return name
})

const uButton = computed(() => {
  const resolved = resolveComponent('UButton')
  return typeof resolved === 'string' ? 'button' : resolved
})

const buttonProps = computed(() => {
  if (typeof uButton.value === 'string') {
    return { class: 'px-2 py-1 text-sm border rounded' }
  }
  return { color: 'gray' as const }
})

const copyLabel = ref('URL共有')

async function handleCopyUrl() {
  const success = await copyLwLoginUrl()
  emit('copy-url', success)
  if (success) {
    copyLabel.value = 'Copied!'
    setTimeout(() => { copyLabel.value = 'URL共有' }, 2000)
  }
}

function handleLogout() {
  emit('logout')
  logout()
}

function handleOpenSettings() {
  const url = getSettingsUrl()
  emit('open-settings', url)
  window.open(url, '_blank')
}
</script>
