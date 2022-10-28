/* eslint-disable eqeqeq,
                  functional/immutable-data,
                  functional/no-expression-statement,
                  functional/no-let */
import { Transformer } from '@parcel/plugin'
import SourceMap from '@parcel/source-map'
import { loadTSConfig } from '@parcel/ts-utils'
import ttypescript from 'ttypescript'

export default new Transformer({
  loadConfig({ config, options }) {
    return loadTSConfig(config, options)
  },

  async transform({ asset, config, options }) {
    asset.type = 'js'

    const code = await asset.getCode()

    const transpiled = ttypescript.transpileModule(code, {
      compilerOptions: {
        // React is the default. Users can override this by supplying their own tsconfig,
        // which many TypeScript users will already have for typechecking, etc.
        jsx: ttypescript.JsxEmit.React,
        ...config,
        // Always emit output
        noEmit: false,
        // Don't compile ES `import`s -- scope hoisting prefers them and they will
        // otherwise compiled to CJS via babel in the js transformer
        module: ttypescript.ModuleKind.ESNext,
        sourceMap: !(asset.env.sourceMap == null),
      },
      fileName: asset.filePath, // Should be relativePath?
    })

    let map
    let { outputText, sourceMapText } = transpiled
    if (sourceMapText != null) {
      map = new SourceMap(options.projectRoot)
      map.addVLQMap(JSON.parse(sourceMapText))

      outputText = outputText.substring(0, outputText.lastIndexOf('//# sourceMappingURL'))
    }

    return [
      {
        type: 'js',
        content: outputText,
        map,
      },
    ]
  },
})
