import json
import os
import subprocess
import time
from datetime import datetime

import requests

PLATFORM = 'aplite'
PORT = os.environ['MOCK_SERVER_PORT']
MOCK_HOST = 'http://localhost:{}'.format(PORT)

CONSTANTS = json.loads(
    open(os.path.join(os.path.dirname(__file__), '../src/js/constants.json')).read()
)
BASE_CONFIG = CONSTANTS['DEFAULT_CONFIG']

def set_config(config):
    _post_mock_server('/set-config', config)

def set_sgvs(sgvs):
    _post_mock_server('/set-sgv', sgvs)

def _post_mock_server(url, data):
    requests.post(MOCK_HOST + url, data=json.dumps(data))

def pebble_install_and_run():
    _call('pebble kill')
    _call('pebble clean')
    # TODO ensure this is called from the main project directory
    _call('pebble build')
    _call('pebble install --emulator {}'.format(PLATFORM))
    # Give the watchface time to show up
    time.sleep(5)

def pebble_set_config():
    """Tell Pebble emulator to open the config page and immediately set config.

    `pebble emu-app-config` first waits for `webbrowser.open_new` to complete,
    then starts the server which handles the URL passed in the return_to param.
    https://github.com/pebble/pebble-tool/blob/e428a0/pebble_tool/util/browser.py#L24

    But specifying a command-line browser for webbrowser via BROWSER makes it a
    blocking (non-"background") subprocess, so the server it's attempting to hit
    hasn't started yet.
    https://hg.python.org/cpython/file/5661480f7763/Lib/webbrowser.py#l180

    Solution: wrap `curl` in a script which briefly sleeps and runs it in the
    background, and use that as the headless browser to request the config page.
    Nothing crazy about that.
    """
    _call(
      'pebble emu-app-config --emulator {}'.format(PLATFORM),
      env=dict(os.environ, BROWSER=os.path.join(os.path.dirname(__file__), 'background_curl.sh'))
    )

def pebble_screenshot(filename):
    _call('pebble screenshot --emulator {} --no-open {}'.format(PLATFORM, filename))

def _call(command_str, **kwargs):
    print command_str
    return subprocess.Popen(
        command_str.split(' '),
        stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
        **kwargs
    ).communicate()

def ensure_empty_dir(dirname):
    if os.path.isdir(dirname):
        _, err = _call('rm -r {}'.format(dirname))
        if err != '':
            raise Exception(err)
    os.mkdir(dirname)

def image_diff(test_file, gold_file, out_file):
    # requires ImageMagick
    _, diff = _call('compare -metric AE {} {} {}'.format(test_file, gold_file, out_file))
    return diff == '0'


class ScreenshotTest(object):
    @staticmethod
    def out_dir():
        return os.path.join(os.path.dirname(__file__), 'output')

    @classmethod
    def test_filename(cls):
        return os.path.join(cls.out_dir(), 'img', cls.__name__ + '.png')

    @classmethod
    def gold_filename(cls):
        return os.path.join(os.path.dirname(__file__), 'gold', cls.__name__ + '.png')

    @classmethod
    def diff_filename(cls):
        return os.path.join(cls.out_dir(), 'diff', cls.__name__ + '.png')

    @classmethod
    def ensure_environment(cls):
        if hasattr(ScreenshotTest, '_loaded_environment'):
            return
        pebble_install_and_run()
        ensure_empty_dir(cls.out_dir())
        os.mkdir(os.path.join(cls.out_dir(), 'img'))
        os.mkdir(os.path.join(cls.out_dir(), 'diff'))
        ScreenshotTest.summary_file = SummaryFile(os.path.join(cls.out_dir(), 'screenshots.html'))
        ScreenshotTest._loaded_environment = True

    def test_screenshot(self):
        if not hasattr(self, 'config'):
            self.config = {}
        if not hasattr(self, 'sgvs'):
            self.sgvs = []

        self.ensure_environment()
        set_config(dict(BASE_CONFIG, nightscout_url=MOCK_HOST, **self.config))
        set_sgvs(self.sgvs)

        # Setting new config causes the watchface to re-render and request data
        pebble_set_config()
        time.sleep(2)

        pebble_screenshot(self.test_filename())
        try:
            os.stat(self.gold_filename())
            images_match = image_diff(self.test_filename(), self.gold_filename(), self.diff_filename())
            reason = 'Screenshot does not match expected'
        except OSError:
            images_match = False
            reason = 'Missing gold image'
        ScreenshotTest.summary_file.add_test_result(self, images_match)
        assert images_match, reason


class SummaryFile(object):
    """Generate summary file with screenshots, in a very janky way for now."""
    def __init__(self, out_file):
        self.out_file = out_file
        self.fails = ''
        self.passes = ''

    def write(self):
        with open(self.out_file, 'w') as f:
            f.write("""
            <head>
              <style>
                td { border: 1px solid #666; padding: 4px; vertical-align: top; }
                table { border-collapse: collapse; margin-bottom: 2em; }
                img.pass { border: 5px solid #aea; }
                img.fail { border: 5px solid red; }
                code { display: block; border-top: 1px solid #999; margin-top: 0.5em; padding-top: 0.5em; }
              </style>
            </head>
            <body>
            """
            +
            """
              <table>
                {fails}
              </table>
              <table>
                {passes}
              </table>
            """.format(fails=self.fails, passes=self.passes))

    def add_test_result(self, test_instance, passed):
        result = """
        <tr>
          <td><img src="{test_filename}" class="{klass}"></td>
          <td><img src="{diff_filename}"></td>
          <td>
            <strong>{classname}</strong> {doc}
            <code>{config}</code>
            <code>{sgvs}</code>
          </td>
        </tr>
        """.format(
            test_filename=self.relative_path(test_instance.test_filename()),
            klass=('pass' if passed else 'fail'),
            diff_filename=self.relative_path(test_instance.diff_filename()),
            classname=test_instance.__class__.__name__,
            doc=test_instance.__class__.__doc__ or '',
            config=json.dumps(test_instance.config),
            sgvs=json.dumps(self.printed_sgvs(test_instance.sgvs))
        )
        if passed:
            self.passes += result
        else:
            self.fails += result
        self.write()

    def relative_path(self, filename):
        return os.path.relpath(filename, os.path.dirname(self.out_file))

    def printed_sgvs(self, sgvs):
        return [
            s
            if i == 0
            else {
                'sgv': s.get('sgv'),
                'ago': self.format_ago(s['date'])
            }
            for i, s in enumerate(sgvs)
        ]

    @staticmethod
    def format_ago(time):
        now = int(datetime.now().strftime('%s'))
        minutes = int(round((now - time / 1000) / 60))
        if minutes < 60:
            return '{}m'.format(minutes)
        else:
            return '{}h{}m'.format(minutes / 60, minutes % 60)
