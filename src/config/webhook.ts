import { ref, computed } from 'vue'
import type { WebhookConfig } from '@/types/api'

export const WEBHOOK_CONFIG: WebhookConfig = {
  testUrl: 'https://idcpdvvdevopsn8n.gwm.cn/webhook-test/ca967bdd-a769-4073-9ad1-5044963571c4',
  prodUrl: 'https://idcpdvvdevopsn8n.gwm.cn/webhook/ca967bdd-a769-4073-9ad1-5044963571c4',
  timeout: 60000
}

export const useProductionMode = ref(
  localStorage.getItem('jira-terminal-prod-mode') === 'true'
)

export function setUrlMode(isProd: boolean) {
  useProductionMode.value = isProd
  localStorage.setItem('jira-terminal-prod-mode', isProd ? 'true' : 'false')
}

export const webhookUrl = computed(() =>
  useProductionMode.value ? WEBHOOK_CONFIG.prodUrl : WEBHOOK_CONFIG.testUrl
)
