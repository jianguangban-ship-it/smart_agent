import { createApp } from 'vue'
import App from './App.vue'
import './styles/variables.css'
import './styles/global.css'
import './styles/transitions.css'
import './styles/config-forms.css'
// v10.135: vue-virtual-scroller's bundled CSS — sets up the host element
// positioning required by DynamicScroller. Imported once, applies globally.
import 'vue-virtual-scroller/dist/vue-virtual-scroller.css'
// v10.193: raise the scroller's itemsLimit above production row counts — at
// the default 1000 a momentarily unmeasurable viewport makes it THROW with
// 1000+ rows, killing Vue's reactive flush (whole UI freezes).
import { applyScrollerConfig } from './main-scroller-config'

applyScrollerConfig()

const app = createApp(App)
app.mount('#app')
