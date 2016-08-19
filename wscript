import errno
import json
import os

from waflib.Task import Task

DEFAULT_BUILD_ENV = 'production'
BUILD_ENV = os.environ.get('BUILD_ENV', DEFAULT_BUILD_ENV)
DEBUG = os.environ.get('DEBUG')
CONSTANTS_FILE = 'src/js/constants.json'

ENV_CONSTANTS_OVERRIDES = {
    'test': {
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

def constants_for_environment():
    constants = json.loads(open(CONSTANTS_FILE).read())
    constants.update(ENV_CONSTANTS_OVERRIDES.get(BUILD_ENV, {}))
    constants.update(DEBUG=DEBUG)
    return constants

def generate_constants_file(ctx):
    target = 'src/js/generated/constants.json'
    ensure_dir(target)
    with open(target, 'w') as f:
        f.write(json.dumps(constants_for_environment()))

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
    constants_definition = "window.CONSTANTS = {};".format(json.dumps(constants_for_environment()))
    with open(target, 'w') as f:
        f.write(constants_definition)

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
    ctx.add_pre_fun(generate_constants_file)
    ctx.add_pre_fun(include_constants_for_config_page)

    binaries = []

    for p in ctx.env.TARGET_PLATFORMS:
        ctx.set_env(ctx.all_envs[p])
        ctx.set_group(ctx.env.PLATFORM_NAME)
        app_elf='{}/pebble-app.elf'.format(ctx.env.BUILD_DIR)
        ctx.pbl_program(source=ctx.path.ant_glob('src/**/*.c'), target=app_elf)
        binaries.append({'platform': p, 'app_elf': app_elf})

    ctx.set_group('bundle')
    ctx.pbl_bundle(binaries=binaries,
                   js=ctx.path.ant_glob(['src/js/**/*.js', 'src/js/**/*.json']),
                   js_entry_file='src/js/app.js')
