import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()]
})
```
4. Press **Ctrl+S**

---

Your file structure should look like:
```
📁 siddipet-bazaar
   📄 index.html
   📄 package.json
   📄 vite.config.js
   📁 src
      📄 main.jsx
      📄 App.jsx