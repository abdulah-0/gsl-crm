// vite.config.ts
import { defineConfig } from "file:///C:/Users/snake/OneDrive/Desktop/gsl-crm/node_modules/vite/dist/node/index.js";
import react from "file:///C:/Users/snake/OneDrive/Desktop/gsl-crm/node_modules/@vitejs/plugin-react/dist/index.mjs";
import tagger from "file:///C:/Users/snake/OneDrive/Desktop/gsl-crm/node_modules/@dhiwise/component-tagger/dist/index.mjs";
var vite_config_default = defineConfig({
  build: {
    outDir: "build"
  },
  plugins: [react(), tagger()],
  resolve: {
    alias: {
      "@": "/src",
      "@components": "/src/components",
      "@pages": "/src/pages",
      "@assets": "/src/assets",
      "@constants": "/src/constants",
      "@styles": "/src/styles"
    }
  },
  server: {
    port: "4028",
    host: "0.0.0.0",
    strictPort: true,
    allowedHosts: [".amazonaws.com", ".builtwithrocket.new"]
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxzbmFrZVxcXFxPbmVEcml2ZVxcXFxEZXNrdG9wXFxcXGdzbC1jcm1cIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIkM6XFxcXFVzZXJzXFxcXHNuYWtlXFxcXE9uZURyaXZlXFxcXERlc2t0b3BcXFxcZ3NsLWNybVxcXFx2aXRlLmNvbmZpZy50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vQzovVXNlcnMvc25ha2UvT25lRHJpdmUvRGVza3RvcC9nc2wtY3JtL3ZpdGUuY29uZmlnLnRzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSAndml0ZSc7XG5pbXBvcnQgcmVhY3QgZnJvbSAnQHZpdGVqcy9wbHVnaW4tcmVhY3QnO1xuaW1wb3J0IHRhZ2dlciBmcm9tIFwiQGRoaXdpc2UvY29tcG9uZW50LXRhZ2dlclwiO1xuXG4vLyBodHRwczovL3ZpdGVqcy5kZXYvY29uZmlnL1xuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKHtcbiAgYnVpbGQ6IHtcbiAgICBvdXREaXI6IFwiYnVpbGRcIixcbiAgfSxcbiAgcGx1Z2luczogW3JlYWN0KCksdGFnZ2VyKCldLFxuICByZXNvbHZlOiB7XG4gICAgYWxpYXM6IHtcbiAgICAgICdAJzogJy9zcmMnLFxuICAgICAgJ0Bjb21wb25lbnRzJzogJy9zcmMvY29tcG9uZW50cycsXG4gICAgICAnQHBhZ2VzJzogJy9zcmMvcGFnZXMnLFxuICAgICAgJ0Bhc3NldHMnOiAnL3NyYy9hc3NldHMnLFxuICAgICAgJ0Bjb25zdGFudHMnOiAnL3NyYy9jb25zdGFudHMnLFxuICAgICAgJ0BzdHlsZXMnOiAnL3NyYy9zdHlsZXMnLFxuICAgIH0sXG4gIH0sXG4gIHNlcnZlcjoge1xuICAgIHBvcnQ6IFwiNDAyOFwiLFxuICAgIGhvc3Q6IFwiMC4wLjAuMFwiLFxuICAgIHN0cmljdFBvcnQ6IHRydWUsXG4gICAgYWxsb3dlZEhvc3RzOiBbJy5hbWF6b25hd3MuY29tJywgJy5idWlsdHdpdGhyb2NrZXQubmV3J11cbiAgfVxufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQW1ULFNBQVMsb0JBQW9CO0FBQ2hWLE9BQU8sV0FBVztBQUNsQixPQUFPLFlBQVk7QUFHbkIsSUFBTyxzQkFBUSxhQUFhO0FBQUEsRUFDMUIsT0FBTztBQUFBLElBQ0wsUUFBUTtBQUFBLEVBQ1Y7QUFBQSxFQUNBLFNBQVMsQ0FBQyxNQUFNLEdBQUUsT0FBTyxDQUFDO0FBQUEsRUFDMUIsU0FBUztBQUFBLElBQ1AsT0FBTztBQUFBLE1BQ0wsS0FBSztBQUFBLE1BQ0wsZUFBZTtBQUFBLE1BQ2YsVUFBVTtBQUFBLE1BQ1YsV0FBVztBQUFBLE1BQ1gsY0FBYztBQUFBLE1BQ2QsV0FBVztBQUFBLElBQ2I7QUFBQSxFQUNGO0FBQUEsRUFDQSxRQUFRO0FBQUEsSUFDTixNQUFNO0FBQUEsSUFDTixNQUFNO0FBQUEsSUFDTixZQUFZO0FBQUEsSUFDWixjQUFjLENBQUMsa0JBQWtCLHNCQUFzQjtBQUFBLEVBQ3pEO0FBQ0YsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K
