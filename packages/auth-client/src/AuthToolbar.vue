<template>
  <div class="flex items-center gap-1">
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
}>(), {
  showCopyUrl: true,
  showSettings: true,
  showLogout: true,
})

const emit = defineEmits<{
  (e: 'copy-url', success: boolean): void
  (e: 'logout'): void
  (e: 'open-settings', url: string): void
}>()

const { logout, copyLwLoginUrl, getSettingsUrl, getLwDomain } = useAuth()

const hasLwDomain = computed(() => !!getLwDomain())

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
