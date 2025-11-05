import type { ModuleInfo, ViteRPCFunctions } from '@vue/devtools-core'
import { getViteRpcServer } from '@vue/devtools-kit'
import { init, parse } from 'es-module-lexer'
import { debounce } from 'perfect-debounce'
import { RpcFunctionCtx } from './types'

export function getGraphFunctions(ctx: RpcFunctionCtx) {
  const { rpc, server } = ctx
  const debouncedModuleUpdated = debounce(() => {
    getViteRpcServer<ViteRPCFunctions>?.()?.broadcast?.emit('graphModuleUpdated')
  }, 100)

  server.middlewares.use((_, __, next) => {
    debouncedModuleUpdated()
    next()
  })

  // Initialize es-module-lexer
  let lexerInitialized = false
  async function ensureLexerInitialized() {
    if (!lexerInitialized) {
      await init
      lexerInitialized = true
    }
  }

  // Parse dynamic imports from module code
  async function parseDynamicImports(moduleId: string): Promise<string[]> {
    try {
      await ensureLexerInitialized()

      // Try to get the transformed code from the module
      const mod = server.moduleGraph.getModuleById(moduleId)
      if (!mod)
        return []

      let code = mod.transformResult?.code

      // If no transformed code, try to read the file
      if (!code && mod.file) {
        try {
          const fs = await import('node:fs')
          code = await fs.promises.readFile(mod.file, 'utf-8')
        }
        catch {
          return []
        }
      }

      if (!code)
        return []

      // Parse imports using es-module-lexer
      const [imports] = parse(code)

      // Filter dynamic imports (imports with type -2 are dynamic)
      const dynamicImports = imports
        .filter(imp => imp.d > -1) // d > -1 indicates dynamic import
        .map(imp => code!.substring(imp.s, imp.e))
        .filter(Boolean)

      // Resolve the import paths to absolute module IDs
      const resolvedDynamicImports: string[] = []
      for (const importPath of dynamicImports) {
        try {
          const resolved = await server.pluginContainer.resolveId(importPath, moduleId)
          if (resolved && typeof resolved !== 'string') {
            resolvedDynamicImports.push(resolved.id)
          }
          else if (typeof resolved === 'string') {
            resolvedDynamicImports.push(resolved)
          }
        }
        catch {
          // Ignore resolution errors
        }
      }

      return resolvedDynamicImports
    }
    catch {
      return []
    }
  }

  return {
    async getGraphModules(): Promise<ModuleInfo[]> {
      const meta = await rpc.getMetadata()
      const modules = (
        meta
          ? await rpc.getModulesList({
              vite: meta?.instances[0].vite,
              env: meta?.instances[0].environments[0],
            })
          : null
      ) || []
      const filteredModules = modules.filter((m) => {
        return m.id.match(/\.(vue|js|ts|jsx|tsx|html|json)($|\?v=)/)
      })
      const graph = await Promise.all(filteredModules.map(async (i) => {
        function searchForVueDeps(id: string, seen = new Set<string>()): string[] {
          if (seen.has(id))
            return []
          seen.add(id)
          const module = modules.find(m => m.id === id)
          if (!module)
            return []
          return module.deps.flatMap((i) => {
            if (filteredModules.find(m => m.id === i))
              return [i]
            return searchForVueDeps(i, seen)
          })
        }

        // Parse dynamic imports
        const allDynamicDeps = await parseDynamicImports(i.id)

        // Filter to only include modules that are in the filtered list
        const dynamicDeps = allDynamicDeps.filter(dep =>
          filteredModules.find(m => m.id === dep),
        )

        const staticDeps = searchForVueDeps(i.id)

        // Remove dynamic deps from static deps to avoid duplication
        const deps = staticDeps.filter(dep => !dynamicDeps.includes(dep))

        return {
          id: i.id,
          deps,
          dynamicDeps: dynamicDeps.length > 0 ? dynamicDeps : undefined,
        }
      }))
      return graph
    },
  }
}
