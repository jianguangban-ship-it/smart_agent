import { createApp } from 'vue'
import App from './App.vue'
import './styles/variables.css'
import './styles/global.css'
import './styles/transitions.css'
// v10.135: vue-virtual-scroller's bundled CSS — sets up the host element
// positioning required by DynamicScroller. Imported once, applies globally.
import 'vue-virtual-scroller/dist/vue-virtual-scroller.css'

const app = createApp(App)
app.mount('#app')
