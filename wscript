import errno
import json
import os

from waflib.Task import Task

DEFAULT_BUILD_ENV = 'production'
BUILD_ENV = os.environ.get('BUILD_ENV', DEFAULT_BUILD_ENV)
CONSTANTS_FILE = 'src/js/constants.json'

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

TEST_HEADERS = """
#define IS_TEST_BUILD 1
"""

def ensure_dir(filename):
    try:
        os.makedirs(os.path.dirname(filename))
    except OSError as e:
        if e.errno != errno.EEXIST:
            raise

def override_constants_str_for_env_maybe(constants_json_str):
    if BUILD_ENV in ENV_CONSTANTS_OVERRIDES.keys():
        return json.dumps(dict(
            json.loads(constants_json_str),
            **ENV_CONSTANTS_OVERRIDES[BUILD_ENV]
        ))
    else:
        return constants_json_str

def generate_testing_headers_maybe(ctx):
    target = 'src/generated/test_maybe.h'
    ensure_dir(target)
    if BUILD_ENV == 'test':
        with open(target, 'w') as f:
            f.write(TEST_HEADERS)
    else:
        open(target, 'w').close()

def include_constants_for_config_page(ctx):
    target = 'config/js/generated/constants.js'
    ensure_dir(target)
    constants_json_str = override_constants_str_for_env_maybe(open(CONSTANTS_FILE).read())
    constants_definition = "window.CONSTANTS = {};".format(constants_json_str)
    with open(target, 'w') as f:
        f.write(constants_definition)

class concat_and_invoke_js(Task):
    def run(self):
        constants_json_str = override_constants_str_for_env_maybe(self.inputs[0].read())
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

    # TODO: specify these the right way so that they can be rebuilt without `pebble clean`
    ctx.add_pre_fun(generate_testing_headers_maybe)
    ctx.add_pre_fun(include_constants_for_config_page)

    binaries = []

    for p in ctx.env.TARGET_PLATFORMS:
        ctx.set_env(ctx.all_envs[p])
        ctx.set_group(ctx.env.PLATFORM_NAME)
        app_elf='{}/pebble-app.elf'.format(ctx.env.BUILD_DIR)
        ctx.pbl_program(source=ctx.path.ant_glob('src/**/*.c'),
        target=app_elf)

        binaries.append({'platform': p, 'app_elf': app_elf})

    ctx.set_group('bundle')

    out_js_node = ctx.path.find_or_declare('pebble-js-app.js')
    js = concat_and_invoke_js(env=ctx.env)
    js.set_inputs([ctx.path.find_resource(CONSTANTS_FILE)] + ctx.path.ant_glob('src/js/**/*.js'))
    js.set_outputs(out_js_node)
    ctx.add_to_group(js)

    ctx.pbl_bundle(binaries=binaries, js=out_js_node)
