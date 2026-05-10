const esbuild = require('esbuild')
const watch = process.argv.includes('--watch')

const config = {
  entryPoints: ['editor.ts'],
  bundle: true,
  outfile: '../Sources/lmd/Resources/editor.bundle.js',
  minify: !watch,
  sourcemap: watch ? 'inline' : false,
}

if (watch) {
  esbuild.context(config).then(ctx => {
    ctx.watch()
    console.log('watching...')
  })
} else {
  esbuild.build(config).catch(() => process.exit(1))
}
