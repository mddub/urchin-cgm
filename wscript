import os.path

top = '.'
out = 'build'
JS_CONFIG = 'src/js/_config.js'

def options(ctx):
    ctx.load('pebble_sdk')

def configure(ctx):
    ctx.load('pebble_sdk')

def build(ctx):
    ctx.load('pebble_sdk')

    build_worker = os.path.exists('worker_src')
    binaries = []

    for p in ctx.env.TARGET_PLATFORMS:
        ctx.set_env(ctx.all_envs[p])
        ctx.set_group(ctx.env.PLATFORM_NAME)
        app_elf='{}/pebble-app.elf'.format(ctx.env.BUILD_DIR)
        ctx.pbl_program(source=ctx.path.ant_glob('src/**/*.c'),
        target=app_elf)

        if build_worker:
            worker_elf='{}/pebble-worker.elf'.format(ctx.env.BUILD_DIR)
            binaries.append({'platform': p, 'app_elf': app_elf, 'worker_elf': worker_elf})
            ctx.pbl_worker(source=ctx.path.ant_glob('worker_src/**/*.c'),
            target=worker_elf)
        else:
            binaries.append({'platform': p, 'app_elf': app_elf})

    ctx.set_group('bundle')

    if not ctx.path.find_resource(JS_CONFIG):
        raise Exception("Missing JS config file (%s)" % JS_CONFIG)

    all_js = "\n".join([node.read() for node in ctx.path.ant_glob('src/js/**/*.js')])
    out_js_node = ctx.path.make_node('build/pebble-js-app.js')
    out_js_node.write(all_js)

    ctx.pbl_bundle(binaries=binaries, js=out_js_node)
