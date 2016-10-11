import errno
import json
import os

from waflib.Task import Task

def add_environment_specific_constants(out, build_env, debug):
    if build_env == 'test':
        # Don't clobber config in localStorage with test config
        out['LOCAL_STORAGE_KEY_CONFIG'] = 'test_config'
    elif build_env == 'development':
        # Can't use `pebble emu-app-config --file` because it bypasses the JS
        # which adds current config as a query param when it opens the page:
        # https://github.com/pebble/pebble-tool/blob/0e51fa/pebble_tool/commands/emucontrol.py#L116
        out['CONFIG_URL'] = 'file://{}/config/index.html'.format(os.path.abspath(os.path.curdir))
    if debug:
        out['DEBUG'] = True

class generate_constants_json(Task):
    vars = ['BUILD_ENV', 'DEBUG']
    def run(self):
        constants = json.loads(self.inputs[0].read())
        add_environment_specific_constants(constants, self.env.BUILD_ENV, self.env.DEBUG)
        self.outputs[0].write(json.dumps(constants))

class generate_js_includes_for_config_page(Task):
    vars = ['BUILD_ENV', 'DEBUG']
    def run(self):
        constants = json.loads(self.inputs[0].read())
        add_environment_specific_constants(constants, self.env.BUILD_ENV, self.env.DEBUG)
        includes = "window.CONSTANTS = {};".format(json.dumps(constants))
        for js_file in self.inputs[1:]:
            includes += '\n(function() { /* %s */\n%s\n})();' % (js_file.relpath(), js_file.read())
        self.outputs[0].write(includes)

top = '.'
out = 'build'

def options(ctx):
    ctx.load('pebble_sdk')

def configure(ctx):
    ctx.load('pebble_sdk')

def build(ctx):
    ctx.load('pebble_sdk')

    binaries = []

    for p in ctx.env.TARGET_PLATFORMS:
        ctx.set_env(ctx.all_envs[p])
        ctx.set_group(ctx.env.PLATFORM_NAME)
        if os.environ.get('BUILD_ENV') == 'test':
            # When running screenshot tests, the watchface needs to know it's
            # under test so that fake data can be shown (e.g. current time).
            ctx.env.append_value('DEFINES', 'IS_TEST_BUILD')

        app_elf='{}/pebble-app.elf'.format(ctx.env.BUILD_DIR)
        ctx.pbl_program(source=ctx.path.ant_glob('src/**/*.c'), target=app_elf)
        binaries.append({'platform': p, 'app_elf': app_elf})

    ctx.set_group('bundle')

    ctx.env.BUILD_ENV = os.environ.get('BUILD_ENV', 'production')
    ctx.env.DEBUG = os.environ.get('DEBUG')

    config_js_includes = ctx.srcnode.make_node('config/js/generated/includes.js')
    config_js_includes.parent.mkdir()
    gen_js_includes = generate_js_includes_for_config_page(env=ctx.env)
    gen_js_includes.set_inputs([
        ctx.path.find_resource('src/js/constants.json'),
        ctx.path.find_resource('config/js/vendor.min.js'),
        ctx.path.find_resource('src/js/points.js'),
        ctx.path.find_resource('src/js/status_formatters.js'),
    ])
    gen_js_includes.set_outputs(config_js_includes)
    ctx.add_to_group(gen_js_includes)

    # This must be in the src/ directory to be available to `require` in JS
    constants_json = ctx.srcnode.make_node('src/js/generated/constants.json')
    constants_json.parent.mkdir()
    gen_constants = generate_constants_json(env=ctx.env)
    gen_constants.set_inputs(ctx.path.find_resource('src/js/constants.json'))
    gen_constants.set_outputs(constants_json)
    ctx.add_to_group(gen_constants)

    ctx.pbl_bundle(
        binaries=binaries,
        js=ctx.path.ant_glob(['src/js/**/*.js', 'src/js/**/*.json']),
        js_entry_file='src/js/app.js'
    )
