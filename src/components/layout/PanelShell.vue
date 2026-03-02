<template>
  <div class="panel" role="region" :aria-label="title">
    <div class="panel-header">
      <div class="panel-title">
        <slot name="icon"></slot>
        <span class="title-text">{{ title }}</span>
      </div>
      <div class="panel-right">
        <slot name="header-actions"></slot>
        <div class="panel-status">
          <StatusDot :status="status" />
          <span class="status-label" :style="{ color: statusColor }">{{ statusLabel }}</span>
        </div>
      </div>
    </div>
    <div class="panel-body" :class="{ 'panel-body--resizable': resizable }" :style="bodyStyle">
      <slot></slot>
    </div>
    <div v-if="$slots.footer" class="panel-footer">
      <slot name="footer"></slot>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import StatusDot from '@/components/shared/StatusDot.vue'

const props = withDefaults(defineProps<{
  title: string
  status?: 'idle' | 'loading' | 'success' | 'error'
  statusLabel?: string
  resizable?: boolean
  minHeight?: string
  maxHeight?: string
  height?: string
}>(), {
  status: 'idle',
  statusLabel: '',
  resizable: false,
  minHeight: '150px',
  maxHeight: '600px',
  height: '280px'
})

const statusColor = computed(() => {
  const colors = {
    idle: 'var(--text-muted)',
    loading: 'var(--accent-orange)',
    success: 'var(--accent-green)',
    error: 'var(--accent-red)'
  }
  return colors[props.status]
})

const bodyStyle = computed(() => {
  if (props.resizable) {
    return {
      minHeight: props.minHeight,
      maxHeight: props.maxHeight,
      height: props.height
    }
  }
  return { maxHeight: props.maxHeight }
})
</script>

<style scoped>
.panel {
  background-color: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-panel);
  overflow: visible;
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.panel-header {
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: space-between;
  background-color: var(--bg-tertiary);
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
}
.panel-title {
  display: flex;
  align-items: center;
  gap: 8px;
}
.title-text {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
}
.panel-right {
  display: flex;
  align-items: center;
  gap: 12px;
}
.panel-status {
  display: flex;
  align-items: center;
  gap: 8px;
}
.status-label {
  font-size: 12px;
}
.panel-body {
  padding: 12px;
  flex: 1;
  overflow-y: auto;
  border-radius: 0 0 var(--radius-lg) var(--radius-lg);
  background-color: var(--bg-secondary);
}
.panel-body--resizable {
  resize: vertical;
}
.panel-body--resizable::-webkit-resizer {
  background: linear-gradient(
    135deg,
    transparent 50%, var(--border-color) 50%,
    var(--border-color) 60%, transparent 60%,
    transparent 70%, var(--border-color) 70%,
    var(--border-color) 80%, transparent 80%
  );
  border-radius: 0 0 8px 0;
}
.panel-footer {
  padding: 12px;
  border-top: 1px solid var(--border-color);
}
</style>
