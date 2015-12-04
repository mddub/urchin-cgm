import os
from waflib.Task import Task

DEFAULT_BUILD_ENV = 'production'
BUILD_ENV = os.environ.get('BUILD_ENV', DEFAULT_BUILD_ENV)

ENV_CONSTANTS_OVERRIDES = {
    'test': {
        'CONFIG_URL': 'http://localhost:{}/auto-config'.format(os.environ.get('MOCK_SERVER_PORT')),
        # Don't clobber config in localStorage with test config
        'LOCAL_STORAGE_KEY_CONFIG': 'test_config',
    },
    'development': {
        # Can't use `pebble emu-app-config --file` because it bypasses the JS
        # which adds current config as a query param when it opens the page:
        # https://github.com/pebble/pebble-tool/blob/0e51fa/pebble_tool/commands/emucontrol.py#L116
        'CONFIG_URL': 'file://{}/config/index.html'.format(os.path.abspath(os.path.curdir))
    }
}

class concat_and_invoke_js(Task):
    def run(self):
        constants_json_str = self.inputs[0].read()
        if BUILD_ENV in ENV_CONSTANTS_OVERRIDES.keys():
            try:
                import simplejson as json
            except ImportError:
                import json
            constants_json_str = json.dumps(dict(
                json.loads(constants_json_str),
                **ENV_CONSTANTS_OVERRIDES[BUILD_ENV]
            ))
        main_call = "main({});".format(constants_json_str)

        all_js = "\n".join([node.read() for node in self.inputs[1:]])
        self.outputs[0].write(all_js + main_call)

top = '.'
out = 'build'

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

    out_js_node = ctx.path.find_or_declare('pebble-js-app.js')
    js = concat_and_invoke_js(env=ctx.env)
    js.set_inputs([ctx.path.find_resource('src/js/constants.json')] + ctx.path.ant_glob('src/js/**/*.js'))
    js.set_outputs(out_js_node)
    ctx.add_to_group(js)

    ctx.pbl_bundle(binaries=binaries, js=out_js_node)
